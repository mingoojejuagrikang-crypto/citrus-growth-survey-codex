# Citrus Growth Survey PWA Design

## 1. Scope and planning stance
- This is a smartphone-first, field-use PWA for repeated citrus growth measurements.
- Phase 1 scope focuses on two survey types: `growth` and `quality`.
- The source workbook has now been reviewed: `/Users/kangmingoo/Downloads/25 노지감귤 생육데이터 통합.xlsx`.
- The app should be local-first. Speech and AI are assistive, not required for successful capture.
- Official Google AI docs now confirm `Gemma 4` availability including `E2B`; this plan treats `Gemma 4 E2B` as the optional small on-device candidate for assistive workflows only.

## 2. PM judgment summary
- Standardize `처리` and `처리구` into one internal key: `treatment`. Preserve original labels in import/export mapping once the workbook is reviewed.
- Workbook review confirmed the two active sheets:
  - `비대조사`
  - `품질조사`
- Separate schema into:
  - common core fields shared by all survey types
  - survey-type extension fields
  - derived fields
- `과피두께x4` is the real measured source field and should remain the user-entered value in the app.
- `과피두께` should be derived from `과피두께x4` using the existing workbook rule:
  - `peelThicknessMm = ROUND(peelThicknessX4 / 4, 1)`
- Also model these legacy spreadsheet calculations as explicit derived rules in the app:
  - `acidContent = ROUND(acidityTitration * 0.64, 2)`
  - `sugarAcidRatio = ROUND(brix / acidContent, 2)`
- Use a `surveySession` concept. It reduces repeated setup work, makes recovery easier, and lets investigators operate with stable defaults during a field run.
- Keep the same record row for the same measured subject. A new row is created only when the subject identity changes, not when more fields are added later.
- Use a stable subject identity key. Initial proposal:
  - `surveyType + surveyDate + farmName + label + treatment + treeNo + fruitNo`
- Keep both raw input and normalized values where reliability matters:
  - raw spoken/typed string for auditability
  - parsed numeric value when valid

## 3. Proposed information architecture
- `Home`
  - resume interrupted session
  - start new session
  - view unsynced records
- `Setup`
  - select survey type
  - load base preset
  - adjust active field set
  - configure defaults for farm, label, treatment, tree range, and common notes
  - configure field input type and voice allowance
- `Capture`
  - single-subject workspace for fast entry
  - current subject summary chip row
  - field cards ordered by frequency and importance
  - recent values, previous value comparison, anomaly warnings
  - save / next subject / continue same subject actions
- `Records`
  - local timeline of saved records
  - filter by session, survey type, subject key, sync state
  - reopen a record and add missing fields without forcing a new row
- `Sync`
  - queue status
  - last sync time
  - retry failed items
  - conflict/error details

## 4. Data model
### 4.1 Core field model
```ts
type FieldInputType =
  | "integer"
  | "decimal"
  | "text"
  | "select"
  | "derived";

type FieldDefinition = {
  id: string;
  label: string;
  surveyTypes: Array<"growth" | "quality">;
  inputType: FieldInputType;
  required: boolean;
  voiceEnabled: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    decimalPlaces?: number;
    warningOnly?: boolean;
  };
  derivedFrom?: {
    sourceFieldIds: string[];
    formula: "multiplyBy4";
  };
};
```

### 4.2 Common core fields
- `surveyDate`
- `referenceDate`
- `farmName`
- `label`
- `treatment`
- `treeNo`
- `fruitNo`
- `remarks`

### 4.2.1 Workbook-backed shared option seeds
- farms observed: `이원창`, `강남호`, `양승보`
- labels observed: `A`, `B`, `C`
- treatments observed: `시험`, `관행`
- tree numbers observed: `1`, `2`, `3`
- fruit numbers observed: `1`, `2`, `3`, `4`, `5`

### 4.3 Growth survey fields
- `widthMm`
- `lengthMm`

### 4.4 Quality survey fields
- `widthMm`
- `lengthMm`
- `fruitWeightG`
- `peelWeightG`
- `peelThicknessX4`
- `peelThicknessMm`
- `brix`
- `acidityTitration`
- `acidContent`
- `sugarAcidRatio`
- `coloration`
- `nonDestructiveValue`

### 4.4.1 Legacy workbook mapping
- workbook `적정` maps to internal `acidityTitration`
- workbook `산함량` maps to internal `acidContent`
- workbook `당산도` maps to internal `sugarAcidRatio`
- workbook `비파괴` maps to internal `nonDestructiveValue`

### 4.5 Record shape
```ts
type SurveyRecord = {
  id: string;
  surveyType: "growth" | "quality";
  subjectKey: string;
  sessionId: string;
  common: Record<string, unknown>;
  measurements: Record<string, {
    raw: string;
    parsed?: number | string | null;
    source: "manual" | "voice";
    updatedAt: string;
  }>;
  derived: Record<string, {
    value: number | string | null;
    sourceFieldIds: string[];
    formula: string;
    computedAt: string;
  }>;
  validation: {
    missingRequired: string[];
    warnings: Array<{ fieldId: string; code: string; message: string }>;
  };
  sync: {
    state: "local-only" | "queued" | "syncing" | "synced" | "error";
    dedupeKey: string;
    lastError?: string;
  };
  audit: {
    createdAt: string;
    updatedAt: string;
    deviceId: string;
    appVersion: string;
  };
};
```

## 5. Setup tab design
### Goals
- Keep capture screens short and predictable.
- Push infrequent complexity into pre-session setup.
- Make repeated fieldwork reusable through presets.

### Required functions
- choose `growth` or `quality` base preset
- toggle active fields for today
- add custom fields
- set input type per field
- mark fields as voice-enabled or manual-only
- set default farm, label, treatment, tree range, and common note templates
- save named presets
- duplicate an existing preset for another team or orchard
- preload workbook-derived quick options for farm, label, treatment, tree, and fruit values while still allowing manual override

### Guardrails
- Custom numeric fields require explicit unit and validation range.
- Derived fields cannot be edited directly in capture view.
- Custom field IDs are immutable after first data capture to avoid sync ambiguity.

## 6. Repeated-entry capture UX
### Core principle
- The app optimizes for one-handed, low-attention repeated entry under noise and unstable connectivity.

### Capture behavior
- Subject identity row remains pinned: farm, label, treatment, tree, fruit.
- `fruitNo` stays manual. No auto-increment as default behavior.
- `Continue same subject` reopens the current record and lets the investigator add missing fields.
- `Copy previous context` reuses farm, label, treatment, and optionally tree number, but never silently rewrites fruit number.
- `Recent values` chips allow quick reuse when context is repetitive.
- Save states are explicit:
  - `draft`
  - `saved locally`
  - `queued for sync`
  - `synced`
  - `sync failed`

### Same-row retention rule
- Keep the same record if the subject identity key is unchanged.
- Add or revise fields inside that record until the user intentionally starts a different subject.
- Show the last updated fields and unresolved required fields for the current subject.

## 7. Structured STT + TTS loop
### Design stance
- Voice is an assistive overlay on top of structured capture.
- Free-form dictation is out of MVP scope.
- Every voice result must be immediately inspectable and manually editable.

### MVP voice flow
- User enables voice mode explicitly.
- App listens for one field-value utterance at a time.
- User speaks:
  - first input: `항목 + 값`
  - correction: `값`
- App uses the last active field as the correction context if the utterance contains only a value.
- App applies the parsed value to the current field, shows it immediately, and speaks a short TTS echo.

### TTS event rules
- voice start: short cue only
- voice stop: short cue only
- recognition success: `field + value`
- correction success: `수정 + field + value`
- save success: `저장 완료`
- recognition failure: `다시 입력`
- validation warning: short non-blocking alert without long explanation

### Numeric handling rules
- Preserve the exact user input string first.
- Parse to numeric only after field-specific validation.
- Never let Gemma or another LLM rewrite a numeric result.
- Standardize TTS number reading format per locale and decimal rules; keep it concise and consistent.

### Browser reality
- TTS is realistic for MVP.
- STT in a PWA is browser-dependent and must have a manual fallback with zero workflow penalty.
- Do not block record saving because speech recognition is unavailable or denied.

## 8. Validation and anomaly guidance
- Required core identifiers must be complete before a record can be marked ready for sync.
- Numeric format validation runs on entry.
- Range warnings are configurable by field and should default to warning, not hard block, unless the field is structurally invalid.
- Calculated quality fields should recompute immediately after source updates:
  - `peelThicknessMm` from `peelThicknessX4`
  - `acidContent` from `acidityTitration`
  - `sugarAcidRatio` from `brix` and `acidContent`
- Previous measurement comparison should show:
  - last value
  - delta
  - warning if outside expected change band
- Investigators must be able to override warnings and continue.

## 9. Gemma usage boundary
### Recommended uses
- optional note refinement candidates for `remarks`
- candidate suggestions when a user wants to add a new custom field
- normalization suggestions for free-text field labels

### Not recommended
- numeric value correction
- automatic overwriting of structured fields
- anything inside the save-critical capture loop

### Candidate generation policy
- show up to 20 candidate phrases for new field labels
- require explicit user choice or edit
- keep original user text visible at all times

## 10. Gemma file retention and reuse
- Treat model download as an optional one-time setup action, not an automatic dependency during capture.
- Persist model assets locally where the runtime allows and version them explicitly.
- Reuse local assets across app restarts.
- Never force re-download on every survey session.
- If the model is unavailable, the app still performs all core survey tasks without degradation to manual capture.

### Practical caution
- Exact local retention strategy depends on the eventual runtime:
  - pure web PWA
  - hybrid wrapper such as Capacitor
  - native companion
- For the MVP, keep Gemma integration behind a feature flag until device-level storage and startup latency are validated on target phones.
- If deployment remains pure-browser PWA, treat Gemma as experimental because reliable large local asset retention and startup performance can vary by browser storage behavior and available runtimes.

## 11. Offline, recovery, and sync
### Local-first requirements
- save drafts immediately to IndexedDB
- restore the last in-progress session after refresh, app kill, or accidental tab close
- show unsynced counts prominently
- queue records for sync when network returns
- use idempotent client-generated IDs to avoid duplicates

### Suggested sync model
- every record gets:
  - `id`
  - `subjectKey`
  - `updatedAt`
  - `dedupeKey`
- queue only changed records
- server accepts upserts by `id` and deduplicates by `dedupeKey`
- retain local sync receipts for replay protection

### Recovery flow
- app launch checks for:
  - interrupted session
  - unsaved draft
  - failed sync queue
- user sees a direct resume action instead of navigating through menus

## 12. MVP definition
### MVP must include
- installable PWA shell
- setup tab with survey type, active field set, and reusable defaults
- growth survey capture
- quality survey capture
- common/extension/derived field architecture
- workbook-compatible field mapping for the current `비대조사` and `품질조사` sheets
- manual-first capture UX optimized for repeated entry
- IndexedDB local save and recovery
- explicit save and sync states
- previous value comparison scaffold
- basic STT/TTS loop behind feature detection

### MVP should exclude
- free-form conversational voice workflow
- automatic field inference from long utterances
- Gemma in the critical path
- full backend analytics or dashboarding
- Excel import/export automation before workbook review

## 13. Post-MVP expansion
- richer anomaly rules per cultivar or season
- custom report export
- team-level preset sharing
- investigator attribution and multi-user sync
- optional hybrid packaging if browser speech support is insufficient
- optional Gemma-backed note assistance after device performance validation

## 14. Incremental implementation roadmap
### Phase 0: requirement lock
- review the real Excel workbook
- finalize field names, required status, and code tables
- confirm target phone/browser environment

### Phase 1: local-first capture spine
- scaffold PWA
- implement local schema, setup presets, and manual capture
- verify restore after refresh and offline use

### Phase 2: repeated-entry optimization
- implement same-subject continuation
- add recent value reuse, copy context, and explicit status chips
- validate field speed with real use scripts

### Phase 3: validation and comparison
- add missing-value checks, numeric range warnings, and previous measurement comparison
- tune warnings so they do not block fieldwork unnecessarily

### Phase 4: voice loop
- add feature-detected STT/TTS
- keep the field-at-a-time flow
- test in noisy conditions and with speech disabled

### Phase 5: sync and conflict handling
- add queue-based sync
- verify duplicate protection and recovery from network interruptions

### Phase 6: optional AI assist
- add Gemma-backed candidate suggestions for remarks and custom field naming
- validate cold start, storage footprint, and offline reuse before default enablement

## 15. Acceptance criteria for the first build
- A user can start a session on a smartphone and record growth or quality measurements without network access.
- The app restores the last interrupted draft after a reload.
- The same subject can be reopened and extended without creating duplicate rows.
- Numeric fields preserve exact input and warn on invalid structure.
- `peelThicknessX4` updates automatically from `peelThicknessMm`.
- Voice features fail safely and never block manual operation.
- Unsynced data is visible and retryable.

## 16. Missing information that should be confirmed next
- whether `referenceDate` is global per session or editable per record
- whether `treeNo` and `fruitNo` are numeric-only or mixed-format in the legacy workbook
- canonical option lists for treatment, coloration, non-destructive values, and other enumerations
- target deployment browser and device fleet
- whether export back to workbook format is required for the first production rollout
