# React Code Review

<!-- Maintainer: @frontend-team -->
<!-- Last reviewed: 2026-08-01 -->

Review React and TypeScript code for common anti-patterns, performance issues, and maintainability problems.

## State Management

<!-- These rules are based on React 19 best practices -->

When reviewing state usage, check for:

1. **Derived state anti-pattern** — values computable from existing state/props should never be stored in `useState`
2. **Unnecessary re-renders** — state lifted too high causes cascading renders
3. **Stale closures** — callbacks capturing outdated state values
4. **Missing keys** — array items without stable `key` props

See `/react/rules/state` for detailed state rules.

### Quick Reference

```tsx
// ❌ BAD — derived state
const [fullName, setFullName] = useState(`${first} ${last}`);

// ✅ GOOD — compute during render
const fullName = `${first} ${last}`;
```

## Effects

<!-- Experimental: may add useEffect linting integration in v2 -->

Review `useEffect` and `useLayoutEffect` usage:

1. **Missing cleanup** — subscriptions, timers, listeners without return
2. **Incomplete deps** — dependency array that lies about what it uses
3. **Effect for derived data** — using effect + setState where `useMemo` would work
4. **Race conditions** — async effects without cancellation/ignore flag

See `/react/rules/effects` for detailed effect rules.

## Component Design

- Components should be **small and focused** (< 200 lines)
- Extract reusable logic to **custom hooks**
- Prefer **composition** over inheritance
- Co-locate **styles, tests, and stories** with the component

## Performance

<!-- TODO: add bundle-size impact analysis -->

- `React.memo` only with profiler evidence
- `useMemo` / `useCallback` only when deps are expensive to compare
- Avoid inline object/array/function props that break memo
- Code-split routes with `React.lazy`
