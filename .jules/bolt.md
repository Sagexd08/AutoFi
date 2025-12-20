## 2024-05-23 - Zustand Selector Optimization
**Learning:** The codebase frequently uses `useStore()` without selectors (e.g., `const { action } = useStore()`). This causes components to re-render on *every* store update, even if the selected action or state hasn't changed.
**Action:** Always use specific selectors (e.g., `const action = useStore(s => s.action)`) to prevent unnecessary re-renders, especially in interactive components or those high up in the tree.
