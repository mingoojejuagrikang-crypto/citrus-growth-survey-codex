# Component Map

## Core ownership
- PM: planning, orchestration, final integration
- Researcher: docs and validation
- Architect: structure and interfaces
- Backend: services, scripts, storage, APIs
- Frontend: UI, UX, PWA, mobile behavior
- QA: verification and regression checks

## Planned product modules
- `app-shell`: installable PWA shell, route layout, update prompt, offline banner
- `survey-setup`: survey type selection, active field set, presets, default entities, voice eligibility by field
- `capture-workspace`: one-handed field entry, recent context reuse, manual keypad flows, field-by-field voice capture, immediate validation
- `record-timeline`: same-subject record continuation, previous values, anomaly flags, local save status
- `local-data`: IndexedDB tables for sessions, records, field definitions, presets, sync queue, recovery snapshots
- `sync-engine`: outbound queue, retry policy, dedupe keys, sync status, conflict reporting
- `voice-loop`: STT controller, field parser, context-aware correction, short TTS confirmations
- `assistive-ai`: optional Gemma-backed candidate generation for remarks and user-created field names

## Shared record boundaries
- `surveySession`: one fieldwork run with active survey type, preset, investigator/device context, and temporary defaults
- `surveySubjectKey`: stable identity for the measured unit; initially assumed to be survey type + survey date + farm + label + treatment + tree number + fruit number
- `surveyRecord`: one subject key with common fields, type-specific fields, derived fields, audit metadata, and sync state
- `fieldDefinition`: configurable schema entry describing input type, validation, voice allowance, and derivation rules

## Workbook mapping notes
- Legacy `비대조사.처리` and `품질조사.처리구` map to internal `treatment`
- Legacy `비대조사.횡경/종경` and `품질조사.횡경/종경` map to shared size measurement fields
- Legacy `품질조사.과피두께x4` is the measured source field, while `과피두께`, `산함량`, `당산도` should become explicit app derivation rules

## UX boundaries
- Manual input is the primary path and must never depend on speech or AI availability.
- Voice feedback is short, event-based, and non-blocking.
- Repeated-entry optimization is handled in the capture workspace and record timeline, not by creating hidden auto-increment behavior.
