# Copilot Instructions for AppExplorer

## Overview

AppExplorer is a VS Code extension and web app that connect Miro boards to
source code.

The current transport model is:

- the Next.js app host and the Socket.IO relay are always the same host
- browser clients connect to the relay with a relative Socket.IO URL
- the VS Code extension still needs the session URL host index so it can pick
  the right absolute host to connect to

## Current Session Model

- Session URLs use the shape:
  - `vscode://asa-ayers.app-explorer/session/{sessionId}?key={key}&host={index}`
- `host` is an index, not a hostname string:
  - `0` = production on `https://appexplorer.dev`
    - Do not include "host=0" in URLs for production sessions; treat host=0 as the default when the host parameter is omitted
  - `1` = development on `https://dev.appexplorer.dev`
- Host resolution lives in `src/host-config.ts`
- Session parsing lives in `src/app-explorer-session.ts`
- Extension-side coordination lives in `src/extension-session.ts`

Prefer using the host index plus helper functions rather than hardcoding hostnames throughout the code.

## Key Components

1. **VS Code extension**
   - Entry point: `src/extension.ts`
   - Session connection remains lazy: the extension waits for a session to start
     before attempting to connect workspace sockets to boards
   - Session state is broadcast across windows through `session.json` in `context.globalStorageUri`
   - Includes `AppExplorer: Disconnect Session` to clear the broadcast file and disconnect sibling windows

2. **Session coordinator**
   - Implemented in `src/extension-session.ts`
   - Parses `vscode://` session URLs
   - Watches the broadcast file
   - Resolves the workspace socket host from the session host index
   - Starts session-specific transport only after a session begins

3. **Relay server**
   - Socket.IO is attached from `src/app/sockets/main.ts` through
     `src/instrumentation.ts`
   - `src/server/server.ts` is routing-only: it relays session events and does
     not own workspace, board, or card state

4. **Miro integration**
   - Core logic: `src/miro.ts`
   - Uses the Miro Web SDK
   - Connects to the current host with a relative Socket.IO namespace URL

5. **Sidebar/frontend**
   - Shared React sidebar lives in `src/components/app-explorer-sidebar.tsx`
   - Sidebar socket setup lives in `src/sidebar/connect-sidebar-socket.ts`
   - Like the Miro client, it connects with a relative Socket.IO namespace URL

## Data Flow

- **Session URL** starts a session in one VS Code window
- **Broadcast file** notifies sibling VS Code windows
- **Workspace transport** connects to the host selected by the session URL
- **Miro and sidebar clients** connect to the current app host
- **Relay server** forwards events between workspace, Miro, and sidebar clients

## Host Notes

- Use host indexes and helper functions rather than scattering raw hostnames
- Browser socket clients should keep using relative namespace URLs
- The VS Code extension should resolve an absolute socket URL from the session
  host index before connecting

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

### Development app host

```bash
npm run dev
```

That runs the Next.js app and relay on `http://localhost:3000`.

In development, traffic is normally accessed through the SSL-terminating proxy
at `https://dev.appexplorer.dev`, so browser-facing host config should use that
origin rather than raw localhost.

## Project-Specific Conventions

- **Card metadata**: Miro cards link back to code using metadata such as `path`, `symbol`, and `codeLink`
- **Socket transport**: real-time updates use Socket.IO, and encrypted transport is handled in the event-handler layer
- **Host selection**: use host indexes and helper functions instead of scattering raw hostnames
- **File naming**: tracked source/config files use kebab-case filenames, and the filename should match one of the file's main exports (`some-file.ts` -> `someFile`, `some-class.ts` -> `SomeClass`)
- **Routing-only relay**: avoid reintroducing server-owned board/workspace/card state

## Important Files

- `src/extension.ts`: extension activation and command registration
- `src/extension-session.ts`: URI handling, broadcast file sync, session startup
- `src/app-explorer-session.ts`: session URL parsing
- `src/host-config.ts`: host-index helpers and host mapping
- `src/workspace-card-storage.ts`: workspace socket lifecycle and host selection
- `src/server/server.ts`: routing-only Socket.IO relay
- `src/app/sockets/main.ts`: Next.js-hosted Socket.IO entry
- `src/miro.ts`: Miro-side transport and board behavior
- `src/sidebar/connect-sidebar-socket.ts`: sidebar-side transport

## Testing Focus

- End-to-end flows remain the highest-value tests
- Session startup, host-index parsing, and host selection should be kept
  covered when behavior changes
- When changing host logic, verify which host the browser and extension each
  target

## Logging

- Logging uses the `debug` library
- In the extension host, logs go to the VS Code output channel
- During tests, logs go to the console
  - The browser's logs are relayed to the console and prefixed with `[Browser Log]` or `[Browser Error]` for easier identification
  - The extension's logs are also sent to the console during tests, prefixed with `[Extension Log]` for clarity
- Namespaces follow the `app-explorer:*` pattern
