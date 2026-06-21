# Transkryptor v4.0.14

![Screenshot](images/screenshoot.png)

## Table of Contents
- [Transkryptor v4.0.14](#transkryptor-v4014)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Key Features](#key-features)
  - [Architecture](#architecture)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Usage](#usage)
  - [File Structure](#file-structure)
  - [Roadmap](#roadmap)
  - [License](#license)

## Introduction

Transkryptor v4 is a complete overhaul of the application, transforming it into a modern, secure, and multi-provider platform for audio content transcription, analysis, and synthesis. The main goal of this version is to offer maximum flexibility to the user while ensuring an intuitive and responsive user experience.

This application serves as a **technology demonstrator** for the **Cloud Temple LLMaaS** offering, showcasing the ease of integration and power of a sovereign, **SecNumCloud-qualified** platform.

## Key Features

- **Multi-Provider Support**: Choose between the **Cloud Temple SecNumCloud** ecosystem (transcription and analysis) or the OpenAI (transcription) + Anthropic (analysis) combination.
- **Modern and Responsive UI**: A completely redesigned, clean, and responsive user interface for a clear and intuitive experience.
- **Secure Backend (API Gateway)**: All API keys and external calls are managed by a Node.js backend server. No keys are exposed on the client side, ensuring maximum security.
- **Detailed Real-Time Monitoring**:
    - Visualize processing progress with a status grid for each file chunk.
    - Track advanced statistics (speed, elapsed time, etc.).
    - View live server logs for full process transparency.
- **Robust Parallel Processing**:
    - **Transcription**: Audio files are chunked, transcribed in parallel, and reassembled. The processing has been enhanced to handle various audio formats (stereo/mono) and prevent errors.
    - **Analysis**: The transcribed text is split into semantic batches and analyzed in parallel.
    - **Error Handling**: A retry system with exponential backoff ensures robust processing.
- **Executive Synthesis**: Generate a structured summary (executive summary, key points, action items) from the analysis with a single click, with the option to change models to refine the result.
- **User Experience Enhancements**:
    - **Key Persistence**: API keys for OpenAI and Anthropic are saved locally in your browser.
    - **Key Validation**: API keys are tested before launching any processing to avoid costly errors.
    - **Progressive Display**: Results appear as they are processed.

## Architecture

v4 adopts a modern and secure client-server architecture:
- **Frontend**: A Single Page Application (SPA) built with **vanilla JavaScript** and a modular approach. It manages the user interface and communicates only with its own backend. The application state is managed centrally to ensure data consistency.
- **Backend**: A **Node.js/Express** server implementing the **API Gateway** design pattern. It receives requests from the frontend, authenticates them, enriches them with API keys securely stored in environment variables, and relays them to the appropriate external providers (Cloud Temple, OpenAI, Anthropic).

## Installation

1.  **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) (version 18.x or higher) installed.

2.  **Clone the repository**:
    ```bash
    git clone https://github.com/chrlesur/transkryptor.git
    cd transkryptor
    ```

3.  **Install dependencies**:
    ```bash
    npm install
    ```

4.  **Run the application**:
    ```bash
    npm start
    ```

5.  Open your browser and navigate to `http://localhost:3000`.

## Configuration

1.  **Create a `.env` file** in the project root by copying the `.env.example` template.
2.  **Fill in the API key** in this `.env` file. This key is used by the server and is never exposed to the client.
    -   `CLOUD_TEMPLE_API_KEY`: Your API key for the Cloud Temple API.
    -   `CLOUD_TEMPLE_ALLOWED_MODELS`: Exact comma-separated list of models exposed in the interface. The order also defines the default selected model.

## Usage

1.  **Choose the Cloud Temple SecNumCloud model** exposed by the server.
2.  **Configure**:
    -   For Cloud Temple, select the desired analysis model from the dynamic list.
3.  **Select an audio file** (.mp3, .wav, .m4a).
4.  **Click "Start Processing"**.
5.  **Follow the progress** in real time.
6.  Once the analysis is complete, the **"Start Synthesis"** button will become active.
7.  **Download** your results at any time.
8.  Click the **"About"** button to understand the detailed workings of the demonstrator.

## File Structure

The project is now organized in a `src/` folder with a clear separation between client and server.

```
transkryptor/
├── src/
│   ├── client/
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── ui/         # UI management modules
│   │   │   ├── analysisProcessor.js
│   │   │   ├── apiService.js
│   │   │   ├── audioProcessor.js
│   │   │   ├── main.js     # Main entry point
│   │   │   └── ...
│   │   └── index.html
│   └── server/
│       ├── logger.js
│       └── server.js       # Express server
├── .env
├── package.json
└── readme.md
```

## Roadmap

-   Add support for more service providers.
-   Implement a user authentication system to manage projects.
-   Support more audio/video formats.

## License

GPL 3.0
