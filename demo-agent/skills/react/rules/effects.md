# React Effect Rules

<!-- This file is a RESOURCE — referenced as /react/rules/effects -->

## Rule 1: Always Cleanup

Every subscription, timer, or listener **must** return a cleanup function.

```tsx
// ❌ BAD
useEffect(() => {
  const sub = api.subscribe(onData);
}, []); // leaked subscription

// ✅ GOOD
useEffect(() => {
  const sub = api.subscribe(onData);
  return () => sub.unsubscribe();
}, []);
```

## Rule 2: Honest Dependencies

Never omit values from the dependency array to "fix" a bug.

```tsx
// ❌ BAD — lying about deps
useEffect(() => {
  doSomething(props.userId);
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// ✅ GOOD — handle the actual logic
useEffect(() => {
  doSomething(props.userId);
}, [props.userId]);
```

## Rule 3: Effects for Sync, Not Derivation

Effects synchronize React with **external** systems. Don't use them for internal data flow.

```tsx
// ❌ BAD — effect for derived data
const [doubled, setDoubled] = useState(0);
useEffect(() => { setDoubled(count * 2); }, [count]);

// ✅ GOOD — compute directly
const doubled = count * 2;
```

## Rule 4: Async Effects Need Cancellation

```tsx
// ✅ GOOD — race condition safe
useEffect(() => {
  let ignore = false;
  async function fetch() {
    const data = await api.load(props.id);
    if (!ignore) setData(data);
  }
  fetch();
  return () => { ignore = true; };
}, [props.id]);
```
