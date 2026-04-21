---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---

# React and Next.js instructions

- In Next.js routes, render React components directly instead of mounting Lit custom elements or loading legacy `/.js` bundles.
- Always use Tailwind utility classes for styling React components instead of inline style objects.
- Prefer static imports in client components over dynamic imports when the module is part of the same app build.
- Use a state-driven rendering model: pass state down via props/context and render directly from that state (including URL/search params). User events should update state and/or router inputs; avoid imperative "sync" refs between components.
- Avoid `useEffect` for deriving local UI state from other React state. Compute derived values during render (`useMemo`, reducers, plain expressions) and reserve effects for external side effects (subscriptions, network, timers, direct DOM integration).
- Do not call `setState` synchronously in the top-level body of a `useEffect` (including "initialize from handler/ref" patterns). In effects, subscribe to external updates and call `setState` from event callbacks, or derive values during render.
- If initial UI data comes from an external handler/object, set it when that handler is created/updated (or model it as derived render state), not as an immediate state write inside a separate effect.
- `useEffect` cleanup must undo subscriptions and listeners with a real cleanup path. Prefer returned disposables or other explicit teardown mechanisms over `isMounted`/`isActive` flags.
- If setup code needs cleanup, model it as a function that returns `{ dispose(): void }` so React effects can call it from their cleanup function.
- Keep Miro route pages in `app/(miro)` thin: load route-specific data there, then render shared React components from `src/components/`.
