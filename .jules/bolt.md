## 2025-12-28 - Zustand Selector Pattern
**Learning:** Destructuring `useStore()` (e.g., `const { wallet } = useStore()`) causes the component to re-render on *every* single state change in the store, even unrelated ones. This is a major performance bottleneck in this app.
**Action:** Always use granular selectors (e.g., `useStore(s => s.wallet.balance)`) to subscribe only to the specific data needed.
