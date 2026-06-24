# Changelog

All notable changes to Transkryptor are documented in this file.

This changelog was introduced in version 5.1.0 and backfills earlier releases from the Git tag history, project documentation, and the local project memory bank. Older entries are therefore less detailed than entries maintained from 5.1.0 onward.

## [5.3.0] - 2026-06-24
### Ajouté
- Section "Prompts avancés" repliée dans la sidebar (5 presets + mode personnalisé)
- Persistance localStorage des préférences de prompt (clés transkryptor.synthesis.preset et transkryptor.synthesis.customPrompt)
- Endpoint /api/synthesize accepte un customPrompt optionnel (validation longueur ≤ 8000 caractères)
### Modifié
- SYNTHESIS_PROMPT par défaut conservé (preset "executive") pour compatibilité ascendante

## [5.2.0] - 2026-06-24
### Ajouté
- Interface multilingue FR / EN (sélecteur en haut de la sidebar)
- Module i18n vanilla maison (zéro dépendance)
- Persistance de la langue choisie en localStorage (clé : transkryptor.ui.language)
- Détection automatique de la langue du navigateur au premier lancement
- Support du paramètre URL ?lang=fr|en pour forcer la langue (utile pour démos)
### Modifié
- Emojis extraits des chaînes traduisibles (préservés via <span class="icon">) pour garantir la robustesse de la traduction
- Nom des fichiers exportés adapté à la langue active (transcription_xxx.txt vs transcript_xxx.txt)

## [5.1.0] - 2026-06-21

### Added

- Added this project changelog.
- Added a server-side model allowlist driven by `CLOUD_TEMPLE_ALLOWED_MODELS` in `.env`.
- Added `gemma4:31b` and `mistral-small4:119b` to the configured model list.
- Added model alias resolution for `/api/models`, allowing the UI to expose a configured alias such as `mistral-small4:119b` even when Cloud Temple publishes it under another primary model ID.

### Changed

- Made `.env` the single source of truth for analysis and synthesis models exposed by the UI.
- Removed the hardcoded fallback model allowlist from the backend.
- Simplified frontend model selection so the first backend-approved model is selected by default.
- Updated the application version from `5.0.0` to `5.1.0` across `VERSION`, npm metadata, UI fallbacks, and memory-bank headings.
- Updated configuration documentation to describe `CLOUD_TEMPLE_ALLOWED_MODELS` as required configuration.

### Security

- Enforced the backend allowlist on `/api/analyze` and `/api/synthesize`, preventing clients from bypassing the UI and calling unauthorized models directly.
- Kept the Cloud Temple API key server-side only.

### Validation

- Verified JavaScript syntax with `node --check` on touched client and server modules.
- Verified `/api/models` against the live Cloud Temple model endpoint on a temporary local server instance.
- Verified that a non-allowlisted model is rejected by `/api/analyze`.

### Known Limitations

- Full end-to-end validation with a real audio file remains to be performed.

## [5.0.0] - 2026-04-21

### Added

- Introduced the Transkryptor v5 architecture focused exclusively on Cloud Temple LLMaaS SecNumCloud.
- Added `/api/version`, backed by the root `VERSION` file and displayed in the application header.
- Added server-sent event logging scoped by client session.
- Added a Cloud Temple dark theme aligned with the mcp-vault design language.
- Added a redesigned header with Cloud Temple branding, SecNumCloud badge, and application version.
- Added a dashboard-oriented UI with stats, processing progress, chunk visualization, charts, and live server logs.
- Added increased generation budgets for LLM tasks:
  - `16384` max tokens for analysis.
  - `8192` max tokens for synthesis.

### Changed

- Reworked the backend as a simplified Node.js/Express proxy to Cloud Temple APIs.
- Centralized API credentials on the server through `.env`.
- Reworked the frontend around Cloud Temple-only configuration and model selection.
- Updated transcription, analysis, and synthesis flows to use Cloud Temple endpoints only.
- Updated dependency usage and removed packages no longer needed after the provider simplification.

### Removed

- Removed OpenAI and Anthropic provider branches from backend workflows.
- Removed user-supplied API key handling from the frontend.
- Removed provider selection from the UI.
- Removed `/api/validate-key` and `/api/providers`.
- Removed browser-side persistence of third-party API keys.

### Security

- Eliminated client-side handling of user API keys.
- Reduced the external provider surface to Cloud Temple LLMaaS SecNumCloud only.

### Known Limitations

- The v5 refactor was marked complete in project memory, but full validation with a real audio file was still listed as pending.

## [4.0.14] - 2025-08-28

### Changed

- Updated Docker Compose configuration.

### Fixed

- Included the production and transcription stability fixes delivered between `v4.0.12` and `v4.0.14`.

## [4.0.12] - 2025-08-26

### Changed

- Updated project README documentation.
- Updated environment example configuration.

### Fixed

- Stabilized the application for production usage.

## [4.0.0] - 2025-08-26

### Added

- Introduced the v4 client-server architecture.
- Added a Node.js/Express API gateway backend.
- Added a vanilla JavaScript single-page frontend organized into modules.
- Added multi-provider support:
  - Cloud Temple SecNumCloud for transcription and analysis.
  - OpenAI for transcription.
  - Anthropic for analysis.
- Added parallel audio transcription by chunks.
- Added semantic batch processing for text analysis.
- Added executive synthesis from analysis output.
- Added live server logs and processing visibility in the UI.
- Added progressive display of results.

### Changed

- Reworked the application into a modern, responsive, multi-provider audio transcription, analysis, and synthesis platform.
- Improved UX around processing progress, statistics, and result downloads.
- Updated project screenshot and documentation.

### Security

- Moved external API calls behind a backend gateway.
- Kept provider API keys out of the frontend request path where possible.

## [3.1.0] - 2025-02-24

### Changed

- Finalized the v3.1.0 release line.

### Notes

- Detailed v3 release notes were not available when this changelog was backfilled.

## [2.1.0] - 2025-01-30

### Changed

- Released the v2.1.0 line.

### Notes

- Detailed v2.1.0 release notes were not available when this changelog was backfilled.

## [2.0.1] - 2025-01-22

### Fixed

- Corrected progress handling according to the Git tag message.

## [2.0.0] - 2025-01-22

### Added

- Released the v2.0.0 final version.

### Notes

- Detailed v2.0.0 release notes were not available when this changelog was backfilled.
