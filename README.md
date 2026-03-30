# AppExplorer Prototype (Archived Open-Source Prototype)

This repository contains the original open-source prototype of AppExplorer.

It is no longer the active development repository.

## What this prototype is

AppExplorer started as a VSCode + Miro prototype for building architecture
diagrams that stay connected to real code.

The core idea is still the same:

- developers explore a codebase in VSCode
- meaningful code elements are attached to a diagram
- the diagram becomes a navigable, high-level view of the system
- the result can serve as living documentation tied to the implementation

This prototype proved out that workflow.

## Status of this repository

This repository is now effectively frozen.

I am no longer publishing ongoing AppExplorer development here, and future work
is happening in a private repository.

You are welcome to read this code as a historical prototype, but you should not
expect this repository to track the current product.

## Important limitation of the prototype

AppExplorer `<= 0.2` was built around a localhost server.

That means the prototype depends on a local development setup and a Miro app
configured to talk to that local server. In practice, this makes the prototype
useful for development and experimentation, but not for a hosted team workflow.

It also means non-developer stakeholders, such as PMs, cannot fully interact
with cards unless the local development environment is running correctly. They
can view diagrams on the board, but the interactive behavior depends on the
localhost-based prototype architecture.

As AppExplorer moves to a hosted model, that old setup is no longer the path
forward.

## Where AppExplorer is going

AppExplorer is being rebuilt as a hosted product with a permanent domain and
server-backed Miro integration.

That change is necessary to support real team usage instead of requiring every
workflow to depend on `localhost`.

The current direction is a paid Miro app where:

- subscriptions are required to create cards
- someone on a team needs an active subscription for card details to be opened
- the product works through hosted infrastructure instead of the original
  localhost-only prototype

That also means the open-source prototype in this repository will diverge from
the active product.

## Public behind-the-scenes overview

Even though the active source code is no longer being published here, I am still
publishing a public Miro board that explains AppExplorer’s codebase at a
high level.

That board is the best way to understand the product direction without reading
the private source repository.

**Public board:**  
[AppExplorer Public Board](https://miro.com/app/board/uXjVL0VAGdA=/?share_link_id=273783644676)

## Should you use this repository?

Use this repository if you want to:

- inspect the original prototype
- understand the early technical direction
- see how the VSCode + Miro localhost approach worked
- compare the prototype against the public board

Do **not** use this repository if you are looking for:

- the current production code
- the active Miro app
- hosted onboarding or subscription support
- a stable path for adoption

## Why leave this repository up?

Because the prototype is still useful as a record of how the idea started.

The open-source version demonstrated the core concept:
architecture diagrams can be anchored to real code instead of drifting into
stale documentation.

That idea is continuing, even though the implementation and delivery model are
changing.

## License

This repository remains available under the license already published here for
the prototype.

That license applies to this archived prototype repository only. It does not
grant rights to future private versions of AppExplorer unless explicitly stated
elsewhere.

## Final note

If you found this repository because you want to understand what AppExplorer is,
start with https://appexplorer.dev.

This repo is the prototype.
The active product has moved on.
