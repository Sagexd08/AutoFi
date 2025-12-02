# Swarm Intelligence System Usage Guide

The Swarm Intelligence System allows multiple AI agents to collaborate, share information, and execute complex tasks together.

## Core Components

1.  **Swarm Coordinator**: The central hub that manages agent registration and message routing.
2.  **Agents**: Specialized AI agents (Treasury, DeFi, Governance, etc.) that can communicate with each other.
3.  **Event Bus**: A system for broadcasting events across the application.

## How it Works

### 1. Agent Registration

Agents are automatically registered with the Swarm Coordinator when the backend starts.

```typescript
// apps/backend/src/services/swarm.ts
export function initializeSwarm() {
  // ...
  swarmCoordinator.registerAgent(treasuryAgent);
  swarmCoordinator.registerAgent(defiAgent);
  // ...
}
```

### 2. Inter-Agent Communication

Agents can send messages to other agents or broadcast to the whole swarm.

```typescript
// In an agent's code
await this.sendMessageToSwarm({
  from: this.id,
  to: 'defi-agent', // or 'broadcast'
  type: 'TASK_REQUEST',
  content: {
    action: 'analyze_pool',
    poolAddress: '0x...'
  }
});
```

### 3. Handling Messages

Agents have an `onMessage` handler to process incoming messages.

```typescript
// packages/agents/src/base-agent.ts
async onMessage(message: AgentMessage): Promise<void> {
  // Default implementation logs the message
  // Override in specialized agents to handle specific message types
}
```

## API Endpoints

The backend exposes endpoints to interact with the Swarm.

-   `GET /api/swarm/status`: Get the status of the Swarm and registered agents.
-   `POST /api/swarm/broadcast`: Send a message to the Swarm (admin only).

## Example Workflow

1.  **User Request**: A user asks the `TreasuryAgent` to "optimize yield".
2.  **Task Delegation**: The `TreasuryAgent` analyzes the request and realizes it needs current pool data.
3.  **Message**: The `TreasuryAgent` sends a `TASK_REQUEST` to the `DeFiAgent`.
4.  **Execution**: The `DeFiAgent` fetches the data and replies with a `TASK_RESPONSE`.
5.  **Completion**: The `TreasuryAgent` uses the data to execute the optimization and informs the user.

## Future Extensions

-   **Dynamic Agent Spawning**: Create temporary agents for specific tasks.
-   **Consensus Mechanisms**: Agents vote on decisions before execution.
-   **Reputation System**: Track agent performance and reliability.
