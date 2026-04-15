import { useEffect, useMemo, useRef, useState } from 'react'

import './index.css'
import {
  buildComparableKey,
  buildSubjectKey,
  createDefaultSetupState,
  createDraftFromSetup,
  createMeasurementValue,
  createNextDraft,
  createRecordFromDraft,
  describeMeasurement,
  getActiveMeasurementFields,
  getAllFields,
  surveyLabels,
  workbookSeeds,
} from './schema'
import { loadPersistedState, persistAppState, upsertRecord } from './storage'
import type {
  CaptureDraft,
  CustomField,
  FieldDefinition,
  SetupState,
  SurveyRecord,
  SurveySession,
  SurveyType,
} from './types'

type TabId = 'setup' | 'capture' | 'records'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionResultLike = {
  0: {
    transcript: string
  }
  isFinal: boolean
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: SpeechRecognitionResultLike[]
}

const defaultSetup = createDefaultSetupState()
const defaultDraft = createDraftFromSetup(defaultSetup)

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('setup')
  const [setup, setSetup] = useState<SetupState>(defaultSetup)
  const [draft, setDraft] = useState<CaptureDraft>(defaultDraft)
  const [session, setSession] = useState<SurveySession | null>(null)
  const [records, setRecords] = useState<SurveyRecord[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [saveMessage, setSaveMessage] = useState('설정 화면에서 세션을 시작하세요.')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [customFieldDraft, setCustomFieldDraft] = useState({
    label: '',
    inputType: 'decimal' as CustomField['inputType'],
    options: '',
  })
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceTargetFieldId, setVoiceTargetFieldId] = useState('treeNo')
  const [voiceStatus, setVoiceStatus] = useState('대기')
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastVoiceFieldId, setLastVoiceFieldId] = useState<string | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const voiceEnabledRef = useRef(false)

  const supportsSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
  const supportsSpeechRecognition =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    const hydrate = async () => {
      const persisted = await loadPersistedState()

      if (persisted.appState) {
        setSetup(persisted.appState.setup)
        setDraft(persisted.appState.draft)
        setSession(persisted.appState.session)
      }

      setRecords(persisted.records)
      setHydrated(true)
    }

    void hydrate()
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    void persistAppState({ setup, draft, session })
  }, [draft, hydrated, session, setup])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const activeMeasurementFields = useMemo(
    () => getActiveMeasurementFields(setup),
    [setup],
  )
  const allFields = useMemo(() => getAllFields(setup.surveyType, setup.customFields), [setup])
  const voiceFields = useMemo(
    () =>
      allFields.filter(
        (field) =>
          field.voiceEnabled &&
          (field.section === 'identity' || field.section === 'measurement'),
      ),
    [allFields],
  )
  const effectiveVoiceTargetFieldId = voiceFields.some(
    (field) => field.id === voiceTargetFieldId,
  )
    ? voiceTargetFieldId
    : (voiceFields[0]?.id ?? 'treeNo')
  const currentSubjectKey = buildSubjectKey(setup.surveyType, draft)
  const currentComparableKey = buildComparableKey(setup.surveyType, draft)

  const currentRecord = useMemo(
    () => records.find((record) => record.subjectKey === currentSubjectKey),
    [currentSubjectKey, records],
  )

  const previousRecord = useMemo(() => {
    return records.find(
      (record) =>
        record.comparableKey === currentComparableKey &&
        record.common.surveyDate < draft.surveyDate &&
        record.subjectKey !== currentSubjectKey,
    )
  }, [currentComparableKey, currentSubjectKey, draft.surveyDate, records])

  const unsyncedCount = records.filter((record) => record.sync.state !== 'synced').length

  function speak(text: string) {
    if (!supportsSpeechSynthesis) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  function normalizeVoiceValue(raw: string) {
    return raw
      .trim()
      .replace(/,/g, '.')
      .replace(/\s*점\s*/g, '.')
      .replace(/\s+/g, '')
  }

  function resolveVoiceField(transcript: string) {
    const normalized = transcript.replace(/\s+/g, '').toLowerCase()
    const aliasPairs = [
      ...voiceFields.map((field) => [field.label.replace(/\s+/g, '').toLowerCase(), field.id] as const),
      ['나무', 'treeNo'] as const,
      ['조사나무', 'treeNo'] as const,
      ['과실', 'fruitNo'] as const,
      ['조사과실', 'fruitNo'] as const,
      ['처리구', 'treatment'] as const,
    ].sort((a, b) => b[0].length - a[0].length)

    for (const [alias, fieldId] of aliasPairs) {
      if (normalized.startsWith(alias)) {
        return {
          fieldId,
          value: normalized.slice(alias.length),
          explicitField: true,
        }
      }
    }

    return {
      fieldId: lastVoiceFieldId ?? effectiveVoiceTargetFieldId,
      value: normalized,
      explicitField: false,
    }
  }

  function applyVoiceTranscript(transcript: string) {
    const resolved = resolveVoiceField(transcript)
    const targetField = allFields.find((field) => field.id === resolved.fieldId)
    const normalizedValue = normalizeVoiceValue(resolved.value)

    if (!targetField || !normalizedValue) {
      setVoiceStatus('해석 실패')
      setSaveMessage('음성 인식은 됐지만 필드 또는 값을 해석하지 못했습니다.')
      speak('다시 입력')
      return
    }

    if (targetField.section === 'identity') {
      updateDraftIdentity(targetField.id as keyof CaptureDraft, normalizedValue)
    } else {
      setDraft((current) => ({
        ...current,
        measurements: {
          ...current.measurements,
          [targetField.id]: createMeasurementValue(
            normalizedValue,
            targetField.inputType,
            'voice',
          ),
        },
      }))
    }

    setLastVoiceFieldId(targetField.id)
    setVoiceTargetFieldId(targetField.id)
    setVoiceStatus('적용 완료')
    setSaveMessage(
      resolved.explicitField
        ? `${targetField.label} ${normalizedValue}`
        : `수정 ${targetField.label} ${normalizedValue}`,
    )
    speak(
      resolved.explicitField
        ? `${targetField.label} ${normalizedValue}`
        : `수정 ${targetField.label} ${normalizedValue}`,
    )
  }

  function stopVoiceLoop(announce = true) {
    voiceEnabledRef.current = false
    setVoiceEnabled(false)
    setVoiceStatus('중지')
    recognitionRef.current?.stop()
    if (announce) {
      speak('음성 종료')
    }
  }

  function startVoiceLoop() {
    if (!supportsSpeechRecognition) {
      setVoiceStatus('미지원')
      setSaveMessage('이 브라우저는 음성 인식을 지원하지 않습니다.')
      return
    }

    const RecognitionCtor = (
      window as Window & {
        SpeechRecognition?: new () => BrowserSpeechRecognition
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition
      }
    ).SpeechRecognition ??
      (
        window as Window & {
          webkitSpeechRecognition?: new () => BrowserSpeechRecognition
        }
      ).webkitSpeechRecognition

    if (!RecognitionCtor) {
      setVoiceStatus('미지원')
      return
    }

    const recognition = new RecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'ko-KR'

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (!result.isFinal) {
          continue
        }

        const transcript = result[0].transcript.trim()
        setLastTranscript(transcript)
        applyVoiceTranscript(transcript)
      }
    }

    recognition.onerror = () => {
      setVoiceStatus('인식 실패')
      setSaveMessage('음성 인식에 실패했습니다. 다시 시도하거나 수동으로 입력하세요.')
      speak('다시 입력')
    }

    recognition.onend = () => {
      if (!voiceEnabledRef.current) {
        return
      }

      setVoiceStatus('재시작')
      recognition.start()
    }

    recognitionRef.current = recognition
    voiceEnabledRef.current = true
    setVoiceEnabled(true)
    setVoiceStatus('청취 중')
    recognition.start()
    speak('음성 시작')
  }

  function updateSetup<K extends keyof SetupState>(key: K, value: SetupState[K]) {
    setSetup((current) => ({ ...current, [key]: value }))
  }

  function updateDraftIdentity(fieldId: keyof CaptureDraft, value: string) {
    setDraft((current) => ({ ...current, [fieldId]: value }))
  }

  function updateMeasurement(field: FieldDefinition, raw: string) {
    setDraft((current) => ({
      ...current,
      measurements: {
        ...current.measurements,
        [field.id]: createMeasurementValue(raw, field.inputType),
      },
    }))
  }

  function applySurveyType(nextType: SurveyType) {
    const nextSetup: SetupState = {
      ...setup,
      surveyType: nextType,
      activeFieldIds: getAllFields(nextType, setup.customFields)
        .filter((field) => field.section === 'measurement' && field.inputType !== 'derived')
        .map((field) => field.id),
    }

    setSetup(nextSetup)
    setDraft((current) => ({
      ...createDraftFromSetup(nextSetup),
      farmName: current.farmName,
      label: current.label,
      treatment: current.treatment,
      treeNo: current.treeNo,
      fruitNo: current.fruitNo,
    }))
  }

  function startSession() {
    const now = new Date().toISOString()
    const nextSession: SurveySession = {
      id: `${setup.surveyType}-${now}`,
      surveyType: setup.surveyType,
      startedAt: now,
      updatedAt: now,
    }

    setSession(nextSession)
    setDraft(createDraftFromSetup(setup))
    setActiveTab('capture')
    setSaveMessage('새 세션을 시작했습니다. 현장 입력을 진행하세요.')
    speak(`${surveyLabels[setup.surveyType]} 시작`)
  }

  async function saveRecord() {
    if (!session) {
      setSaveMessage('먼저 설정 탭에서 세션을 시작해야 합니다.')
      return
    }

    const record = createRecordFromDraft({
      setup,
      draft,
      sessionId: session.id,
      existingRecord: currentRecord,
    })

    await upsertRecord(record)
    const nextRecords = [record, ...records.filter((item) => item.id !== record.id)].sort((a, b) =>
      b.audit.updatedAt.localeCompare(a.audit.updatedAt),
    )

    setRecords(nextRecords)
    setSession((current) =>
      current
        ? {
            ...current,
            updatedAt: new Date().toISOString(),
          }
        : current,
    )
    setSaveMessage(
      record.validation.missingRequired.length > 0
        ? `로컬 저장 완료. 누락 항목: ${record.validation.missingRequired.join(', ')}`
        : '로컬 저장 완료. 같은 개체에 항목을 계속 추가할 수 있습니다.',
    )
    speak('저장 완료')
  }

  function prepareNextFruit() {
    setDraft((current) => createNextDraft(current))
    setSaveMessage('이전 문맥을 유지한 채 다음 과실 입력 준비가 끝났습니다.')
  }

  function loadRecord(record: SurveyRecord) {
    setSetup((current) => ({
      ...current,
      surveyType: record.surveyType,
      surveyDate: record.common.surveyDate,
      referenceDate: record.common.referenceDate,
      defaults: {
        farmName: record.common.farmName,
        label: record.common.label,
        treatment: record.common.treatment,
        treeNo: record.common.treeNo,
        fruitNo: record.common.fruitNo,
      },
    }))

    setDraft({
      surveyDate: record.common.surveyDate,
      referenceDate: record.common.referenceDate,
      farmName: record.common.farmName,
      label: record.common.label,
      treatment: record.common.treatment,
      treeNo: record.common.treeNo,
      fruitNo: record.common.fruitNo,
      remarks: record.common.remarks,
      measurements: record.measurements,
    })
    setActiveTab('capture')
    setSaveMessage('기존 로컬 기록을 다시 열었습니다.')
  }

  async function handleInstall() {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  function addCustomField() {
    const label = customFieldDraft.label.trim()
    if (!label) {
      return
    }

    const fieldId = `custom_${label
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '_')
      .replace(/^_+|_+$/g, '')}_${Date.now()}`

    const nextField: CustomField = {
      id: fieldId,
      label,
      inputType: customFieldDraft.inputType,
      options:
        customFieldDraft.inputType === 'select'
          ? customFieldDraft.options
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      voiceEnabled: false,
    }

    setSetup((current) => ({
      ...current,
      customFields: [...current.customFields, nextField],
      activeFieldIds: [...current.activeFieldIds, nextField.id],
    }))
    setCustomFieldDraft({
      label: '',
      inputType: 'decimal',
      options: '',
    })
  }

  const statusTone = online ? 'status-good' : 'status-warn'

  useEffect(() => {
    return () => {
      voiceEnabledRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">현장형 감귤 생육조사 PWA</p>
          <h1>스마트폰 조사 MVP</h1>
        </div>
        <div className="topbar-actions">
          <span className={`pill ${statusTone}`}>{online ? '온라인' : '오프라인'}</span>
          <span className="pill neutral">미동기화 {unsyncedCount}건</span>
          {installPrompt ? (
            <button className="secondary-button" onClick={() => void handleInstall()}>
              설치
            </button>
          ) : null}
        </div>
      </header>

      <section className="summary-strip">
        <article className="summary-card">
          <h2>현재 세션</h2>
          <p>{session ? `${surveyLabels[session.surveyType]} 진행 중` : '세션 미시작'}</p>
          <small>{session ? session.startedAt.slice(0, 16).replace('T', ' ') : '-'}</small>
        </article>
        <article className="summary-card">
          <h2>음성 환경</h2>
          <p>
            STT {supportsSpeechRecognition ? '가능' : '브라우저 미지원'} / TTS{' '}
            {supportsSpeechSynthesis ? '가능' : '미지원'}
          </p>
          <small>이번 빌드는 저장/복구 우선 MVP입니다.</small>
        </article>
        <article className="summary-card wide">
          <h2>저장 상태</h2>
          <p>{saveMessage}</p>
          <small>앱 종료 후에도 마지막 세션과 초안은 IndexedDB에서 복구됩니다.</small>
        </article>
      </section>

      <nav className="tabbar" aria-label="Primary">
        {([
          ['setup', '설정'],
          ['capture', '입력'],
          ['records', '기록'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'setup' ? (
        <section className="panel-grid">
          <article className="panel">
            <div className="panel-head">
              <h2>조사 세션 설정</h2>
              <p>오늘 사용할 조사 유형과 기본 문맥을 먼저 고정합니다.</p>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>조사유형</span>
                <select
                  value={setup.surveyType}
                  onChange={(event) =>
                    applySurveyType(event.target.value as SurveyType)
                  }
                >
                  <option value="growth">비대조사</option>
                  <option value="quality">품질조사</option>
                </select>
              </label>

              <label className="field">
                <span>조사일자</span>
                <input
                  type="date"
                  value={setup.surveyDate}
                  onChange={(event) => {
                    updateSetup('surveyDate', event.target.value)
                    updateDraftIdentity('surveyDate', event.target.value)
                  }}
                />
              </label>

              <label className="field">
                <span>기준일자</span>
                <input
                  type="date"
                  value={setup.referenceDate}
                  onChange={(event) => {
                    updateSetup('referenceDate', event.target.value)
                    updateDraftIdentity('referenceDate', event.target.value)
                  }}
                />
              </label>
            </div>

            <div className="field-grid">
              <SelectField
                label="기본 농가명"
                value={setup.defaults.farmName}
                options={workbookSeeds.farms}
                onChange={(value) =>
                  updateSetup('defaults', { ...setup.defaults, farmName: value })
                }
              />
              <SelectField
                label="기본 라벨"
                value={setup.defaults.label}
                options={workbookSeeds.labels}
                onChange={(value) =>
                  updateSetup('defaults', { ...setup.defaults, label: value })
                }
              />
              <SelectField
                label="기본 처리"
                value={setup.defaults.treatment}
                options={workbookSeeds.treatments}
                onChange={(value) =>
                  updateSetup('defaults', { ...setup.defaults, treatment: value })
                }
              />
              <label className="field">
                <span>기본 조사나무</span>
                <input
                  value={setup.defaults.treeNo}
                  onChange={(event) =>
                    updateSetup('defaults', {
                      ...setup.defaults,
                      treeNo: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>기본 조사과실</span>
                <input
                  value={setup.defaults.fruitNo}
                  onChange={(event) =>
                    updateSetup('defaults', {
                      ...setup.defaults,
                      fruitNo: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <button className="primary-button" onClick={startSession}>
              세션 시작
            </button>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>오늘 사용할 조사항목</h2>
              <p>조사 화면은 여기서 체크한 항목만 노출합니다.</p>
            </div>
            <div className="field-toggle-list">
              {allFields
                .filter((field) => field.section === 'measurement' && field.inputType !== 'derived')
                .map((field) => (
                  <label className="toggle-row" key={field.id}>
                    <input
                      type="checkbox"
                      checked={setup.activeFieldIds.includes(field.id)}
                      onChange={(event) =>
                        setSetup((current) => ({
                          ...current,
                          activeFieldIds: event.target.checked
                            ? [...current.activeFieldIds, field.id]
                            : current.activeFieldIds.filter((id) => id !== field.id),
                        }))
                      }
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>사용자 정의 항목</h2>
              <p>엑셀에 없는 항목도 로컬 세션 기준으로 추가할 수 있습니다.</p>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>항목명</span>
                <input
                  value={customFieldDraft.label}
                  onChange={(event) =>
                    setCustomFieldDraft((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder="예: 색차계"
                />
              </label>
              <label className="field">
                <span>입력 타입</span>
                <select
                  value={customFieldDraft.inputType}
                  onChange={(event) =>
                    setCustomFieldDraft((current) => ({
                      ...current,
                      inputType: event.target.value as CustomField['inputType'],
                    }))
                  }
                >
                  <option value="integer">정수</option>
                  <option value="decimal">소수</option>
                  <option value="text">텍스트</option>
                  <option value="select">선택값</option>
                </select>
              </label>
              {customFieldDraft.inputType === 'select' ? (
                <label className="field full">
                  <span>선택값 목록</span>
                  <input
                    value={customFieldDraft.options}
                    onChange={(event) =>
                      setCustomFieldDraft((current) => ({
                        ...current,
                        options: event.target.value,
                      }))
                    }
                    placeholder="쉼표로 구분"
                  />
                </label>
              ) : null}
            </div>
            <button className="secondary-button" onClick={addCustomField}>
              항목 추가
            </button>
            {setup.customFields.length > 0 ? (
              <ul className="inline-list">
                {setup.customFields.map((field) => (
                  <li key={field.id}>
                    {field.label} · {field.inputType}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </section>
      ) : null}

      {activeTab === 'capture' ? (
        <section className="panel-grid">
          <article className="panel emphasis">
            <div className="panel-head">
              <h2>현재 조사 개체</h2>
              <p>같은 개체는 같은 기록으로 유지하고 필요한 항목만 이어서 입력합니다.</p>
            </div>
            <div className="chip-row">
              <span className="chip">{draft.farmName || '농가 미지정'}</span>
              <span className="chip">{draft.label || '라벨 미지정'}</span>
              <span className="chip">{draft.treatment || '처리 미지정'}</span>
              <span className="chip">나무 {draft.treeNo || '-'}</span>
              <span className="chip">과실 {draft.fruitNo || '-'}</span>
            </div>
            <p className="subject-key">{currentSubjectKey}</p>
            {currentRecord ? (
              <p className="small-note">동일 개체 로컬 기록이 있어 저장 시 같은 행으로 갱신됩니다.</p>
            ) : (
              <p className="small-note">새 개체입니다. 저장 시 새 로컬 기록이 생성됩니다.</p>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>구조화 음성 입력</h2>
              <p>
                필드 + 값을 말하면 해당 항목에 기록하고, 값만 말하면 직전 문맥 또는 선택 필드에 수정 적용합니다.
              </p>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>현재 음성 대상 필드</span>
                <select
                  value={effectiveVoiceTargetFieldId}
                  onChange={(event) => setVoiceTargetFieldId(event.target.value)}
                >
                  {voiceFields.map((field) => (
                    <option value={field.id} key={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="voice-status-card">
                <span>상태</span>
                <strong>{voiceStatus}</strong>
                <small>최근 인식: {lastTranscript || '-'}</small>
              </div>
            </div>
            <div className="action-panel">
              {voiceEnabled ? (
                <button className="secondary-button" onClick={() => stopVoiceLoop()}>
                  음성 종료
                </button>
              ) : (
                <button className="primary-button" onClick={startVoiceLoop}>
                  음성 시작
                </button>
              )}
              <span className="pill neutral">
                예: 횡경 35.1 / 수정은 값만 발화
              </span>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>기본 식별값</h2>
              <p>반복 입력이 많은 값은 설정 탭 기본값으로 유지하고 여기서만 미세 조정합니다.</p>
            </div>
            <div className="field-grid">
              <SelectField
                label="농가명"
                value={draft.farmName}
                options={workbookSeeds.farms}
                onChange={(value) => updateDraftIdentity('farmName', value)}
              />
              <SelectField
                label="라벨"
                value={draft.label}
                options={workbookSeeds.labels}
                onChange={(value) => updateDraftIdentity('label', value)}
              />
              <SelectField
                label="처리"
                value={draft.treatment}
                options={workbookSeeds.treatments}
                onChange={(value) => updateDraftIdentity('treatment', value)}
              />
              <label className="field">
                <span>조사일자</span>
                <input
                  type="date"
                  value={draft.surveyDate}
                  onChange={(event) => updateDraftIdentity('surveyDate', event.target.value)}
                />
              </label>
              <label className="field">
                <span>기준일자</span>
                <input
                  type="date"
                  value={draft.referenceDate}
                  onChange={(event) => updateDraftIdentity('referenceDate', event.target.value)}
                />
              </label>
              <label className="field">
                <span>조사나무</span>
                <input
                  inputMode="numeric"
                  value={draft.treeNo}
                  onChange={(event) => updateDraftIdentity('treeNo', event.target.value)}
                />
              </label>
              <label className="field">
                <span>조사과실</span>
                <input
                  inputMode="numeric"
                  value={draft.fruitNo}
                  onChange={(event) => updateDraftIdentity('fruitNo', event.target.value)}
                />
              </label>
              <label className="field full">
                <span>비고</span>
                <textarea
                  rows={3}
                  value={draft.remarks}
                  onChange={(event) => updateDraftIdentity('remarks', event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>측정 입력</h2>
              <p>활성화한 필드만 노출됩니다. 파생값은 자동 계산됩니다.</p>
            </div>
            <div className="field-grid">
              {activeMeasurementFields
                .filter((field) => field.inputType !== 'derived')
                .map((field) => (
                  <MeasurementField
                    key={field.id}
                    field={field}
                    rawValue={draft.measurements[field.id]?.raw ?? ''}
                    onChange={(raw) => updateMeasurement(field, raw)}
                  />
                ))}
            </div>

            <div className="derived-grid">
              {activeMeasurementFields
                .filter((field) => field.inputType === 'derived')
                .map((field) => {
                  const preview = createRecordFromDraft({
                    setup,
                    draft,
                    sessionId: session?.id ?? 'preview',
                    existingRecord: currentRecord,
                  })
                  return (
                    <div className="derived-card" key={field.id}>
                      <span>{field.label}</span>
                      <strong>
                        {preview.derived[field.id]?.value === null ||
                        preview.derived[field.id]?.value === undefined
                          ? '-'
                          : String(preview.derived[field.id]?.value)}
                      </strong>
                    </div>
                  )
                })}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>이전 조사 비교</h2>
              <p>같은 개체의 이전 일자 값이 있으면 차이를 바로 확인합니다.</p>
            </div>
            {previousRecord ? (
              <div className="comparison-list">
                <p className="small-note">
                  이전 조사일자: {previousRecord.common.surveyDate}
                </p>
                {activeMeasurementFields.map((field) => (
                  <div className="comparison-row" key={field.id}>
                    <span>{field.label}</span>
                    <span>
                      이전 {describeMeasurement(field.id, previousRecord.measurements, previousRecord.derived)}
                    </span>
                    <span>
                      현재{' '}
                      {field.inputType === 'derived'
                        ? describeMeasurement(
                            field.id,
                            currentRecord?.measurements ?? {},
                            createRecordFromDraft({
                              setup,
                              draft,
                              sessionId: session?.id ?? 'preview',
                            }).derived,
                          )
                        : draft.measurements[field.id]?.raw || '-'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small-note">같은 개체의 이전 조사 기록이 아직 없습니다.</p>
            )}
          </article>

          <article className="panel action-panel">
            <button className="primary-button" onClick={() => void saveRecord()}>
              로컬 저장
            </button>
            <button className="secondary-button" onClick={prepareNextFruit}>
              다음 과실 준비
            </button>
          </article>
        </section>
      ) : null}

      {activeTab === 'records' ? (
        <section className="panel-grid">
          <article className="panel">
            <div className="panel-head">
              <h2>로컬 기록</h2>
              <p>저장된 기록은 오프라인 상태에서도 다시 열 수 있습니다.</p>
            </div>
            <div className="records-list">
              {records.length === 0 ? (
                <p className="small-note">아직 저장된 기록이 없습니다.</p>
              ) : (
                records.map((record) => (
                  <button
                    className="record-row"
                    key={record.id}
                    onClick={() => loadRecord(record)}
                  >
                    <div>
                      <strong>{surveyLabels[record.surveyType]}</strong>
                      <p>
                        {record.common.farmName} · {record.common.label} · {record.common.treatment}
                      </p>
                    </div>
                    <div className="record-meta">
                      <span>
                        나무 {record.common.treeNo} / 과실 {record.common.fruitNo}
                      </span>
                      <span>{record.common.surveyDate}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  )
}

type SelectFieldProps = {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}

function SelectField(props: SelectFieldProps) {
  const { label, value, options, onChange } = props

  return (
    <label className="field">
      <span>{label}</span>
      <input list={`${label}-options`} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={`${label}-options`}>
        {options.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </label>
  )
}

type MeasurementFieldProps = {
  field: FieldDefinition
  rawValue: string
  onChange: (raw: string) => void
}

function MeasurementField(props: MeasurementFieldProps) {
  const { field, rawValue, onChange } = props

  if (field.inputType === 'select') {
    return (
      <label className="field" key={field.id}>
        <span>{field.label}</span>
        <select value={rawValue} onChange={(event) => onChange(event.target.value)}>
          <option value="">선택</option>
          {field.options?.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className="field" key={field.id}>
      <span>{field.label}</span>
      {field.inputType === 'text' ? (
        <input value={rawValue} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          inputMode="decimal"
          value={rawValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </label>
  )
}

export default App
