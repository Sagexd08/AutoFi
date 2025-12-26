## 2024-05-23 - Zustand Selector Optimization
**Learning:** React components using `useStore()` without selectors subscribe to the *entire* state, causing unnecessary re-renders on every update. This is especially costly in dashboards with frequent background updates (like wallet balance or loading states).
**Action:** Always use granular selectors (e.g., `useStore(s => s.value)`) instead of destructuring the whole store (e.g., `const { value } = useStore()`).
