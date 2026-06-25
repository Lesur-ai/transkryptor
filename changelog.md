# Changelog

All notable changes to Transkryptor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog was introduced in version 5.1.0 and backfills earlier releases from
the Git tag history, project documentation, and the local project memory bank.
Older entries are therefore less detailed than entries maintained from 5.1.0 onward.

## [Unreleased]

## [6.1.1] - 2026-06-25

Transkryptor v6.1.1 is a documentation and installer hotfix for the v6.1
visual refresh.

### Added

- `scripts/install.sh`, a macOS/Linux one-line installer intended for
  `curl | bash` usage. It installs Transkryptor into the platform-appropriate
  user directory, copies `.env.example` to `.env` when needed, runs `npm ci`,
  starts the service on `localhost:3000`, and opens the default browser.
- README documentation for the one-line installer, including macOS/Linux
  install locations, override variables, and the current Windows recommendation
  via WSL.
- Release notes document at `docs/releases/v6.1.1.md`.

### Changed

- Bumped application metadata and client/server fallback versions to `6.1.1`.
- Refreshed README content with the v6.1 design identity and corrected clone
  URL for the `Lesur-ai/transkryptor` repository.

### Fixed

- Interface language detection now reads the browser language preference list
  (`navigator.languages`) before falling back to the default language, so the
  French/English selector matches the user's browser settings on first load.
- Replaced the stale README screenshot with a current v6.1 lesur.ai UI capture
  stored as a real PNG file.

## [6.1.0] - 2026-06-25

Transkryptor v6.1.0 ships a full visual refresh of the web interface under the
lesur.ai design language while preserving the existing layout, every JS-bound
ID and class, and the Cloud Temple LLMaaS backend integration.

### Added

- New lesur.ai design language: light cream main canvas, dark navy
  sidebar/header/logs panel, cyan (#00A7C7) primary accent and amber
  (#F59E0B) secondary accent, Newsreader serif for display text.
- T-shape inline-SVG brand mark in the header (five nodes connected by a T
  skeleton), faithful to the design source.
- "Built with ❤️ by lesur.ai" credit beneath the *Advanced prompts* panel
  with an external link to lesur.ai.
- Chart color tokens exposed as CSS custom properties (`--chart-line`,
  `--chart-fill`, `--chart-axis`, `--chart-grid-y`, `--chart-grid-x`) — the
  performance chart reads them at init, so the chart follows the active
  design palette automatically.
- New `README.md` (English, now the default) and `README_FR.md` (French),
  with language switcher links at the top. Content fully refreshed for the
  v6 feature set: Cloud Temple-only backend, diarization, multilingual UI,
  synthesis presets.
- Chart.js (UMD) et marked sont self-hostés sous `src/client/vendor/`. Plus aucun chargement depuis cdn.jsdelivr.net.

### Changed

- Server renders `index.html` from an in-memory template at request time
  (read once at startup, lightweight substitution per request). The static
  middleware is now configured with `{ index: false }` so the renderer
  always handles the document.
- `chart.js` no longer hardcodes colors — it reads them from CSS variables
  on `document.documentElement`.
- `i18n.js` selects the page title based on the active design context.
- Header tightened: 52px height, brand mark + serif "Transkryptor" wordmark,
  version chip in the monospace style.
- Mobile rule under 768px: the sidebar collapses to icon-only; the
  diarization checkbox stays visible and the action button icons are
  preserved (the previous attempt hid both unintentionally).

### Removed

- Stale v4.0.14 documentation files (`readme.md` and `README_EN.md` in
  their previous form). They are replaced by the refreshed `README.md` /
  `README_FR.md` pair.

### Fixed

- WCAG AA contrast restored on the diarization hint sentence inside the
  dark sidebar.
- Inline `code` spans inside results now use the canvas text color on the
  cyan-tinted background instead of cyan-on-cyan.
- `.chunk.pending` reuses `var(--border)` instead of a duplicate hard-coded
  hex value.
- Empty `.config-section {}` ruleset removed.
- Newsreader Google Fonts request now also loads italic axes (the tagline
  cut used to be a browser-synthesized oblique).

### Notes

- The Cloud Temple LLMaaS integration is unchanged. No new backend
  dependency, no new external service.
- Whisper, chat-completion, and diarization endpoints all keep their
  v6.0.0 contracts. Existing `.env` files continue to work as-is.

## [6.0.0] - 2026-06-25

Transkryptor v6.0.0 completes the Cloud Temple-only v5 line with a multilingual
interface, configurable synthesis prompts, multilingual output, and optional
LLM-based participant detection.

### Added

- French and English user interface with persisted language selection.
- Audio language selector with auto-detection and ISO 639-1 language hints sent to Cloud Temple Whisper.
- Separate synthesis language selector, defaulting to the transcription language.
- Detected-language badge when Whisper returns useful language metadata.
- Advanced synthesis prompts panel with five presets:
  - executive summary;
  - meeting minutes;
  - actions and decisions;
  - corrected verbatim;
  - thematic analysis.
- Custom synthesis prompt mode, persisted in `localStorage`.
- Server-side `customPrompt` support on `POST /api/synthesize`, limited to 8000 characters.
- Optional participant detection based on text analysis through Cloud Temple LLMaaS.
- "Detect participants" toggle and optional expected speaker count field.
- New `POST /api/diarize` Server-Sent Events endpoint.
- Streaming speaker-turn display while diarization is running.
- New Speakers tab with approximate timestamps mapped to Whisper segments.
- Inline diarized view in the Transcription tab when participant detection is enabled.
- Local speaker renaming persisted per file in `localStorage`.
- Download support for the Speakers tab.
- New i18n namespaces and strings for `language`, `prompts`, `diarization`, and `speakers`.
- Release notes document at `docs/releases/v6.0.0.md`.

### Changed

- `audioProcessor.processAndTranscribeInChunks` now returns `{ text, segments }` instead of a raw string.
- Transcription now requests `verbose_json` first to collect Whisper segments, with a graceful fallback to `json`.
- Whisper segment timestamps are offset per chunk and normalized into a global timeline.
- Application state now stores `whisperSegments`, `diarization`, `speakerNames`, language preferences, prompt preferences, and diarization state.
- Analysis output now follows the selected synthesis language for a coherent end-user result.
- Synthesis prompt building now combines custom prompts with explicit target-language instructions.
- Diarization LLM output was reduced to speaker IDs and segment IDs; text is reconstructed server-side from Whisper segments.
- Cloud Temple reasoning models are called with `enable_thinking:false` for analysis, synthesis, and diarization.
- Diarization now filters invalid or hallucinated segment IDs before computing coverage.
- Diarization retries global parsing when streamed coverage is below 90%.
- Diarization returns a partial-result warning when coverage is between 50% and 99%.
- README files were fully rewritten for the Cloud Temple-only v6.0 architecture.
- The README screenshot was replaced with a current v6.0 interface capture.
- npm package metadata now declares `GPL-3.0-only`, matching `LICENSE.txt`.

### Fixed

- Fixed multilingual synthesis being bypassed when a preset or custom prompt was selected.
- Fixed transcription result handling so Whisper segments are preserved for diarization.
- Fixed segment ID alignment between Whisper output and LLM diarization responses.
- Fixed Speakers tab download serialization.
- Fixed periodic diarization streaming repainting over another active tab after the user navigates away.
- Fixed the client-side gap where partial diarization coverage could complete without a visible warning.

### Security

- Kept Cloud Temple as the only external AI provider used by the application.
- Kept the Cloud Temple API key server-side only.
- Preserved strict server-side model allowlist enforcement for analysis, synthesis, and diarization.
- Continued to avoid adding external diarization services, Docker images, Python runtimes, or non-Cloud Temple AI dependencies.

## [5.4.0] - 2026-06-24

### Added

- Audio language selector in the sidebar with auto-detection and 15 main ISO 639-1 language options.
- Separate synthesis language selector, defaulting to the transcription language.
- `language` parameter forwarding to Cloud Temple Whisper.
- English synthesis prompt and generic target-language instruction for other supported languages.
- Detected-language badge when Whisper returns a language different from the selected hint.
- `localStorage` persistence for transcription and synthesis language preferences.

### Changed

- Intermediate analysis remains in the source language to preserve correction quality.
- Custom prompts take precedence over the default target-language synthesis prompt when provided.

## [5.3.0] - 2026-06-24

### Added

- Collapsible advanced prompts section in the sidebar.
- Five synthesis presets plus custom prompt mode.
- `localStorage` persistence for selected synthesis preset and custom prompt.
- Optional `customPrompt` support on `/api/synthesize`.

### Changed

- Preserved the default executive synthesis prompt as the compatibility fallback.

## [5.2.0] - 2026-06-24

### Added

- French and English interface support.
- Zero-dependency vanilla JavaScript i18n module.
- UI language persistence in `localStorage`.
- Browser-language detection on first launch.
- `?lang=fr|en` URL parameter support for demos and explicit language forcing.

### Changed

- Extracted emoji markers from translatable strings to make translation updates more robust.
- Adapted exported transcription filenames to the active UI language.

## [5.1.0] - 2026-06-21

### Added

- Project changelog.
- Server-side model allowlist driven by `CLOUD_TEMPLE_ALLOWED_MODELS` in `.env`.
- `gemma4:31b` and `mistral-small4:119b` to the configured model list.
- Model alias resolution for `/api/models`, allowing the UI to expose configured aliases even when Cloud Temple publishes a different primary model ID.

### Changed

- Made `.env` the single source of truth for analysis and synthesis models exposed by the UI.
- Removed the hardcoded fallback model allowlist from the backend.
- Simplified frontend model selection so the first backend-approved model is selected by default.
- Updated the application version from `5.0.0` to `5.1.0`.
- Updated configuration documentation to describe `CLOUD_TEMPLE_ALLOWED_MODELS` as required configuration.

### Security

- Enforced the backend allowlist on `/api/analyze` and `/api/synthesize`.
- Kept the Cloud Temple API key server-side only.

## [5.0.0] - 2026-04-21

### Added

- Transkryptor v5 architecture focused exclusively on Cloud Temple LLMaaS SecNumCloud.
- `/api/version`, backed by the root `VERSION` file and displayed in the application header.
- Server-Sent Events logging scoped by client session.
- Cloud Temple dark theme aligned with the mcp-vault design language.
- Redesigned header with Cloud Temple branding, SecNumCloud badge, and application version.
- Dashboard-oriented UI with stats, processing progress, chunk visualization, charts, and live server logs.
- Increased LLM generation budgets:
  - 16384 max tokens for analysis;
  - 8192 max tokens for synthesis.

### Changed

- Reworked the backend as a simplified Node.js/Express proxy to Cloud Temple APIs.
- Centralized API credentials on the server through `.env`.
- Reworked the frontend around Cloud Temple-only configuration and model selection.
- Updated transcription, analysis, and synthesis flows to use Cloud Temple endpoints only.
- Updated dependency usage after the provider simplification.

### Removed

- OpenAI and Anthropic provider branches from backend workflows.
- User-supplied API key handling from the frontend.
- Provider selection from the UI.
- `/api/validate-key` and `/api/providers`.
- Browser-side persistence of third-party API keys.

### Security

- Eliminated client-side handling of user API keys.
- Reduced the external AI provider surface to Cloud Temple LLMaaS SecNumCloud only.

## [4.0.14] - 2025-08-28

### Changed

- Updated Docker Compose configuration.

### Fixed

- Included production and transcription stability fixes delivered between `v4.0.12` and `v4.0.14`.

## [4.0.12] - 2025-08-26

### Changed

- Updated project README documentation.
- Updated environment example configuration.

### Fixed

- Stabilized the application for production usage.

## [4.0.0] - 2025-08-26

### Added

- v4 client-server architecture.
- Node.js/Express API gateway backend.
- Vanilla JavaScript single-page frontend organized into modules.
- Multi-provider support:
  - Cloud Temple SecNumCloud for transcription and analysis;
  - OpenAI for transcription;
  - Anthropic for analysis.
- Parallel audio transcription by chunks.
- Semantic batch processing for text analysis.
- Executive synthesis from analysis output.
- Live server logs and processing visibility in the UI.
- Progressive display of results.

### Changed

- Reworked the application into a modern, responsive, multi-provider audio transcription, analysis, and synthesis platform.
- Improved UX around processing progress, statistics, and result downloads.
- Updated project screenshot and documentation.

### Security

- Moved external API calls behind a backend gateway.
- Kept provider API keys out of the frontend request path where possible.

## [3.1.0] - 2025-02-24

### Changed

- Finalized the v3.1.0 "Fact Checking" release line.

## [2.1.0] - 2025-01-30

### Changed

- Released the v2.1.0 line.

## [2.0.1] - 2025-01-22

### Fixed

- Corrected progress handling according to the Git tag message.

## [2.0.0] - 2025-01-22

### Added

- Released the v2.0.0 final version.

[Unreleased]: https://github.com/Lesur-ai/transkryptor/compare/v6.1.1...HEAD
[6.1.1]: https://github.com/Lesur-ai/transkryptor/compare/v6.1.0...v6.1.1
[6.1.0]: https://github.com/Lesur-ai/transkryptor/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/Lesur-ai/transkryptor/compare/v5.1.0...v6.0.0
[5.1.0]: https://github.com/Lesur-ai/transkryptor/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/Lesur-ai/transkryptor/compare/v4.0.14...v5.0.0
[4.0.14]: https://github.com/Lesur-ai/transkryptor/compare/v4.0.12...v4.0.14
[4.0.12]: https://github.com/Lesur-ai/transkryptor/compare/v4.0.0...v4.0.12
[4.0.0]: https://github.com/Lesur-ai/transkryptor/releases/tag/v4.0.0
[3.1.0]: https://github.com/Lesur-ai/transkryptor/releases/tag/v3.1.0
[2.1.0]: https://github.com/Lesur-ai/transkryptor/releases/tag/v2.1.0
[2.0.1]: https://github.com/Lesur-ai/transkryptor/releases/tag/v2.0.1
[2.0.0]: https://github.com/Lesur-ai/transkryptor/releases/tag/v2.0.0
