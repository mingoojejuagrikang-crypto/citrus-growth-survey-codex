import type {
  CaptureDraft,
  CustomField,
  DerivedValue,
  FieldDefinition,
  FieldInputType,
  MeasurementValue,
  SetupState,
  SurveyRecord,
  SurveyType,
  ValidationWarning,
} from './types'

const today = new Date().toISOString().slice(0, 10)

export const workbookSeeds = {
  farms: ['이원창', '강남호', '양승보'],
  labels: ['A', 'B', 'C'],
  treatments: ['시험', '관행'],
  treeNumbers: ['1', '2', '3'],
  fruitNumbers: ['1', '2', '3', '4', '5'],
}

export const surveyLabels: Record<SurveyType, string> = {
  growth: '비대조사',
  quality: '품질조사',
}

const coreFieldDefinitions: FieldDefinition[] = [
  {
    id: 'farmName',
    label: '농가명',
    surveyTypes: ['growth', 'quality'],
    section: 'identity',
    inputType: 'select',
    required: true,
    voiceEnabled: false,
    options: workbookSeeds.farms,
  },
  {
    id: 'label',
    label: '라벨',
    surveyTypes: ['growth', 'quality'],
    section: 'identity',
    inputType: 'select',
    required: true,
    voiceEnabled: false,
    options: workbookSeeds.labels,
  },
  {
    id: 'treatment',
    label: '처리',
    surveyTypes: ['growth', 'quality'],
    section: 'identity',
    inputType: 'select',
    required: true,
    voiceEnabled: false,
    options: workbookSeeds.treatments,
  },
  {
    id: 'treeNo',
    label: '조사나무',
    surveyTypes: ['growth', 'quality'],
    section: 'identity',
    inputType: 'integer',
    required: true,
    voiceEnabled: true,
    placeholder: '예: 2',
  },
  {
    id: 'fruitNo',
    label: '조사과실',
    surveyTypes: ['growth', 'quality'],
    section: 'identity',
    inputType: 'integer',
    required: true,
    voiceEnabled: true,
    placeholder: '예: 3',
  },
  {
    id: 'remarks',
    label: '비고',
    surveyTypes: ['growth', 'quality'],
    section: 'remarks',
    inputType: 'text',
    required: false,
    voiceEnabled: false,
    placeholder: '짧은 메모',
  },
]

const measurementFieldDefinitions: Record<SurveyType, FieldDefinition[]> = {
  growth: [
    {
      id: 'widthMm',
      label: '횡경',
      surveyTypes: ['growth'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
      placeholder: 'mm',
    },
    {
      id: 'lengthMm',
      label: '종경',
      surveyTypes: ['growth'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
      placeholder: 'mm',
    },
  ],
  quality: [
    {
      id: 'widthMm',
      label: '횡경',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
      placeholder: 'mm',
    },
    {
      id: 'lengthMm',
      label: '종경',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
      placeholder: 'mm',
    },
    {
      id: 'fruitWeightG',
      label: '과중',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
      placeholder: 'g',
    },
    {
      id: 'peelWeightG',
      label: '과피중',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: false,
      voiceEnabled: true,
      placeholder: 'g',
    },
    {
      id: 'peelThicknessX4',
      label: '과피두께x4',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
      placeholder: '측정 원값',
    },
    {
      id: 'peelThicknessMm',
      label: '과피두께',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'derived',
      required: false,
      voiceEnabled: false,
      derivedFrom: {
        sourceFieldIds: ['peelThicknessX4'],
        formula: 'divideBy4',
      },
    },
    {
      id: 'brix',
      label: '당도',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
    },
    {
      id: 'acidityTitration',
      label: '적정',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: true,
      voiceEnabled: true,
    },
    {
      id: 'acidContent',
      label: '산함량',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'derived',
      required: false,
      voiceEnabled: false,
      derivedFrom: {
        sourceFieldIds: ['acidityTitration'],
        formula: 'timesPoint64',
      },
    },
    {
      id: 'sugarAcidRatio',
      label: '당산도',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'derived',
      required: false,
      voiceEnabled: false,
      derivedFrom: {
        sourceFieldIds: ['brix', 'acidContent'],
        formula: 'divide',
      },
    },
    {
      id: 'coloration',
      label: '착색',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: false,
      voiceEnabled: true,
    },
    {
      id: 'nonDestructiveValue',
      label: '비파괴',
      surveyTypes: ['quality'],
      section: 'measurement',
      inputType: 'decimal',
      required: false,
      voiceEnabled: true,
    },
  ],
}

export function createDefaultSetupState(): SetupState {
  return {
    surveyType: 'growth',
    surveyDate: today,
    referenceDate: today,
    defaults: {
      farmName: workbookSeeds.farms[0],
      label: workbookSeeds.labels[0],
      treatment: workbookSeeds.treatments[0],
      treeNo: workbookSeeds.treeNumbers[0],
      fruitNo: workbookSeeds.fruitNumbers[0],
    },
    activeFieldIds: measurementFieldDefinitions.growth
      .filter((field) => field.inputType !== 'derived')
      .map((field) => field.id),
    customFields: [],
  }
}

export function createDraftFromSetup(setup: SetupState): CaptureDraft {
  return {
    surveyDate: setup.surveyDate,
    referenceDate: setup.referenceDate,
    farmName: setup.defaults.farmName,
    label: setup.defaults.label,
    treatment: setup.defaults.treatment,
    treeNo: setup.defaults.treeNo,
    fruitNo: setup.defaults.fruitNo,
    remarks: '',
    measurements: {},
  }
}

export function getMeasurementFields(
  surveyType: SurveyType,
  customFields: CustomField[],
): FieldDefinition[] {
  const base = measurementFieldDefinitions[surveyType]
  const custom: FieldDefinition[] = customFields.map((field) => ({
    id: field.id,
    label: field.label,
    surveyTypes: [surveyType],
    section: 'measurement',
    inputType: field.inputType,
    required: false,
    voiceEnabled: field.voiceEnabled,
    options: field.options,
  }))

  return [...base, ...custom]
}

export function getAllFields(
  surveyType: SurveyType,
  customFields: CustomField[],
): FieldDefinition[] {
  return [...coreFieldDefinitions, ...getMeasurementFields(surveyType, customFields)]
}

export function getActiveMeasurementFields(setup: SetupState): FieldDefinition[] {
  return getMeasurementFields(setup.surveyType, setup.customFields).filter(
    (field) =>
      field.inputType === 'derived' || setup.activeFieldIds.includes(field.id),
  )
}

export function buildSubjectKey(
  surveyType: SurveyType,
  draft: CaptureDraft,
): string {
  return [
    surveyType,
    draft.surveyDate,
    draft.farmName.trim(),
    draft.label.trim(),
    draft.treatment.trim(),
    draft.treeNo.trim(),
    draft.fruitNo.trim(),
  ].join('::')
}

export function buildComparableKey(
  surveyType: SurveyType,
  draft: CaptureDraft,
): string {
  return [
    surveyType,
    draft.farmName.trim(),
    draft.label.trim(),
    draft.treatment.trim(),
    draft.treeNo.trim(),
    draft.fruitNo.trim(),
  ].join('::')
}

function parseNumeric(raw?: string): number | null {
  if (!raw?.trim()) {
    return null
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

export function deriveMeasurements(
  draft: CaptureDraft,
  setup: SetupState,
): Record<string, DerivedValue> {
  const now = new Date().toISOString()
  const source = draft.measurements
  const derived: Record<string, DerivedValue> = {}
  const fields = getMeasurementFields(setup.surveyType, setup.customFields)

  for (const field of fields) {
    if (!field.derivedFrom) {
      continue
    }

    if (field.derivedFrom.formula === 'divideBy4') {
      const base = parseNumeric(source.peelThicknessX4?.raw)
      derived[field.id] = {
        value: base === null ? null : round(base / 4, 1),
        sourceFieldIds: ['peelThicknessX4'],
        formula: 'ROUND(peelThicknessX4 / 4, 1)',
        computedAt: now,
      }
    }

    if (field.derivedFrom.formula === 'timesPoint64') {
      const base = parseNumeric(source.acidityTitration?.raw)
      derived[field.id] = {
        value: base === null ? null : round(base * 0.64, 2),
        sourceFieldIds: ['acidityTitration'],
        formula: 'ROUND(acidityTitration * 0.64, 2)',
        computedAt: now,
      }
    }

    if (field.derivedFrom.formula === 'divide') {
      const numerator = parseNumeric(source.brix?.raw)
      const denominatorRaw = derived.acidContent?.value
      const denominator =
        typeof denominatorRaw === 'number' ? denominatorRaw : Number(denominatorRaw)

      derived[field.id] = {
        value:
          numerator === null || !Number.isFinite(denominator) || denominator === 0
            ? null
            : round(numerator / denominator, 2),
        sourceFieldIds: ['brix', 'acidContent'],
        formula: 'ROUND(brix / acidContent, 2)',
        computedAt: now,
      }
    }
  }

  return derived
}

export function buildValidation(
  draft: CaptureDraft,
  setup: SetupState,
): {
  missingRequired: string[]
  warnings: ValidationWarning[]
} {
  const missingRequired: string[] = []
  const warnings: ValidationWarning[] = []
  const allFields = getAllFields(setup.surveyType, setup.customFields)
  const activeMeasurementIds = new Set(setup.activeFieldIds)

  for (const field of allFields) {
    if (field.section === 'measurement' && !activeMeasurementIds.has(field.id)) {
      continue
    }

    if (field.inputType === 'derived') {
      continue
    }

    const rawValue =
      field.section === 'identity'
        ? draft[field.id as keyof CaptureDraft]
        : field.section === 'remarks'
          ? draft.remarks
          : draft.measurements[field.id]?.raw

    const value = typeof rawValue === 'string' ? rawValue.trim() : ''

    if (field.required && !value) {
      missingRequired.push(field.label)
    }

    if (
      value &&
      (field.inputType === 'integer' || field.inputType === 'decimal') &&
      Number.isNaN(Number(value))
    ) {
      warnings.push({
        fieldId: field.id,
        code: 'INVALID_NUMBER',
        message: `${field.label} 값이 숫자가 아닙니다.`,
      })
    }
  }

  const width = parseNumeric(draft.measurements.widthMm?.raw)
  const length = parseNumeric(draft.measurements.lengthMm?.raw)
  if (width !== null && (width < 0 || width > 150)) {
    warnings.push({
      fieldId: 'widthMm',
      code: 'OUTLIER',
      message: '횡경 값이 예상 범위를 벗어났습니다.',
    })
  }
  if (length !== null && (length < 0 || length > 150)) {
    warnings.push({
      fieldId: 'lengthMm',
      code: 'OUTLIER',
      message: '종경 값이 예상 범위를 벗어났습니다.',
    })
  }

  return { missingRequired, warnings }
}

export function createMeasurementValue(
  raw: string,
  inputType: FieldInputType,
  source: MeasurementValue['source'] = 'manual',
): MeasurementValue {
  const parsed =
    inputType === 'integer' || inputType === 'decimal' ? parseNumeric(raw) : raw

  return {
    raw,
    parsed,
    source,
    updatedAt: new Date().toISOString(),
  }
}

export function createRecordFromDraft(args: {
  setup: SetupState
  draft: CaptureDraft
  sessionId: string
  existingRecord?: SurveyRecord
}): SurveyRecord {
  const { setup, draft, sessionId, existingRecord } = args
  const derived = deriveMeasurements(draft, setup)
  const validation = buildValidation(draft, setup)
  const subjectKey = buildSubjectKey(setup.surveyType, draft)
  const comparableKey = buildComparableKey(setup.surveyType, draft)
  const now = new Date().toISOString()

  return {
    id: existingRecord?.id ?? subjectKey,
    surveyType: setup.surveyType,
    subjectKey,
    comparableKey,
    sessionId,
    common: {
      surveyDate: draft.surveyDate,
      referenceDate: draft.referenceDate,
      farmName: draft.farmName,
      label: draft.label,
      treatment: draft.treatment,
      treeNo: draft.treeNo,
      fruitNo: draft.fruitNo,
      remarks: draft.remarks,
    },
    measurements: draft.measurements,
    derived,
    validation,
    sync: {
      state: 'local-only',
      dedupeKey: `${subjectKey}::${now}`,
    },
    audit: {
      createdAt: existingRecord?.audit.createdAt ?? now,
      updatedAt: now,
      appVersion: '0.1.0',
    },
  }
}

export function createNextDraft(current: CaptureDraft): CaptureDraft {
  return {
    ...current,
    fruitNo: '',
    remarks: '',
    measurements: {},
  }
}

export function describeMeasurement(
  fieldId: string,
  measurements: Record<string, MeasurementValue>,
  derived: Record<string, DerivedValue>,
): string {
  const direct = measurements[fieldId]?.raw
  if (direct) {
    return direct
  }

  const derivedValue = derived[fieldId]?.value
  return derivedValue === null || derivedValue === undefined
    ? '-'
    : String(derivedValue)
}
