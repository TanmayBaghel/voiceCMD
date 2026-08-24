const { exec } = require('child_process');

class IntentHandler {
  async handle(nluResult) {
    const { intent, slots, text } = nluResult;
    const intentName = intent.name;

    let responseText = `Executed intent ${intentName}.`;
    let actionLog = '';
    let status = 'success';

    switch (intentName) {
      case 'LaunchApp': {
        const app = slots.app || 'safari';
        actionLog = `Opening application: ${app}`;
        responseText = `Launching ${app} now.`;
        try {
          exec(`open -a "${app}"`);
        } catch (e) {
          actionLog += ` (Error: ${e.message})`;
        }
        break;
      }

      case 'SystemStatus': {
        actionLog = 'Fetching macOS system stats...';
        try {
          const sysInfo = await this.execPromise("uptime && sysctl -n hw.model && df -h / | tail -n 1");
          actionLog = `System Stats:\n${sysInfo}`;
          responseText = `System health report ready. Disk usage and uptime checked.`;
        } catch (e) {
          responseText = `Could not retrieve system stats.`;
          actionLog = e.message;
        }
        break;
      }

      case 'MediaControl': {
        const action = (slots.action || 'volume up').toLowerCase();
        if (action.includes('up')) {
          exec(`osascript -e "set volume output volume ((output volume of (get volume settings)) + 15)"`);
          responseText = `Volume turned up.`;
        } else if (action.includes('down')) {
          exec(`osascript -e "set volume output volume ((output volume of (get volume settings)) - 15)"`);
          responseText = `Volume turned down.`;
        } else if (action.includes('mute')) {
          exec(`osascript -e "set volume output muted true"`);
          responseText = `Audio muted.`;
        } else if (action.includes('unmute')) {
          exec(`osascript -e "set volume output muted false"`);
          responseText = `Audio unmuted.`;
        } else {
          responseText = `Media control action ${action} triggered.`;
        }
        actionLog = `Media Action executed: ${action}`;
        break;
      }

      case 'SetTimer': {
        const minutes = parseInt(slots.minutes || '5', 10);
        responseText = `Timer set for ${minutes} minute${minutes > 1 ? 's' : ''}.`;
        actionLog = `Timer scheduled for ${minutes} min(s).`;
        setTimeout(() => {
          exec(`osascript -e 'display notification "Timer Finished!" with title "cmdVoice Timer"'`);
        }, minutes * 60 * 1000);
        break;
      }

      case 'SearchWeb': {
        const query = slots.query || 'rhasspy voice assistant';
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        exec(`open "${url}"`);
        responseText = `Searching the web for ${query}.`;
        actionLog = `Opened search URL: ${url}`;
        break;
      }

      case 'RunCommand': {
        const cmd = slots.command || 'ls';
        const allowedCmds = ['ls', 'pwd', 'uptime', 'whoami', 'date', 'clear'];
        if (allowedCmds.includes(cmd)) {
          try {
            const output = await this.execPromise(cmd);
            actionLog = `Ran command '${cmd}':\n${output.trim()}`;
            responseText = `Command ${cmd} executed successfully.`;
          } catch (e) {
            actionLog = `Command error: ${e.message}`;
            responseText = `Failed to run command ${cmd}.`;
          }
        } else {
          actionLog = `Command '${cmd}' blocked for security reasons. Allowed: ${allowedCmds.join(', ')}`;
          responseText = `Command execution restricted to safe presets.`;
        }
        break;
      }

      case 'GetWeather': {
        responseText = `It's currently clear and pleasant outside. 22 degrees Celsius.`;
        actionLog = `Fetched weather information from simulated weather service.`;
        break;
      }

      default: {
        responseText = `I recognized your intent as ${intentName}, but no handler action is mapped yet.`;
        actionLog = `Unmapped intent: ${intentName} with query "${text}"`;
        status = 'warning';
        break;
      }
    }

    return {
      intent: intentName,
      slots,
      responseText,
      actionLog,
      status,
      timestamp: new Date().toISOString()
    };
  }

  execPromise(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(stdout || stderr);
      });
    });
  }
}

module.exports = IntentHandler;
