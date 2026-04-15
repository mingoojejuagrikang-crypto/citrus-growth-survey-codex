# Tech Report

## External services
- Google Drive folder ID: `1plO-ZyipnM4CYgkDdkElaxaL61qtps0r`
- Service account email: `ai-agents-team-codex@ai-agent-team-493400.iam.gserviceaccount.com`
- Local key path: `/Users/kangmingoo/workspace_ai_codex/secrets/ai-agent-team-493400-7d9f1533f6a2.json`

## Product direction
- Primary target: Android smartphone PWA used by field investigators with intermittent or no network.
- Primary success metrics: fast repeated entry, low correction cost, numeric reliability, recoverability after interruption, and low training overhead.

## Recommended stack
- Frontend app: React + TypeScript + Vite
- PWA layer: manual `manifest.webmanifest` + service worker registration because the current `vite-plugin-pwa` release did not resolve cleanly against Vite 8 in this repository
- Local persistence: IndexedDB for records, setup presets, draft state, sync queue, and previous-measurement snapshots
- Server sync API: deferred until after local-first capture flow is validated; design local contracts first
- State model: lightweight store with explicit draft/session separation

## Voice and AI constraints
- TTS baseline: browser `speechSynthesis` is broadly available and suitable for short echo feedback.
- STT baseline: Web Speech recognition should be treated as best-effort and browser-dependent, with manual input always available and never blocked by voice state.
- On-device speech recognition availability is browser/version-sensitive; the app must support manual operation with no speech support.
- Official Google AI docs now confirm `Gemma 4` availability in `E2B`, `E4B`, `26B A4B`, and `31B` sizes. The small `E2B/E4B` models include native audio support and are the only realistic candidates for optional on-device assistance in this project.
- Gemma should remain outside the critical path of numeric capture. Use it only for optional candidate suggestion in note fields and new field creation.

## Data and sync decisions
- Keep user-spoken numeric values as entered strings plus parsed numeric values when valid. Do not allow LLM correction on numeric fields.
- Derived fields such as `peelThicknessMm`, `acidContent`, and `sugarAcidRatio` should be stored as computed outputs with traceable source fields. In quality capture, the measured source is `peelThicknessX4`.
- Sync must be idempotent and record-level, with client-generated IDs and conflict-safe retries.

## Workbook-backed findings
- Source workbook reviewed: `/Users/kangmingoo/Downloads/25 노지감귤 생육데이터 통합.xlsx`
- Sheets in current use:
  - `비대조사` with 901 rows and 10 active columns
  - `품질조사` with 721 rows and 20 active columns
- Shared observed identifiers:
  - farms: `이원창`, `강남호`, `양승보`
  - labels: `A`, `B`, `C`
  - treatments: `시험`, `관행`
  - tree numbers: `1` to `3`
  - fruit numbers: `1` to `5`
- Legacy workbook formulas in `품질조사`:
  - `과피두께 = ROUND(과피두께x4 / 4, 1)` and `과피두께x4` is the measured input field
  - `산함량 = ROUND(적정 * 0.64, 2)`
  - `당산도 = ROUND(당도 / 산함량, 2)`

## Notes
- Do not commit secret files.
- Verify folder sharing with the service account before debugging API code.
- The workbook has now been reviewed. Future schema changes should preserve mapping compatibility with the current two survey sheets.
- The first runnable MVP scaffold now lives under `app/`.
