# React State Rules

<!-- This file is a RESOURCE — referenced as /react/rules/state -->

## Rule 1: No Derived State

Storing computed values in state creates synchronization bugs.

```tsx
// ❌ BAD
function Component({ items }) {
  const [count, setCount] = useState(items.length);
  // What if items.length changes from parent re-render?
}

// ✅ GOOD
function Component({ items }) {
  const count = items.length; // always in sync
}
```

## Rule 2: Colocate State

State should live in the **lowest common ancestor** of components that need it.

<!-- Example decision tree:
     Q: Does only this component need it?
     A: useState
     Q: Do children need it?
     A: props or context
-->

## Rule 3: Lazy Initializers

Expensive initial state should use the lazy form:

```tsx
// ❌ BAD — runs on every render
const [data, setData] = useState(expensiveComputation());

// ✅ GOOD — runs only once
const [data, setData] = useState(() => expensiveComputation());
```

## Rule 4: Stable Keys

Array items must have **stable, unique** keys. Never use `index` as key when the list can reorder.

```tsx
// ❌ BAD
{items.map((item, i) => <Item key={i} {...item} />)}

// ✅ GOOD
{items.map(item => <Item key={item.id} {...item} />)}
```
