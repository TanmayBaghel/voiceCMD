# 🎙️ cmdVoice - Customized Rhasspy Voice Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-green.svg)](https://nodejs.org/)
[![Rhasspy API](https://img.shields.io/badge/Rhasspy-Compatible-purple.svg)](https://rhasspy.readthedocs.io/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen.svg)](https://tanmaybaghel.github.io/voiceCMD/)

**cmdVoice** is a modern, lightweight voice assistant and system command engine built on the architecture of **Rhasspy**. It provides a real-time web dashboard, Web Audio spectrum visualizer, Rhasspy-compatible REST API endpoints, custom NLU intent parsing via `sentences.ini`, and macOS desktop action execution.

---

## 🌐 Live Web Demo

Test the interactive web client online:
👉 **[https://tanmaybaghel.github.io/voiceCMD/](https://tanmaybaghel.github.io/voiceCMD/)**

---

## ✨ Features

- **🎙️ Real-Time Voice Input & Audio Spectrum**: Live Web Audio API canvas visualizer displaying microphone frequency waveforms.
- **⚡ Rhasspy REST & WebSocket API**: Implements standard Rhasspy REST endpoints (`/api/text-to-intent`, `/api/speech-to-text`, `/api/train`, `/api/intents`).
- **🧠 Natural Language Understanding (NLU)**: Custom `sentences.ini` grammar parser with dynamic slot extraction, variable lists, and fuzzy string fallback.
- **🚀 macOS Application Launcher & Action Dispatcher**: Open desktop applications (`Safari`, `Chrome`, `Terminal`, `Finder`), check system stats (`uptime`, `disk usage`), adjust volume, set timers, and run terminal scripts.
- **🔊 Speech Feedback (TTS)**: Web Speech Synthesis integration for immediate spoken responses.
- **🛠️ Interactive Sentence Rules Editor**: Edit `sentences.ini` directly in the browser and recompile NLU rules with a single click.
- **💻 CLI Runner**: Execute voice and text commands straight from your terminal via `node cmdVoice.js`.

---

## 🏗️ Architecture

Rhasspy uses the **Hermes Protocol (MQTT)** to communicate across independent microservices:

```
+-----------------------------------------------------------------------------------+
|                                  Rhasspy Ecosystem                                |
|                                                                                   |
|  [ Mic Audio ] ---> [ Wake Word ] ---> [ ASR (STT) ] ---> [ NLU Intent Parser ]   |
|                                                                 |                 |
|                                                                 v                 |
|  [ Speaker ] <--- [ TTS Engine ] <--- [ Dialogue Mgr ] <--- [ Intent Handler ]    |
+-----------------------------------------------------------------------------------+
```

### cmdVoice Hybrid Architecture

**cmdVoice** unifies these services into a single zero-dependency Node.js engine and responsive web interface:

```
+-----------------------------------------------------------------------------------------+
|                                  cmdVoice System Flow                                   |
|                                                                                         |
|  [ Browser Mic / Audio Canvas ]  ----\                                                  |
|                                       +--> [ Speech-to-Text ] ---> [ NLU Engine ]       |
|  [ CLI / Terminal Input ]        ----/                              (sentences.ini)     |
|                                                                            |            |
|                                                                            v            |
|  [ Glassmorphic Web UI Log ]     <--- [ Spoken Response (TTS) ] <--- [ Action Handler ]   |
|  (Spectrum & Live Intents)             (Web Speech Synthesis)       (System Commands)   |
+-----------------------------------------------------------------------------------------+
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v16.0.0 or higher)
- **macOS / Linux**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/TanmayBaghel/voiceCMD.git
cd voiceCMD

# Install dependencies
npm install
```

### 3. Start the Local Engine & Web Dashboard
```bash
node server.js
```
Open your browser and navigate to:
👉 **[http://localhost:12101](http://localhost:12101)**

---

## 💻 CLI Usage

Execute voice or text commands directly from your terminal:

```bash
# Open Applications
node cmdVoice.js "open safari"
node cmdVoice.js "launch chrome"

# System Diagnostics
node cmdVoice.js "check system status"

# Volume Control
node cmdVoice.js "turn volume up"

# Set Timers
node cmdVoice.js "set timer for 5 minutes"

# Web Search
node cmdVoice.js "search rhasspy voice assistant"
```

---

## 📡 Rhasspy REST API Endpoints

The server listens on port **12101** (default Rhasspy port):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/text-to-intent` | Parse query string or JSON payload into intent JSON & execute desktop action |
| `POST` | `/api/speech-to-text` | Convert audio transcript buffer to text |
| `GET` | `/api/intents` | Get raw `sentences.ini` grammar rules |
| `POST` | `/api/intents` | Update `sentences.ini` content |
| `POST` | `/api/train` | Recompile NLU rules from `sentences.ini` |
| `GET` | `/api/health` | Engine status health check |

### Example cURL Request

```bash
curl -X POST http://localhost:12101/api/text-to-intent \
  -H "Content-Type: application/json" \
  -d '{"text": "check system status"}'
```

**JSON Response Payload:**
```json
{
  "text": "check system status",
  "intent": {
    "name": "SystemStatus",
    "confidence": 1
  },
  "slots": {},
  "speech": {
    "text": "System health report ready. Disk usage and uptime checked."
  },
  "actionLog": "System Stats:\n15:00 up 12 days, 22:21, load averages: 5.14 4.18",
  "status": "success"
}
```

---

## ⚙️ Customizing Voice Intents (`sentences.ini`)

Edit `sentences.ini` to define your custom voice commands using Rhasspy syntax:

```ini
[LaunchApp]
apps = (safari | chrome | finder | terminal | calculator | notes | spotify | vlc)
open [the] <apps>{app}
launch [the] <apps>{app}

[SystemStatus]
check system (status | info | health | stats)
show battery [level]

[MediaControl]
actions = (mute | unmute | volume up | volume down | pause | play)
<actions>{action} [the] (sound | media | music | audio)
turn volume (up | down){action}

[SetTimer]
set [a] timer for (5 | 10 | 15 | 30 | 60){minutes} minutes

[SearchWeb]
search [for] (javascript | python | rhasspy | weather | news){query} [on web]

[RunCommand]
run (ls | pwd | uptime | whoami | date | clear){command}
```

---

## 📁 Repository Structure

```text
voiceCMD/
├── README.md            # Documentation & Getting Started Guide
├── index.html           # Main Glassmorphism Web Interface
├── style.css            # Custom CSS Design Token System & Glass Styling
├── app.js               # Web Audio API, Web Speech Recognition & WebSocket Client
├── server.js            # Express & WebSocket Server (Port 12101)
├── sentences.ini        # Voice Intent Grammar Definitions
├── cmdVoice.js          # Terminal CLI Command Runner
├── package.json         # Dependencies & Project Scripts
├── .gitignore           # Git ignore rules for node_modules & system files
└── src/
    ├── nlu.js           # Rhasspy NLU Parser & Rule Matcher
    └── intentHandler.js # macOS System Action & Command Execution Dispatcher
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
