# AppExplorer

AppExplorer connects **VS Code** and **Miro** so your architecture diagrams can
stay linked to the code they describe.

Instead of drawing a diagram once and letting it drift out of date, you can map
real functions, classes, and code regions to cards on a board, then use the
board to navigate back to the implementation.

## What AppExplorer helps you do

- Turn code into **board cards linked to real symbols**
- Build diagrams by **walking the codebase**
- Click cards in Miro and **jump back to code in VS Code**
- Keep architecture notes, arrows, screenshots, and context **around real code
  references**

AppExplorer does **not** auto-generate architecture diagrams for you. It helps
you build one gradually, using the code you decide is worth mapping.

## How it works

0. Install Miro app and VSCode extension
1. Open a codebase in VS Code.
2. Open AppExplorer in Miro and choose **Start VSCode session**.
3. Move your cursor inside a function, class, or other symbol.
4. AppExplorer shows the symbols around your cursor.
5. Drag a card onto the board to add that code to your diagram.
6. Select a card later to navigate back to the linked code.

## Best fit

AppExplorer is a good fit when you want to:

- explain a system to teammates
- map an architecture as you learn it
- document important flows without losing the connection to implementation
- create diagrams that remain useful after the first draft

## Before you start

AppExplorer depends on language-server symbol information, so it works best in
projects and languages where VS Code can already identify functions, classes,
and other code symbols.

You will usually get the best results when your cursor is **inside** a symbol,
not on blank lines, imports, or the top of the file.

## Commands

- **AppExplorer: Navigate to Card**
- **AppExplorer: Disconnect Session**

## Learn more

- Interactive demo: <https://appexplorer.dev/demo>
- Public architecture board: <https://miro.com/app/board/uXjVJpT6jCA=/?moveToWidget=3458764665695719632&cot=14>
- Project site: <https://appexplorer.dev>

## Feedback

If you want to report a bug, request a feature, or share how you would use
AppExplorer, visit:

<https://appexplorer.dev>
