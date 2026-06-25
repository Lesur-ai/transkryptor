# Transkryptor v6.0.0

Transkryptor is a web application for audio transcription, analysis and synthesis powered exclusively by Cloud Temple LLMaaS. Version 6.0 adds a French/English interface, multilingual transcription and synthesis, configurable synthesis prompts and optional participant detection through LLM-based text analysis.

![Transkryptor screenshot](images/screenshoot.png)

## Table of Contents

- [Overview](#overview)
- [What's New in v6.0](#whats-new-in-v60)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Local Installation](#local-installation)
- [Configuration](#configuration)
- [Docker](#docker)
- [Usage](#usage)
- [Server API](#server-api)
- [Project Structure](#project-structure)
- [Security and Compliance](#security-and-compliance)
- [Known Limitations](#known-limitations)
- [Release and Validation](#release-and-validation)
- [License](#license)

## Overview

Transkryptor is a technical demonstrator for integrating Cloud Temple LLMaaS in a sovereign SecNumCloud-oriented context. The browser handles the user experience and audio preprocessing, while the Node.js server acts as an API Gateway: it centralizes the Cloud Temple API key, enforces a model allowlist and proxies transcription, analysis, synthesis and text-based diarization requests.

The core workflow is straightforward: drop an audio file, monitor chunked transcription, obtain a structured analysis, generate an actionable synthesis and, when useful, display the conversation by speaker.

## What's New in v6.0

- French / English user interface with persisted language selection.
- Multilingual transcription with an optional language hint sent to Cloud Temple Whisper.
- Synthesis in a target language that can differ from the audio language.
- Five synthesis presets: executive summary, meeting minutes, actions and decisions, corrected verbatim, thematic analysis.
- Custom prompt mode with an 8000-character server-side limit.
- Optional participant detection through LLM analysis, with streaming display, Speakers tab, local speaker renaming and text export.
- Diarization quality safeguards: invalid segment IDs are filtered, coverage is computed, results below 50% coverage fail, and partial results between 50% and 99% display a client warning.
- Application version aligned to `6.0.0` in `VERSION`, `package.json` and `/api/version`.

## Features

### Audio Transcription

- UI accepts MP3, WAV and M4A files.
- Audio is split into 30-second chunks with a small overlap.
- Parallel batch processing in the browser.
- Mono 24 kHz resampling before upload.
- Cloud Temple `/v1/audio/transcriptions` integration.
- Whisper segments are collected when `verbose_json` is accepted, with a graceful fallback to `json`.

### Analysis and Synthesis

- Semantic analysis through Cloud Temple Chat Completions.
- Model selection constrained by a strict server-side allowlist.
- Generation budgets: 16384 tokens for analysis, 8192 for synthesis.
- Executive synthesis or preset-guided synthesis.
- Synthesis output in French, English or another supported target language.

### Languages

- UI: French and English.
- Audio language: auto-detection or explicit ISO 639-1 hint from the interface.
- Synthesis language: same as transcription by default, or explicit target language.
- Detected-language badge when Whisper returns useful language metadata.

### Participant Detection

The v6.0 diarization feature is intentionally text-based: Transkryptor does not analyze voice fingerprints. It sends the transcript and timestamped Whisper segments to a Cloud Temple LLM, which infers speaking turns from the content.

Available capabilities:

- opt-in toggle, disabled by default;
- optional expected speaker count;
- streamed speaker turns while generation is running;
- dedicated Speakers tab;
- inline display in the Transcription tab;
- speaker renaming persisted in `localStorage` per file;
- export of the Speakers tab.

### Observability

- Real-time server logs through Server-Sent Events.
- Chunk-by-chunk progress grid.
- Processing stats: progress, speed, processed size, elapsed time and average time.
- Client-side performance chart.

## Architecture

```text
Browser
  ├─ Vanilla JavaScript SPA
  ├─ Web Audio API decoding
  ├─ 24 kHz mono WAV chunking
  ├─ i18n UI, progress, results, exports
  └─ HTTP/SSE calls to the backend

Node.js / Express server
  ├─ Serves static assets
  ├─ Stores temporary uploads on disk
  ├─ Reads VERSION and .env
  ├─ Enforces CLOUD_TEMPLE_ALLOWED_MODELS
  ├─ Proxies Cloud Temple LLMaaS
  └─ Streams logs and diarization events over SSE

Cloud Temple LLMaaS
  ├─ /v1/models
  ├─ /v1/audio/transcriptions
  └─ /v1/chat/completions
```

The frontend never receives the Cloud Temple API key. All external calls go through the Express server.

## Requirements

- Node.js 20 LTS recommended.
- npm compatible with `package-lock.json` v3.
- A Cloud Temple LLMaaS API key.
- A modern browser with Web Audio API support.
- Server network access to `https://api.ai.cloud-temple.com`.
- Browser network access to the Chart.js and Marked CDNs used by the current UI.

## Local Installation

```bash
git clone https://github.com/Lesur-ai/transkryptor.git
cd transkryptor
npm ci
cp .env.example .env
```

Edit `.env`, then start the server:

```bash
npm start
```

By default, the application is available at:

```text
http://localhost:3000
```

Development mode uses the following script when `nodemon` is installed in the environment:

```bash
npm run dev
```

## Configuration

The `.env` file is required to use Cloud Temple.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | HTTP port for the Express server. |
| `CLOUD_TEMPLE_API_KEY` | Yes | None | Cloud Temple LLMaaS API key, used server-side only. |
| `CLOUD_TEMPLE_ALLOWED_MODELS` | Yes | None | Exact list of models exposed in the UI and accepted by `/api/analyze`, `/api/synthesize` and `/api/diarize`. |

Example:

```env
PORT=3000
CLOUD_TEMPLE_API_KEY=votre_cle_api_cloud_temple
CLOUD_TEMPLE_ALLOWED_MODELS=qwen3.5:397b,qwen3.6:35b-a3b,qwen3:235b,gemma4:31b,mistral-small3.2:24b,mistral-small4:119b
```

The order of `CLOUD_TEMPLE_ALLOWED_MODELS` defines the display order and the preferred default model. The server also resolves aliases returned by Cloud Temple, but rejects any request that does not match the configured list.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The service listens on `http://localhost:3000`.

To explicitly name the release image:

```bash
APP_VERSION=6.0.0 docker compose build
```

The container runs as the `node` user, stores temporary uploads in `src/server/uploads`, and deletes them after processing.

## Usage

1. Choose the interface language.
2. Select an allowed Cloud Temple model.
3. Drop an MP3, WAV or M4A audio file.
4. Select the audio language, or keep auto-detection.
5. Select the synthesis language.
6. Enable participant detection when the content is suitable.
7. Start processing and monitor chunks, stats and server logs.
8. Read the Transcription, Analysis, Synthesis and Speakers tabs.
9. Adjust the synthesis preset or enter a custom prompt.
10. Download the active tab result.

## Server API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/version` | Returns the version read from `VERSION`. |
| `GET` | `/api/models?clientId=...` | Fetches Cloud Temple models and applies the server allowlist. |
| `GET` | `/api/logs?clientId=...` | Opens the SSE stream for server logs. |
| `POST` | `/api/transcribe` | Receives an audio chunk and proxies it to Cloud Temple Whisper. |
| `POST` | `/api/analyze` | Analyzes a text block with an allowed model. |
| `POST` | `/api/synthesize` | Generates a synthesis from the analysis. |
| `POST` | `/api/diarize` | Streams text-based speaker detection over SSE. |

Analysis, synthesis and diarization endpoints reject models that are absent from `CLOUD_TEMPLE_ALLOWED_MODELS`.

## Project Structure

```text
transkryptor/
├── src/
│   ├── client/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── i18n/
│   │   │   ├── en.json
│   │   │   └── fr.json
│   │   ├── img/
│   │   │   └── logo-cloudtemple.svg
│   │   ├── js/
│   │   │   ├── ui/
│   │   │   │   ├── chart.js
│   │   │   │   ├── progress.js
│   │   │   │   ├── results.js
│   │   │   │   └── stats.js
│   │   │   ├── analysisProcessor.js
│   │   │   ├── apiService.js
│   │   │   ├── audioProcessor.js
│   │   │   ├── audioUtils.js
│   │   │   ├── download.js
│   │   │   ├── i18n.js
│   │   │   ├── main.js
│   │   │   ├── prompts.js
│   │   │   └── state.js
│   │   └── index.html
│   └── server/
│       ├── logger.js
│       ├── server.js
│       └── uploads/
├── docs/
├── images/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── VERSION
├── changelog.md
├── package.json
├── package-lock.json
├── readme.md
└── README_EN.md
```

## Security and Compliance

- Cloud Temple is the only external provider used by v6.0.
- The API key stays server-side in `.env`.
- The frontend no longer accepts OpenAI or Anthropic API keys.
- Usable models are controlled by a server-side allowlist.
- Uploaded files are temporarily stored on disk and deleted after processing.
- Logs avoid exposing secrets.
- SecNumCloud compliance depends on the effective use of qualified Cloud Temple services and on the deployment environment.

## Known Limitations

- Diarization is text-based LLM inference, not biometric audio diarization. It works best on interviews, Q&A sessions and structured conversations.
- Speaker timestamps depend on Whisper segments. If `verbose_json` is unavailable and the fallback `json` is used, diarization may lose timestamp precision.
- Prompt presets are written in French; the server prepends a language instruction when a non-French output is requested.
- Chart.js and Marked are loaded from CDNs in `src/client/index.html`.
- Very long files can be memory-intensive in the browser during decoding and WAV conversion.
- The project does not yet include a complete automated test suite; release validation relies on static checks, server startup and manual functional testing with a Cloud Temple key.

## Release and Validation

Version 6.0.0 is documented in:

- `VERSION`
- `package.json`
- `package-lock.json`
- `changelog.md`
- `docs/releases/v6.0.0.md`

Recommended validation commands before publication:

```bash
node --check src/server/server.js
node --check src/client/js/main.js
node --check src/client/js/apiService.js
node --check src/client/js/audioProcessor.js
node --check src/client/js/analysisProcessor.js
node --check src/client/js/download.js
node --check src/client/js/i18n.js
node --check src/client/js/prompts.js
node --check src/client/js/state.js
node --check src/client/js/ui/chart.js
node --check src/client/js/ui/results.js
node --check src/client/js/ui/stats.js
npm audit
npm start
```

Recommended manual checks:

- open `/api/version` and verify `6.0.0`;
- load the UI in French and English;
- fetch models from Cloud Temple;
- transcribe a short audio file;
- run synthesis with the main presets;
- run synthesis in another language;
- enable diarization on a multi-speaker audio file;
- download the Transcription, Analysis, Synthesis and Speakers tabs.

## License

This repository is distributed under GPL-3.0. See `LICENSE.txt`.
