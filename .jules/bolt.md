## 2025-05-23 - [Next.js Bundle Issue with WalletConnect/Pino]
**Learning:** The project fails to build because `pino` (used by `walletconnect`) indirectly imports `thread-stream`, which includes test files in its distribution that require `tap` or `tape`. Next.js tries to bundle these test files, causing a build error.
**Action:** This is a known issue. A workaround is to exclude these files or ensure they are not bundled. However, this is outside the scope of the current performance optimization. I confirmed the issue persists even without my changes.
