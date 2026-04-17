---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---

# React and Next.js instructions

- In Next.js routes, render React components directly instead of mounting Lit custom elements or loading legacy `/.js` bundles.
- Prefer static imports in client components over dynamic imports when the module is part of the same app build.
- `useEffect` cleanup must undo subscriptions and listeners with a real cleanup path. Prefer returned disposables or other explicit teardown mechanisms over `isMounted`/`isActive` flags.
- If setup code needs cleanup, model it as a function that returns `{ dispose(): void }` so React effects can call it from their cleanup function.
- Keep Miro route pages in `app/(miro)` thin: load route-specific data there, then render shared React components from `src/components/`.
