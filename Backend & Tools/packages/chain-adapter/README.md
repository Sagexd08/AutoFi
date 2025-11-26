# Chain Adapter

This package provides a unified `ChainAdapter` interface for interacting with EVM-compatible chains and an initial Celo adapter wrapper.

Goals:
- Provide a single interface for chain operations: balance, simulation, gas estimation, transaction building/signing/broadcasting.
- Allow plugging in different chain-specific implementations (EVM generic, Celo, others later).
- Be small and testable so worker/exec code can depend on it.

Quick usage:

```ts
import { EvmAdapter, CeloAdapter } from '@autofi/chain-adapter';

const eth = new EvmAdapter({ chainId: 1, rpcUrl: process.env.ETH_RPC_URL, privateKey: process.env.PRIVATE_KEY });
const celo = new CeloAdapter({ chainId: 42220, rpcUrl: process.env.CELO_RPC_URL, privateKey: process.env.CELO_PRIVATE_KEY });

const bal = await eth.getBalance('0x...');
```

Notes:
- This initial implementation includes placeholders and minimal implementations using `viem` and the existing `@celo-automator/celo-functions` package.
- Further work: full signing and broadcast flows, support for provider failover, RPC health checks, rate-limiting, and account abstraction.
