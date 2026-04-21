import * as assert from "node:assert";

import { encrypt } from "@/utils/crypto";
import { decryptUuidToken, encryptUuidToken } from "@/utils/uuid-token";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const URL_SAFE_TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

suite("UUID token", () => {
  test("uses SESSION_SECRET to encrypt a UUID into a compact URL-safe token", () => {
    assert.strictEqual(typeof process.env.SESSION_SECRET, "string");
    const sessionSecret = process.env.SESSION_SECRET;
    const token = encryptUuidToken(UUID, sessionSecret);

    assert.match(token, URL_SAFE_TOKEN_REGEX);
    assert.strictEqual(token.includes("."), false);
    assert.strictEqual(token.includes("="), false);
    assert.strictEqual(token.length, 59);
    assert.strictEqual(decryptUuidToken(token, sessionSecret), UUID);
  });

  test("stays much shorter than the existing JWT-based encrypted session format", async () => {
    assert.strictEqual(typeof process.env.SESSION_SECRET, "string");
    const token = encryptUuidToken(UUID, process.env.SESSION_SECRET);
    const jwt = await encrypt<{ uuid: string }>(
      { uuid: UUID },
      undefined,
      new Date(Date.now() + 60_000),
    );

    assert.ok(token.length < jwt.length);
  });
});
