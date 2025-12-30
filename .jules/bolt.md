## 2024-05-23 - Zustand State Selectors
**Learning:** Destructuring the entire state from `useStore()` in Zustand causes re-renders on *any* state change. Granular selectors (e.g., `useStore(s => s.property)`) are mandatory for performance in this codebase.
**Action:** Always refactor `const { x, y } = useStore()` to individual `const x = useStore(s => s.x)` calls.
