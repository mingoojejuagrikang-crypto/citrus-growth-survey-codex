export type SurveyType = 'growth' | 'quality'

export type FieldInputType = 'integer' | 'decimal' | 'text' | 'select' | 'derived'

export type InputSource = 'manual' | 'voice'

export type CustomField = {
  id: string
  label: string
  inputType: Exclude<FieldInputType, 'derived'>
  options?: string[]
  voiceEnabled: boolean
}

export type FieldDefinition = {
  id: string
  label: string
  surveyTypes: SurveyType[]
  section: 'identity' | 'measurement' | 'remarks'
  inputType: FieldInputType
  required: boolean
  voiceEnabled: boolean
  options?: string[]
  placeholder?: string
  derivedFrom?: {
    sourceFieldIds: string[]
    formula: 'divideBy4' | 'timesPoint64' | 'divide'
  }
}

export type SetupState = {
  surveyType: SurveyType
  surveyDate: string
  referenceDate: string
  defaults: {
    farmName: string
    label: string
    treatment: string
    treeNo: string
    fruitNo: string
  }
  activeFieldIds: string[]
  customFields: CustomField[]
}

export type MeasurementValue = {
  raw: string
  parsed?: number | string | null
  source: InputSource
  updatedAt: string
}

export type CaptureDraft = {
  surveyDate: string
  referenceDate: string
  farmName: string
  label: string
  treatment: string
  treeNo: string
  fruitNo: string
  remarks: string
  measurements: Record<string, MeasurementValue>
}

export type DerivedValue = {
  value: number | string | null
  sourceFieldIds: string[]
  formula: string
  computedAt: string
}

export type ValidationWarning = {
  fieldId: string
  code: string
  message: string
}

export type SurveyRecord = {
  id: string
  surveyType: SurveyType
  subjectKey: string
  comparableKey: string
  sessionId: string
  common: {
    surveyDate: string
    referenceDate: string
    farmName: string
    label: string
    treatment: string
    treeNo: string
    fruitNo: string
    remarks: string
  }
  measurements: Record<string, MeasurementValue>
  derived: Record<string, DerivedValue>
  validation: {
    missingRequired: string[]
    warnings: ValidationWarning[]
  }
  sync: {
    state: 'local-only' | 'queued' | 'syncing' | 'synced' | 'error'
    dedupeKey: string
    lastError?: string
  }
  audit: {
    createdAt: string
    updatedAt: string
    appVersion: string
  }
}

export type SurveySession = {
  id: string
  surveyType: SurveyType
  startedAt: string
  updatedAt: string
}

export type PersistedAppState = {
  setup: SetupState
  session: SurveySession | null
  draft: CaptureDraft
}
