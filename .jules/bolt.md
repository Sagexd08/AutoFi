## 2024-05-23 - Zustand Selector Pattern
**Learning:** Found widespread pattern of `const { data, action } = useStore()` which triggers re-renders on ANY state change in the store. This is a critical performance anti-pattern in Zustand.
**Action:** Must always use selectors: `const data = useStore(s => s.data)`. Applied this to `Dashboard` component along with `React.memo` for list items to isolate updates.
