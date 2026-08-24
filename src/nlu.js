const fs = require('fs');
const path = require('path');

class RhasspyNLU {
  constructor(iniPath) {
    this.iniPath = iniPath || path.join(__dirname, '../sentences.ini');
    this.intents = [];
    this.load();
  }

  load() {
    if (!fs.existsSync(this.iniPath)) {
      this.intents = [];
      return;
    }

    const content = fs.readFileSync(this.iniPath, 'utf-8');
    this.intents = this.parseIni(content);
  }

  parseIni(content) {
    const lines = content.split('\n');
    const intents = [];
    let currentIntent = null;
    let localVariables = {};

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;

      if (line.startsWith('[') && line.endsWith(']')) {
        const intentName = line.slice(1, -1).trim();
        currentIntent = { name: intentName, rules: [], vars: { ...localVariables } };
        intents.push(currentIntent);
        continue;
      }

      if (line.includes('=') && !line.includes('(')) {
        const [varName, varVal] = line.split('=').map(s => s.trim());
        const options = this.extractOptions(varVal);
        if (currentIntent) {
          currentIntent.vars[varName] = options;
        } else {
          localVariables[varName] = options;
        }
        continue;
      }

      if (currentIntent) {
        currentIntent.rules.push(line);
      }
    }

    return intents;
  }

  extractOptions(expr) {
    // Matches (opt1 | opt2 | opt3)
    const match = expr.match(/^\((.*)\)$/);
    if (match) {
      return match[1].split('|').map(s => s.trim());
    }
    return [expr];
  }

  parse(userText) {
    const cleanText = userText.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

    let bestMatch = null;
    let highestConfidence = 0;

    for (const intent of this.intents) {
      for (const rule of intent.rules) {
        const matchResult = this.matchRule(cleanText, rule, intent.vars);
        if (matchResult && matchResult.confidence > highestConfidence) {
          highestConfidence = matchResult.confidence;
          bestMatch = {
            text: userText,
            intent: {
              name: intent.name,
              confidence: matchResult.confidence
            },
            slots: matchResult.slots,
            tokens: cleanText.split(/\s+/)
          };
        }
      }
    }

    if (!bestMatch) {
      // Fallback intent recognition
      bestMatch = this.fuzzyFallback(userText, cleanText);
    }

    return bestMatch;
  }

  matchRule(text, rule, vars) {
    let patternStr = rule.trim();

    // 1. Substitute variable references like <apps>{app} -> (safari|chrome...){app}
    for (const [vName, vOpts] of Object.entries(vars)) {
      const varTag = `<${vName}>`;
      if (patternStr.includes(varTag)) {
        patternStr = patternStr.replace(new RegExp(varTag, 'g'), `(${vOpts.join('|')})`);
      }
    }

    // 2. Build Regex
    let regexParts = [];
    let slotNames = [];
    let i = 0;
    const len = patternStr.length;

    while (i < len) {
      // Optional word [word]
      if (patternStr[i] === '[') {
        const endBracket = patternStr.indexOf(']', i);
        if (endBracket !== -1) {
          const optWord = patternStr.slice(i + 1, endBracket).trim();
          regexParts.push(`(?:${optWord})?`);
          i = endBracket + 1;
          continue;
        }
      }

      // Group (opt1 | opt2) with optional {slot}
      if (patternStr[i] === '(') {
        const endParen = patternStr.indexOf(')', i);
        if (endParen !== -1) {
          const groupContent = patternStr.slice(i + 1, endParen).split('|').map(s => s.trim()).join('|');
          i = endParen + 1;

          if (i < len && patternStr[i] === '{') {
            const endSlot = patternStr.indexOf('}', i);
            if (endSlot !== -1) {
              const slotName = patternStr.slice(i + 1, endSlot).trim();
              slotNames.push(slotName);
              regexParts.push(`(${groupContent})`);
              i = endSlot + 1;
              continue;
            }
          }

          regexParts.push(`(?:${groupContent})`);
          continue;
        }
      }

      // Word or char
      if (patternStr[i] !== ' ') {
        let startWord = i;
        while (i < len && !' [](){}'.includes(patternStr[i])) i++;
        const word = patternStr.slice(startWord, i);
        if (i < len && patternStr[i] === '{') {
          const endSlot = patternStr.indexOf('}', i);
          if (endSlot !== -1) {
            const slotName = patternStr.slice(i + 1, endSlot).trim();
            slotNames.push(slotName);
            regexParts.push(`(${word})`);
            i = endSlot + 1;
            continue;
          }
        }
        regexParts.push(word);
        continue;
      }

      i++;
    }

    const regexPattern = '^\\s*' + regexParts.join('\\s*') + '\\s*$';

    try {
      const reg = new RegExp(regexPattern, 'i');
      const match = text.match(reg);
      if (match) {
        const slots = {};
        for (let sIdx = 0; sIdx < slotNames.length; sIdx++) {
          slots[slotNames[sIdx]] = match[sIdx + 1] ? match[sIdx + 1].trim() : '';
        }
        return { confidence: 1.0, slots };
      }
    } catch (e) {
      // Regex compilation error
    }

    return null;
  }

  fuzzyFallback(rawText, cleanText) {
    if (cleanText.includes('safari') || cleanText.includes('chrome') || cleanText.includes('open') || cleanText.includes('launch')) {
      const app = cleanText.split(' ').pop();
      return {
        text: rawText,
        intent: { name: 'LaunchApp', confidence: 0.7 },
        slots: { app: app || 'safari' },
        tokens: cleanText.split(/\s+/)
      };
    }
    if (cleanText.includes('status') || cleanText.includes('battery') || cleanText.includes('system') || cleanText.includes('cpu')) {
      return {
        text: rawText,
        intent: { name: 'SystemStatus', confidence: 0.8 },
        slots: {},
        tokens: cleanText.split(/\s+/)
      };
    }
    if (cleanText.includes('weather') || cleanText.includes('rain')) {
      return {
        text: rawText,
        intent: { name: 'GetWeather', confidence: 0.85 },
        slots: {},
        tokens: cleanText.split(/\s+/)
      };
    }

    return {
      text: rawText,
      intent: { name: 'UnknownIntent', confidence: 0 },
      slots: {},
      tokens: cleanText.split(/\s+/)
    };
  }
}

module.exports = RhasspyNLU;
