## 2024-05-23 - Automation Dashboard Rendering
**Learning:** High-frequency polling (30s) in parent components can trigger massive re-renders of list items. Inline operations like `JSON.parse` in render loops are significant performance killers.
**Action:** Extract list items to `React.memo` components. Use `useMemo` for derived data like parsed JSON. Ensure event handlers passed to memoized components are wrapped in `useCallback`.
