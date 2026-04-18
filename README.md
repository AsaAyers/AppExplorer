# AppExplorer

AppExplorer connects a Miro board to a VS Code workspace so cards on the board
can stay linked to real code.

## Current architecture

AppExplorer now uses a single hosted app server per environment. The web app and
the Socket.IO relay always live on the same host:

| Host index | Purpose     | Host                          |
| ---------- | ----------- | ----------------------------- |
| `0`        | Production  | `https://appexplorer.dev`     |
| `1`        | Development | `https://dev.appexplorer.dev` |

Browser clients connect to the relay with a relative Socket.IO URL. The
`vscode://` session URL still carries the host index so the VS Code extension
can resolve the correct absolute host when it opens its workspace socket.

Session URLs use this shape:

`vscode://asa-ayers.app-explorer/session/{sessionId}?key={key}&host={index}`

- Omit `host` for production sessions (`host=0` is the default)
- Use `host=1` for development sessions on `https://dev.appexplorer.dev`

## Main pieces

- **Next.js app**: serves the web UI and hosts the Socket.IO relay
- **VS Code extension**: waits for a session URL, then connects the workspace to
  the selected host
- **Miro client**: runs inside the Miro iframe and relays board events through
  the app host
- **Sidebar UI**: shows cards around the current cursor position and starts
  VS Code sessions

The relay is routing-only. It forwards session events between workspace, Miro,
and sidebar clients and does not own board or workspace state.

## Development

Start the local app host:

```bash
npm run dev
```

That runs the app and relay together on `http://localhost:3000`.

In development, the Node server still listens on port `3000`, but browsers and
the VS Code extension should use the SSL-terminating proxy host
`https://dev.appexplorer.dev`.

Useful commands:

```bash
npm run typecheck
npm run build
. ./setup-xvfb.sh && npm test
```

`./record-tests.sh` remains the higher-level end-to-end test workflow.

## Important files

- `src/host-config.ts`: host index to origin mapping
- `src/app-explorer-session.ts`: session URL parsing and socket URL helpers
- `src/extension-session.ts`: extension-side session coordination
- `src/workspace-card-storage.ts`: workspace socket lifecycle
- `src/app/sockets/main.ts`: Next.js Socket.IO bootstrap
- `src/server/server.ts`: routing-only relay implementation
- `src/miro.ts`: Miro client integration
- `src/components/app-explorer-sidebar.tsx`: sidebar session startup UI
