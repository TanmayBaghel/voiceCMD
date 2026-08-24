#!/usr/bin/env node

const path = require('path');
const RhasspyNLU = require('./src/nlu');
const IntentHandler = require('./src/intentHandler');

async function main() {
  const args = process.argv.slice(2);
  const queryText = args.join(' ');

  if (!queryText) {
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│  cmdVoice CLI Runner - Customized Rhasspy Voice Assistant    │
└─────────────────────────────────────────────────────────────┘

Usage:
  node cmdVoice.js "<voice or text command>"

Examples:
  node cmdVoice.js "open safari"
  node cmdVoice.js "check system status"
  node cmdVoice.js "turn volume up"
  node cmdVoice.js "search rhasspy python on web"
  node cmdVoice.js "set timer for 5 minutes"
`);
    process.exit(0);
  }

  console.log(`\n🎙️  Input Query: "${queryText}"`);

  const nlu = new RhasspyNLU(path.join(__dirname, 'sentences.ini'));
  const handler = new IntentHandler();

  console.log('⚙️  Parsing Intent (NLU)...');
  const nluResult = nlu.parse(queryText);

  console.log(`\n🎯 Matched Intent:  \x1b[36m[${nluResult.intent.name}]\x1b[0m`);
  console.log(`📊 Confidence:      ${Math.round(nluResult.intent.confidence * 100)}%`);
  console.log(`🧩 Extracted Slots: ${JSON.stringify(nluResult.slots)}`);

  console.log('\n🚀 Executing Action Handler...');
  const result = await handler.handle(nluResult);

  console.log(`\n💬 Speech Output:   \x1b[32m"${result.responseText}"\x1b[0m`);
  console.log(`📋 Execution Log:   \x1b[90m${result.actionLog}\x1b[0m\n`);
}

main().catch(err => {
  console.error('Error running cmdVoice CLI:', err);
});
