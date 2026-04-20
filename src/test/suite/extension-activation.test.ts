import * as assert from "node:assert";

import * as vscode from "vscode";

import { createDebug } from "@/utils/create-debug";
const debug = createDebug("app-explorer:test:extension-activation");

/**
 * Test to verify VSCode extension activation and coverage measurement
 */
suite("Extension Activation Tests", () => {
  test("Extension can be activated", async function () {
    this.timeout(30000);

    debug("Testing extension activation...");

    // Get the extension
    const extension = vscode.extensions.getExtension("AsaAyers.app-explorer");
    debug("Extension found:", !!extension);
    debug("Extension active:", extension?.isActive);

    if (extension && !extension.isActive) {
      debug("Activating extension...");
      const result = await extension.activate();
      debug("Extension activation result:", result);
      debug("Extension now active:", extension.isActive);
    }

    // Verify extension is active
    assert.ok(extension, "Extension should be found");
    assert.ok(extension?.isActive, "Extension should be active");

    // Test if commands are registered
    const commands = await vscode.commands.getCommands();
    const appExplorerCommands = commands.filter(
      (cmd) => cmd.indexOf("app-explorer.") === 0,
    );
    debug("AppExplorer commands found:", appExplorerCommands.length);
    debug("Commands:", appExplorerCommands);

    // Verify key commands are registered
    const expectedCommands = [
      "app-explorer.disconnectSession",
      "app-explorer.navigate",
      "app-explorer.updateExtension",
    ];

    for (const expectedCommand of expectedCommands) {
      assert.ok(
        appExplorerCommands.includes(expectedCommand),
        `Command ${expectedCommand} should be registered`,
      );
    }

    debug("Extension activation test completed successfully");
  });
});
