/**
 * Low-noise logging strategy for AppExplorer test suite.
 *
 * Provides:
 * - Browser spam filter (Permissions-Policy, mixed content, unrelated Miro/CORS noise)
 * - A per-test critical-path timeline that records key session/transport events
 *   in memory and only prints them to the console when a test fails.
 *
 * Critical-path events are identified by exact token strings placed at the
 * start of the matching log call in the source, e.g. "(session_start)".
 * This makes markers visually distinct and avoids fragile regex matching.
 *
 * Covered tokens:
 *   (session_start), (workspace_socket_connect), (workspace_socket_disconnect),
 *   (workspace_socket_error), (workspace_socket_retry),
 *   (workspace_socket_reconnecting), (workspace_socket_reconnect),
 *   (sidebar_socket_connecting), (sidebar_socket_connect),
 *   (sidebar_socket_disconnect), (sidebar_socket_disconnect_permanent),
 *   (sidebar_socket_retry),
 *   (sidebar_socket_reconnecting), (board_update),
 *   (cards_around_cursor_subscribe), (cards_around_cursor_send),
 *   (symbols_changed), (encrypted_send), (encrypted_call).
 */

// ---------------------------------------------------------------------------
// Browser spam patterns – messages matching any of these are suppressed
// entirely (not printed, not recorded).
// ---------------------------------------------------------------------------
export const BROWSER_SPAM_PATTERNS: RegExp[] = [
  // Browser platform noise
  /Permissions-Policy/i,
  /Mixed Content/i,
  // CORS errors originating from external/Miro infrastructure, not our relay
  /blocked by CORS policy.*(?:miro\.com|sentry\.io|amplitude|analytics)/i,
  // Third-party cookie / iframe sandboxing noise
  /third.party cookie/i,
  /cross-origin frame/i,
  // Miro SDK internal chatter
  /mirotrace/i,
  /MiroWebPlugin/i,
  /\[object (?:Object|Array)\].*miro/i,
];

// ---------------------------------------------------------------------------
// Critical-path tokens – log messages containing any of these exact strings
// are recorded to the timeline (and still printed to the console as usual).
// Every token corresponds to a deliberate marker added at the start of the
// matching log call in the source code.
// ---------------------------------------------------------------------------
const CRITICAL_PATH_TOKENS: string[] = [
  // Extension session lifecycle
  "(session_start)",
  // Workspace socket lifecycle
  "(workspace_socket_connect)",
  "(workspace_socket_disconnect)",
  "(workspace_socket_error)",
  "(workspace_socket_retry)",
  "(workspace_socket_reconnecting)",
  "(workspace_socket_reconnect)",
  // Sidebar socket lifecycle
  "(sidebar_socket_connecting)",
  "(sidebar_socket_connect)",
  "(sidebar_socket_disconnect)",
  "(sidebar_socket_disconnect_permanent)",
  "(sidebar_socket_retry)",
  "(sidebar_socket_reconnecting)",
  // Board events
  "(board_update)",
  // Cards-around-cursor
  "(cards_around_cursor_subscribe)",
  "(cards_around_cursor_send)",
  "(symbols_changed)",
  // Encrypted transport
  "(encrypted_send)",
  "(encrypted_call)",
];

// ---------------------------------------------------------------------------
// Timeline entry type
// ---------------------------------------------------------------------------
export type TimelineEntry = {
  relativeMs: number;
  source: "browser" | "extension";
  type: "error" | "log";
  message: string;
};

// ---------------------------------------------------------------------------
// CriticalPathTimeline
// ---------------------------------------------------------------------------
class CriticalPathTimeline {
  private entries: TimelineEntry[] = [];
  private testStartTime = Date.now();

  /** Reset the timeline, typically called before each test. */
  reset(): void {
    this.entries = [];
    this.testStartTime = Date.now();
  }

  /** Record a critical-path event. */
  record(
    source: "browser" | "extension",
    type: "error" | "log",
    message: string,
  ): void {
    this.entries.push({
      relativeMs: Date.now() - this.testStartTime,
      source,
      type,
      message,
    });
  }

  /** Print all recorded entries unconditionally. */
  print(): void {
    if (this.entries.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[Timeline] No critical-path events recorded.");
      return;
    }
    // eslint-disable-next-line no-console
    console.log("\n=== Critical-Path Timeline ===");
    for (const entry of this.entries) {
      const prefix = `[+${entry.relativeMs}ms][${entry.source}]`;
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${entry.message}`);
    }
    // eslint-disable-next-line no-console
    console.log("==============================\n");
  }

  /** Print the timeline only if the current Mocha test has failed.
   * When the test passes this method intentionally does nothing, keeping
   * passing-test output noise-free. */
  printOnFailure(ctx: Mocha.Context): void {
    if (ctx.currentTest?.state === "failed") {
      this.print();
    }
  }
}

/** Singleton timeline instance shared across helpers. */
export const timeline = new CriticalPathTimeline();

// ---------------------------------------------------------------------------
// Helper predicates
// ---------------------------------------------------------------------------

/** Returns true when a browser console message is known platform/Miro spam. */
export function isBrowserSpam(text: string): boolean {
  return BROWSER_SPAM_PATTERNS.some((pattern) => pattern.test(text));
}

/** Returns true when a log line belongs to the critical transport path. */
export function isCriticalPath(text: string): boolean {
  return CRITICAL_PATH_TOKENS.some((token) => text.includes(token));
}

// ---------------------------------------------------------------------------
// Mocha hook helper
// ---------------------------------------------------------------------------

/**
 * Register `beforeEach` / `afterEach` Mocha hooks that reset the timeline
 * before each test and print it when a test fails.
 *
 * Call this once inside a `suite()` block (or at the top level of a test
 * file) to enable per-test timeline collection for that suite.
 *
 * @example
 * ```typescript
 * suite("My Suite", function () {
 *   setupTimeline();
 *   test("my test", async function () { ... });
 * });
 * ```
 */
export function setupTimeline(): void {
  // Regular `function` declarations are required here (not arrow functions) so
  // that Mocha can inject its `this` context.  The `afterEach` hook uses
  // `this.currentTest` to determine whether the test failed.
  beforeEach(function () {
    timeline.reset();
  });
  afterEach(function () {
    timeline.printOnFailure(this);
  });
}
