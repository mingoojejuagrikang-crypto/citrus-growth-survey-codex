# Shared Debug Log

Use this file to avoid repeating the same problem.

## Template
## YYYY-MM-DD | agent-name
- Symptom:
- Root cause:
- Fix/workaround:
- Status:

## 2026-04-15 | pm
- Symptom: Initial planning request referenced an attached Excel file, but no `.xlsx`/`.xls`/`.csv` source was present in the repository workspace at first review.
- Root cause: The source workbook was not yet provided in the local project context.
- Fix/workaround: Proceeded provisionally, then reviewed `/Users/kangmingoo/Downloads/25 노지감귤 생육데이터 통합.xlsx` once provided and replaced the provisional schema assumptions with workbook-backed findings.
- Status: resolved

## 2026-04-15 | researcher
- Symptom: An earlier verification pass concluded that the prompt’s `Gemma 4 E2B` reference was mismatched.
- Root cause: Search results were incomplete and did not surface the March 31, 2026 Gemma 4 release pages during the first pass.
- Fix/workaround: Re-checked official sources. `Gemma 4` is documented by Google AI for Developers with `E2B`, `E4B`, `26B A4B`, and `31B` sizes, and the launch blog confirms E2B/E4B audio support.
- Status: resolved

## 2026-04-15 | pm
- Symptom: There was a temporary interpretation conflict around `과피두께x4` and `과피두께`.
- Root cause: The prompt text suggested `과피두께` should be the entered source and `x4` the derived value, but the user later clarified that `과피두께x4` is the real measured field and the workbook already reflects that.
- Fix/workaround: Revert the app design to use `과피두께x4` as the primary entered measurement and `과피두께 = ROUND(과피두께x4 / 4, 1)` as the derived field.
- Status: resolved

## 2026-04-15 | pm
- Symptom: `npm create vite@latest . -- --template react-ts` canceled during scaffold setup.
- Root cause: The repository root already contains project-control files, so the Vite initializer refused the non-empty directory flow.
- Fix/workaround: Keep root-level planning artifacts in place and scaffold the runnable web app in a dedicated `app/` directory.
- Status: resolved

## 2026-04-15 | pm
- Symptom: `vite-plugin-pwa` installation failed with an `ERESOLVE` peer dependency conflict.
- Root cause: The available `vite-plugin-pwa` release in npm does not yet declare compatibility with the scaffolded Vite 8 toolchain.
- Fix/workaround: Avoid forcing an incompatible plugin. Implement the MVP PWA layer with a manual `manifest.webmanifest`, service worker, and explicit registration so the app remains installable and offline-capable without dependency mismatch risk.
- Status: resolved
