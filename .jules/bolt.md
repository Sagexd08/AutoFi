## 2024-05-23 - Zustand Store Selectors
**Learning:** Using `const { ... } = useStore()` subscribes to the *entire* state object. Any change to any part of the state (even unused parts) triggers a re-render.
**Action:** Always use granular selectors `useStore(s => s.specificField)` or `useShallow` when consuming state in components to prevent unnecessary re-renders.
