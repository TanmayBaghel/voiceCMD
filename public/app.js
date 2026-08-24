document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const connectionBadge = document.getElementById('connectionBadge');
  const connectionText = document.getElementById('connectionText');
  const micBtn = document.getElementById('micBtn');
  const micBtnLabel = document.getElementById('micBtnLabel');
  const micStatusTag = document.getElementById('micStatusTag');
  const commandInput = document.getElementById('commandInput');
  const sendBtn = document.getElementById('sendBtn');
  const autoSpeakCheck = document.getElementById('autoSpeakCheck');
  const canvas = document.getElementById('audioCanvas');
  const canvasCtx = canvas.getContext('2d');

  const transcriptText = document.getElementById('transcriptText');
  const intentNameEl = document.getElementById('intentName');
  const confidenceTag = document.getElementById('confidenceTag');
  const slotsJson = document.getElementById('slotsJson');
  const speechResponse = document.getElementById('speechResponse');
  const iniEditor = document.getElementById('iniEditor');
  const trainBtn = document.getElementById('trainBtn');
  const logTerminal = document.getElementById('logTerminal');
  const clearLogBtn = document.getElementById('clearLogBtn');

  let ws = null;
  let isRecording = false;
  let recognition = null;
  let audioContext = null;
  let analyser = null;
  let microphoneStream = null;
  let animationId = null;

  // Initialize WebSocket Connection
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connectionBadge.querySelector('.dot').className = 'dot online';
      connectionText.textContent = 'Rhasspy Engine Online';
      addLog('system', 'Connected to cmdVoice Rhasspy Server (Port 12101).');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      } catch (e) {
        console.error('WS JSON parse error:', e);
      }
    };

    ws.onclose = () => {
      connectionBadge.querySelector('.dot').className = 'dot offline';
      connectionText.textContent = 'Disconnected';
      addLog('error', 'WebSocket disconnected. Reconnecting in 3s...');
      setTimeout(initWebSocket, 3000);
    };
  }

  // Handle Incoming WebSocket / REST Payload
  function handleServerEvent(data) {
    if (data.type === 'INTENT_PARSED' && data.payload) {
      const p = data.payload;
      transcriptText.textContent = `"${p.text}"`;
      intentNameEl.textContent = p.intent ? p.intent.name : 'Unknown';
      confidenceTag.textContent = `Confidence: ${Math.round((p.intent.confidence || 0) * 100)}%`;
      slotsJson.textContent = JSON.stringify(p.slots || {}, null, 2);
      speechResponse.textContent = p.speech ? p.speech.text : 'None';

      addLog('intent', `Matched Intent: [${p.intent.name}] (Confidence: ${Math.round((p.intent.confidence || 0) * 100)}%)`);

      if (p.actionLog) {
        addLog('action', p.actionLog);
      }

      if (autoSpeakCheck.checked && p.speech && p.speech.text) {
        speakText(p.speech.text);
      }
    } else if (data.type === 'TRAINING_COMPLETE') {
      addLog('system', `Training complete. ${data.intentCount} intents loaded.`);
    } else if (data.type === 'INTENTS_UPDATED') {
      addLog('system', `Sentences.ini recompiled successfully (${data.intentCount} rules).`);
    }
  }

  // Text-to-Speech (TTS)
  function speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Load Sentences.ini
  async function loadSentencesIni() {
    try {
      const res = await fetch('/api/intents');
      if (res.ok) {
        const text = await res.text();
        iniEditor.value = text;
      }
    } catch (e) {
      addLog('error', 'Failed to fetch sentences.ini: ' + e.message);
    }
  }

  // Train Engine
  trainBtn.addEventListener('click', async () => {
    trainBtn.disabled = true;
    trainBtn.textContent = 'Training...';
    try {
      const saveRes = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: iniEditor.value
      });
      const data = await saveRes.json();
      addLog('system', data.message || 'Intents saved & trained.');
    } catch (e) {
      addLog('error', 'Training failed: ' + e.message);
    } finally {
      trainBtn.disabled = false;
      trainBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
        </svg>
        Train Engine`;
    }
  });

  // Speech Recognition (Web Speech API + Mic Audio Visualizer)
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
        micBtnLabel.textContent = 'Listening...';
        micStatusTag.textContent = 'Listening...';
        micStatusTag.className = 'badge secondary';
        startVisualizer();
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        transcriptText.textContent = `"${transcript}"`;

        if (event.results[0].isFinal) {
          sendVoiceTextToServer(transcript);
        }
      };

      recognition.onerror = (event) => {
        addLog('error', 'Speech recognition error: ' + event.error);
        stopRecording();
      };

      recognition.onend = () => {
        stopRecording();
      };
    } else {
      micStatusTag.textContent = 'Speech API Unsupported';
      addLog('error', 'Web Speech API is not supported in this browser. Use text input below.');
    }
  }

  function startRecording() {
    if (!recognition) initSpeechRecognition();
    if (recognition && !isRecording) {
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    micBtnLabel.textContent = 'Click to Speak';
    micStatusTag.textContent = 'Mic Idle';
    micStatusTag.className = 'badge';
    stopVisualizer();
  }

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      if (recognition) recognition.stop();
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Send Text / Voice Query to Server
  async function sendVoiceTextToServer(text) {
    if (!text || !text.trim()) return;
    addLog('system', `Processing Query: "${text}"`);

    try {
      const res = await fetch('/api/text-to-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      });
      const data = await res.json();
      handleServerEvent({ type: 'INTENT_PARSED', payload: data });
    } catch (e) {
      addLog('error', 'Request failed: ' + e.message);
    }
  }

  sendBtn.addEventListener('click', () => {
    const text = commandInput.value;
    if (text) {
      sendVoiceTextToServer(text);
      commandInput.value = '';
    }
  });

  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });

  // Preset Chip Clicks
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-cmd');
      commandInput.value = cmd;
      sendVoiceTextToServer(cmd);
    });
  });

  // Web Audio Visualizer
  async function startVisualizer() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.createMediaStreamSource(microphoneStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      drawWaveform();
    } catch (e) {
      console.warn('Microphone stream error for visualizer:', e);
      drawIdleWaveform();
    }
  }

  function stopVisualizer() {
    if (animationId) cancelAnimationFrame(animationId);
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      microphoneStream = null;
    }
    drawIdleWaveform();
  }

  function drawWaveform() {
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationId = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#4facfe');
        gradient.addColorStop(1, '#00f2fe');

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    render();
  }

  function drawIdleWaveform() {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.strokeStyle = 'rgba(79, 172, 254, 0.3)';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, canvas.height / 2);
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }

  // Terminal Log Helper
  function addLog(type, text) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    entry.innerHTML = `
      <span class="time">[${timeStr}]</span>
      <span class="text">${escapeHtml(text)}</span>
    `;

    logTerminal.appendChild(entry);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  clearLogBtn.addEventListener('click', () => {
    logTerminal.innerHTML = '';
    addLog('system', 'Terminal log cleared.');
  });

  // Init
  drawIdleWaveform();
  initWebSocket();
  loadSentencesIni();
  initSpeechRecognition();
});
