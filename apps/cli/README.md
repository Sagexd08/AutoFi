# Celo Automator CLI

Interactive command-line interface for Celo blockchain automation.

## Installation

```bash
cd apps/cli
pnpm build
pnpm link --global
```

## Usage

### Initialize

```bash
celo-auto init
```

### Workflow Management

```bash
# Create workflow interactively
celo-auto workflow --create

# List all workflows
celo-auto workflow --list

# Execute workflow
celo-auto workflow --execute <workflow-id>

# Describe workflow
celo-auto workflow --describe <workflow-id>
```

### AI Features

```bash
# Explain natural language request
celo-auto explain "Send 10 CELO every 6 hours"

# The AI will generate a workflow JSON
```

### Configuration

```bash
# View configuration
celo-auto config --list

# Get specific config value
celo-auto config --get apiUrl

# Set config value
celo-auto config --set apiUrl http://localhost:3000
```

## Examples

### Create Recurring Payment

```bash
celo-auto workflow --create
# Enter: "Send 10 CELO every 6 hours to 0x123..."
```

### Monitor DAO Events

```bash
celo-auto watch --contract 0x... --event Transfer
```

### Natural Language Workflow

```bash
celo-auto explain "Whenever my wallet receives 100 CELO, send 10% to treasury"
```
