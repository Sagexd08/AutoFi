# SDK Tools Documentation

## Overview

The AutoFi SDK methods are automatically registered as tools in the Environment Manager, making them available for AI routing and execution.

## Available SDK Tools

### 1. `sdk_initialize`
- **Description**: Initialize the AutoFi SDK with chains and services
- **Category**: sdk
- **Parameters**: None
- **Returns**: Initialization result

### 2. `sdk_execute_transaction`
- **Description**: Execute a blockchain transaction through the SDK
- **Category**: sdk
- **Parameters**: Transaction request object
- **Returns**: Transaction response

### 3. `sdk_get_token_balance`
- **Description**: Get token balance for an address
- **Category**: sdk
- **Parameters**: 
  - `address` (string): Wallet address
  - `tokenAddress` (string): Token contract address
- **Returns**: Token balance

### 4. `sdk_send_token`
- **Description**: Send tokens to an address
- **Category**: sdk
- **Parameters**:
  - `to` (string): Recipient address
  - `amount` (string): Amount to send
  - `tokenAddress` (string): Token contract address
- **Returns**: Transaction result

### 5. `sdk_deploy_contract`
- **Description**: Deploy a smart contract through the SDK
- **Category**: sdk
- **Parameters**: Contract configuration object
- **Returns**: Deployment result

### 6. `sdk_create_agent`
- **Description**: Create an AI agent through the SDK
- **Category**: sdk
- **Parameters**:
  - `agentType` (string): Type of agent
  - `config` (object): Agent configuration
- **Returns**: Agent creation result

### 7. `sdk_get_chain_health`
- **Description**: Get health status of blockchain chains
- **Category**: sdk
- **Parameters**: None
- **Returns**: Chain health status object

### 8. `sdk_get_supported_chains`
- **Description**: Get list of supported blockchain chains
- **Category**: sdk
- **Parameters**: None
- **Returns**: Array of supported chains

## Usage Examples

### Execute a Tool via Environment Manager

```javascript
const result = await environmentManager.executeTool('sdk_get_token_balance', {
  address: '0x...',
  tokenAddress: '0x...'
});
```

### Route Request Through Environment

```javascript
const result = await environmentManager.routeRequest({
  type: 'tool',
  target: 'sdk_execute_transaction',
  parameters: {
    to: '0x...',
    value: '1000000000000000000'
  }
});
```

### Route SDK Method Directly

```javascript
const result = await environmentManager.routeRequest({
  type: 'sdk',
  target: 'executeTransaction',
  parameters: {
    to: '0x...',
    value: '1000000000000000000'
  }
});
```

## Error Handling

All tools include comprehensive error handling:
- Input validation for all parameters
- Type checking for all inputs
- Proper error messages
- Error statistics tracking
- Event emission for errors

## Tool Registration

SDK tools are automatically registered when:
1. Environment Manager is initialized with AutoFi SDK
2. AutoFi SDK is set after initialization (if autoLoadTools is enabled)

Tools can also be manually registered using `registerTool()` method.

