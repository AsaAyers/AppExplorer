# Copilot Instructions for AppExplorer

## Overview

AppExplorer is a VS Code extension and web app that connect Miro boards to source code. The codebase is in the middle of a transport migration:

- the old relay is the local extension-hosted Socket.IO server on `http://localhost:9042`
- the target architecture is a Next.js-hosted relay on the app host (`https://appexplorer.dev` in production, `http://localhost:3000` in local development)
- session startup is now URI-driven instead of eager-on-activation

When working in this repo, do not assume everything still runs through `9042`. The current code supports multiple host modes during the migration.

## Current Session Model

- Session URLs use the shape:
  - `vscode://asa-ayers.app-explorer/session/{sessionId}?key={key}&host={index}`
- `host` is an index, not a hostname string:
  - `0` = production app host and production relay
    - Do not include "host=0" in URLs for production sessions; treat host=0 as the default when the host parameter is omitted
  - `1` = local development app host on `3000`, but relay still on `9042`
  - `2` = local development app host on `3000` and relay on `3000`
- Host resolution lives in `src/appExplorerDevHost.ts`
- Session parsing lives in `src/appExplorerSession.ts`
- Extension-side coordination lives in `src/extension-session.ts`

Prefer using the host index plus helper functions rather than hardcoding hostnames throughout the code.

## Key Components

1. **VS Code extension**
   - Entry point: `src/extension.ts`
   - Activation is intentionally lightweight
   - The extension waits for a session to start before attempting to connect to boards
   - Session state is broadcast across windows through `session.json` in `context.globalStorageUri`
   - Includes `AppExplorer: Disconnect Session` to clear the broadcast file and disconnect sibling windows

2. **Session coordinator**
   - Implemented in `src/extension-session.ts`
   - Parses `vscode://` session URLs
   - Watches the broadcast file
   - Sets the active host mode on the workspace transport
   - Starts the legacy local relay only when the selected host mode still requires it

3. **Relay servers**
   - Transitional local relay: `src/server/server.ts`, launched by `src/server-launcher.ts`
   - Next.js-hosted relay: Socket.IO attached from `src/app/sockets/main.ts` through `src/instrumentation.ts`
   - The local relay on `9042` is still active for host mode `1`, but the long-term direction is to remove dependence on it
   - The server is routing-only: it relays session events and does not own workspace, board, or card state

4. **Miro integration**
   - Core logic: `src/miro.ts`
   - Uses the Miro Web SDK
   - Connects to the relay selected by the current host mode
   - This runs inside the Miro iframe and is expected to make cross-origin websocket requests during the migration

5. **Sidebar/frontend**
   - Static assets in `public/`
   - Lit-based sidebar socket setup lives in `src/lit/socket-context.ts`
   - Like the Miro client, it connects using the resolved host from the current migration mode rather than assuming same-origin

## Data Flow

- **Session URL** starts a session in one VS Code window
- **Broadcast file** notifies sibling VS Code windows
- **Workspace transport** connects to the relay chosen by host mode
- **Miro and sidebar clients** connect to the corresponding app/relay host
- **Relay server** forwards events between workspace, Miro, and sidebar clients

## Migration Notes

- `9042` is transitional infrastructure, not the desired final architecture
- Host mode `1` intentionally splits app host and relay host:
  - app UI on `3000`
  - relay on `9042`
- Host mode `2` is the future local-development shape:
  - app UI on `3000`
  - relay on `3000`
- Cross-origin websocket traffic is expected during this transition; do not “simplify” by dropping the hostname and using only path-based socket URLs unless the relevant migration step explicitly requires it
- `reset` on `9042` is still test-only legacy behavior to force the extension-hosted relay to restart; it should not be treated as proof that the final architecture still depends on `9042`

## Developer Workflows

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

### Tests

```bash
./record-tests.sh
```

Notes:

- `setup-xvfb.sh` is the normal way to run the VS Code test suite headlessly
  - This is called from within record-tests.sh
- the Create Card test uses a real Miro board and is not parallel-friendly
- some tests still rely on `9042/reset` and `9042/health` because host mode `1` remains part of the current migration state

### Local app host

```bash
yarn dev
```

That runs the Next.js app on `http://localhost:3000`.

## Project-Specific Conventions

- **Card metadata**: Miro cards link back to code using metadata such as `path`, `symbol`, and `codeLink`
- **Socket transport**: real-time updates use Socket.IO, and encrypted transport is handled in the event-handler layer
- **Host selection**: use host indexes and helper functions instead of scattering raw hostnames
- **Delayed startup**: do not reintroduce eager connection or server startup during extension activation
- **Routing-only relay**: avoid reintroducing server-owned board/workspace/card state

## Important Files

- `src/extension.ts`: extension activation and command registration
- `src/extension-session.ts`: URI handling, broadcast file sync, session startup
- `src/appExplorerSession.ts`: session URL parsing
- `src/appExplorerDevHost.ts`: host-index helpers and relay/app host mapping
- `src/workspace-card-storage.ts`: workspace socket lifecycle and host switching
- `src/server-launcher.ts`: legacy local relay lifecycle
- `src/server/server.ts`: routing-only Socket.IO relay
- `src/app/sockets/main.ts`: Next.js-hosted Socket.IO entry
- `src/miro.ts`: Miro-side transport and board behavior
- `src/lit/socket-context.ts`: sidebar-side transport

## Testing Focus

- End-to-end flows remain the highest-value tests
- Session startup, host-index parsing, and relay selection are active migration areas and should be kept covered when behavior changes
- When changing host-mode logic, verify both build behavior and which relay/app host each runtime actually targets

## Logging

- Logging uses the `debug` library
- In the extension host, logs go to the VS Code output channel
- During tests, logs go to the console
  - The browser's logs are relayed to the console and prefixed with `[Browser Log]` or `[Browser Error]` for easier identification
  - The extension's logs are also sent to the console during tests, prefixed with `[Extension Log]` for clarity
- Namespaces follow the `app-explorer:*` pattern
