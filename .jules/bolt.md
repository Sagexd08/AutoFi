## 2024-03-24 - Zustand Performance Pattern
**Learning:** Default destructuring from `useStore()` in Zustand subscribes the component to the *entire* store state, causing unnecessary re-renders on any state change.
**Action:** Always use granular selectors or `useShallow` to select only the required state slices. For complex objects (like `wallet`), select only the specific properties needed (e.g., `wallet.balance`) to avoid re-renders when other properties (like `wallet.tokens`) update.
