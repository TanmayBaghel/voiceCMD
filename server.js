const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

const RhasspyNLU = require('./src/nlu');
const IntentHandler = require('./src/intentHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 12101; // Standard Rhasspy Port

const nlu = new RhasspyNLU(path.join(__dirname, 'sentences.ini'));
const intentHandler = new IntentHandler();

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'text/*' }));
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast to WebSocket clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// -----------------------------------------------------------------------------
// Rhasspy Compatible REST API Endpoints
// -----------------------------------------------------------------------------

// 1. Text-to-Intent Endpoint (POST /api/text-to-intent)
app.post('/api/text-to-intent', async (req, res) => {
  let queryText = '';

  if (typeof req.body === 'string') {
    queryText = req.body;
  } else if (req.body && req.body.text) {
    queryText = req.body.text;
  } else if (req.query.text) {
    queryText = req.query.text;
  }

  if (!queryText) {
    return res.status(400).json({ error: 'No text provided for intent processing.' });
  }

  console.log(`[STT -> NLU] Processing text: "${queryText}"`);

  // Parse NLU
  const nluResult = nlu.parse(queryText);

  // Execute Intent
  const result = await intentHandler.handle(nluResult);

  const responsePayload = {
    text: queryText,
    intent: nluResult.intent,
    slots: nluResult.slots,
    tokens: nluResult.tokens,
    speech: {
      text: result.responseText
    },
    actionLog: result.actionLog,
    status: result.status
  };

  broadcast({
    type: 'INTENT_PARSED',
    payload: responsePayload
  });

  return res.json(responsePayload);
});

// 2. Speech-to-Text Endpoint (POST /api/speech-to-text)
app.post('/api/speech-to-text', (req, res) => {
  // Accepts text or audio input buffer
  const recognizedText = typeof req.body === 'string' && req.body.trim()
    ? req.body.trim()
    : 'check system status';

  broadcast({
    type: 'SPEECH_RECOGNIZED',
    text: recognizedText
  });

  return res.send(recognizedText);
});

// 3. Train Intent Rules (POST /api/train)
app.post('/api/train', (req, res) => {
  try {
    nlu.load();
    const count = nlu.intents.length;
    console.log(`[Train] Recompiled sentences.ini. Active intents: ${count}`);

    broadcast({
      type: 'TRAINING_COMPLETE',
      intentCount: count
    });

    return res.json({ status: 'success', message: `Trained ${count} intents successfully.` });
  } catch (e) {
    return res.status(500).json({ status: 'error', error: e.message });
  }
});

// 4. Get Current Sentences.ini (GET /api/intents)
app.get('/api/intents', (req, res) => {
  const iniPath = path.join(__dirname, 'sentences.ini');
  if (fs.existsSync(iniPath)) {
    const content = fs.readFileSync(iniPath, 'utf-8');
    return res.type('text/plain').send(content);
  }
  return res.status(404).send('sentences.ini not found');
});

// Save Sentences.ini (POST /api/intents)
app.post('/api/intents', (req, res) => {
  const content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const iniPath = path.join(__dirname, 'sentences.ini');
  fs.writeFileSync(iniPath, content, 'utf-8');
  nlu.load();

  broadcast({
    type: 'INTENTS_UPDATED',
    intentCount: nlu.intents.length
  });

  return res.json({ status: 'success', message: 'Sentences.ini updated & trained.' });
});

// 5. Listen for Command (POST /api/listen-for-command)
app.post('/api/listen-for-command', async (req, res) => {
  const queryText = req.query.text || 'check system status';
  const nluResult = nlu.parse(queryText);
  const result = await intentHandler.handle(nluResult);

  return res.json({
    text: queryText,
    intent: nluResult.intent,
    slots: nluResult.slots,
    speech: { text: result.responseText },
    actionLog: result.actionLog
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', name: 'cmdVoice', rhasspyPort: PORT });
});

// WebSocket Connection handling
wss.on('connection', (socket) => {
  console.log('[WebSocket] Client connected.');
  socket.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'Connected to cmdVoice Rhasspy Engine',
    intentsCount: nlu.intents.length
  }));

  socket.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PROCESS_VOICE_TEXT') {
        const nluResult = nlu.parse(data.text);
        const result = await intentHandler.handle(nluResult);
        socket.send(JSON.stringify({
          type: 'INTENT_PARSED',
          payload: {
            text: data.text,
            intent: nluResult.intent,
            slots: nluResult.slots,
            speech: { text: result.responseText },
            actionLog: result.actionLog,
            status: result.status
          }
        }));
      }
    } catch (e) {
      console.error('[WebSocket Error]', e);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  cmdVoice Assistant Server Listening on Port ${PORT}`);
  console.log(`  Web Dashboard: http://localhost:${PORT}`);
  console.log(`  Rhasspy API:   http://localhost:${PORT}/api/text-to-intent`);
  console.log(`=================================================\n`);
});
