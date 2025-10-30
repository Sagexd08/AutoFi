# 🤖 Celo AI Automation Engine

Advanced AI-powered blockchain automation system with Gemini integration for Celo network.

## ✨ Features

- 🧠 **AI Decision Engine** - Gemini-powered natural language processing
- 🔗 **Celo Integration** - Native support for Celo blockchain
- 💾 **SQLite Database** - Persistent data storage and analytics
- 🛡️ **Security First** - Built-in transaction validation and safety checks
- 📊 **Analytics** - Comprehensive usage tracking and insights
- 🚀 **Express API** - RESTful endpoints for automation

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```javascript
import AutomationSystem from './automation-system.js';

const automation = new AutomationSystem({
  geminiApiKey: 'your-gemini-api-key',
  network: 'alfajores'
});

// Process natural language
const result = await automation.processNaturalLanguage(
  'Send 100 cUSD to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbb'
);

console.log(result);
```

### Start Server

```bash
npm start
```

### Test System

```bash
npm test
```
