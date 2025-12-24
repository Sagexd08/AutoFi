## 2024-05-23 - Zustand Selector Pattern
**Learning:** Subscribing to the entire store (`const { a, b } = useStore()`) causes re-renders on *any* store update, even if unrelated properties change. Using selectors (`const a = useStore(s => s.a)`) isolates re-renders to only relevant changes.
**Action:** Always use specific selectors for Zustand hooks, especially in high-traffic components like dashboards.
