# Bolt's Journal ⚡

## 2025-10-26 - Zustand Performance Anti-Pattern
**Learning:** The codebase frequently uses `const { data, action } = useStore()` which subscribes the component to the *entire* store state. In a store that handles high-frequency data (like wallet balances or real-time prices), this causes massive re-render storms for components that only need a slice of the state.
**Action:** Always use granular selectors: `const data = useStore(s => s.data)`. Never destructure the result of `useStore()` unless you are using a shallow comparison selector or truly need the whole state.
