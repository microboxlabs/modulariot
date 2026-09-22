import { beforeEach, describe, expect, it } from "vitest";
import type { CredentialsStore } from "../seams/credentials";
import { isCredentialsStore } from "../seams/credentials";
import type { SqlDriver } from "../store/sql/driver";
import { createSqliteDriver } from "../store/sqlite-driver";
import { SQLITE_MEMORY } from "../store/sqlite";
import { runMigrations } from "../store/sql/migrations";
import { createCipher } from "./cipher";
import {
  createSqlCredentialsVault,
  MIN_CREDENTIALS_KEY_LENGTH,
  reencryptCredentials,
  VaultConfigError,
} from "./sql";

const KEY = "0".repeat(MIN_CREDENTIALS_KEY_LENGTH);
const TOKEN = "pgrst_live_0123456789abcdef";

let driver: SqlDriver;
let vault: CredentialsStore;

beforeEach(async () => {
  driver = createSqliteDriver({ path: SQLITE_MEMORY });
  vault = await createSqlCredentialsVault({ driver, key: KEY });
});

describe("the key", () => {
  it("is refused when it is too short", async () => {
    await expect(
      createSqlCredentialsVault({ driver, key: "short" }),
    ).rejects.toThrow(VaultConfigError);
  });

  it("has no default", async () => {
    await expect(
      createSqlCredentialsVault({ driver, key: "" }),
    ).rejects.toThrow(VaultConfigError);
  });
});

describe("the vault", () => {
  it("is writable, so the write routes mount", () => {
    expect(isCredentialsStore(vault)).toBe(true);
  });

  it("round-trips a credential as applied auth", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    await expect(vault.resolve("acme", "fleet")).resolves.toEqual({
      kind: "HTTP_AUTH",
      headers: { Authorization: `Bearer ${TOKEN}` },
      queryParams: {},
    });
  });

  it("round-trips every kind", async () => {
    await vault.putCredential("acme", "basic", {
      kind: "BASIC",
      username: "ana",
      password: "s3cret-and-long",
    });
    await vault.putCredential("acme", "apikey", {
      kind: "API_KEY_QUERY",
      param: "apikey",
      value: TOKEN,
    });
    await vault.putCredential("acme", "gcp", {
      kind: "SERVICE_ACCOUNT",
      projectId: "p",
      clientEmail: "svc@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----",
    });

    await expect(vault.resolve("acme", "basic")).resolves.toMatchObject({
      kind: "HTTP_AUTH",
    });
    await expect(vault.resolve("acme", "apikey")).resolves.toEqual({
      kind: "HTTP_AUTH",
      headers: {},
      queryParams: { apikey: TOKEN },
    });
    await expect(vault.resolve("acme", "gcp")).resolves.toMatchObject({
      kind: "SERVICE_ACCOUNT",
      privateKey: "-----BEGIN PRIVATE KEY-----",
    });
  });

  it("stores NONE with nothing encrypted", async () => {
    await vault.putCredential("acme", "open", { kind: "NONE" });

    await expect(vault.resolve("acme", "open")).resolves.toEqual({
      kind: "NONE",
    });

    const [row] = await driver.all<{ ciphertext: string | null }>(
      "SELECT ciphertext FROM datasource_credentials WHERE ref = 'open'",
    );
    expect(row?.ciphertext).toBeNull();
  });

  it("will not resolve another tenant's ref", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    await expect(vault.resolve("globex", "fleet")).resolves.toBeNull();
    await expect(vault.listCredentials("globex")).resolves.toEqual([]);
  });

  it("replaces on a second write", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: "pgrst_rotated_0123456789",
    });

    await expect(vault.listCredentials("acme")).resolves.toHaveLength(1);
    await expect(vault.resolve("acme", "fleet")).resolves.toEqual({
      kind: "HTTP_AUTH",
      headers: { Authorization: "Bearer pgrst_rotated_0123456789" },
      queryParams: {},
    });
  });

  it("forgets a removed ref", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    await vault.removeCredential("acme", "fleet");

    await expect(vault.resolve("acme", "fleet")).resolves.toBeNull();
  });

  it("summarizes without the secret", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    const summaries = await vault.listCredentials("acme");
    expect(summaries).toEqual([
      {
        ref: "fleet",
        kind: "BEARER",
        preview: "…cdef",
        updatedAt: expect.any(String),
      },
    ]);
    expect(JSON.stringify(summaries)).not.toContain(TOKEN);
  });
});

describe("what lands on disk", () => {
  it("does not contain the secret in any column", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    const rows = await driver.all<Record<string, unknown>>(
      "SELECT * FROM datasource_credentials",
    );

    expect(JSON.stringify(rows)).not.toContain(TOKEN);
  });

  it("is unreadable with the wrong key", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    const wrong = await createSqlCredentialsVault({
      driver,
      key: "1".repeat(MIN_CREDENTIALS_KEY_LENGTH),
    });

    // A row that exists but cannot be decrypted is a failure. Answering
    // null would turn a key mistake into "no credential configured".
    await expect(wrong.resolve("acme", "fleet")).rejects.toThrow(
      /could not be decrypted/,
    );
  });

  it("refuses a row whose ciphertext was edited", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    const [row] = await driver.all<{ ciphertext: string }>(
      "SELECT ciphertext FROM datasource_credentials WHERE ref = 'fleet'",
    );
    const parts = row!.ciphertext.split(":");
    // Flip a character of the ciphertext; GCM's tag catches it.
    const body = parts[2]!;
    const tampered = [
      parts[0],
      parts[1],
      (body[0] === "A" ? "B" : "A") + body.slice(1),
    ].join(":");

    await driver.all(
      "UPDATE datasource_credentials SET ciphertext = ? WHERE ref = 'fleet'",
      [tampered],
    );

    await expect(vault.resolve("acme", "fleet")).rejects.toThrow(
      /could not be decrypted/,
    );
  });

  it("refuses a row whose ciphertext came from another tenant", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    await vault.putCredential("globex", "fleet", {
      kind: "BEARER",
      token: "pgrst_live_fedcba9876543210",
    });

    const [stolen] = await driver.all<{ ciphertext: string }>(
      "SELECT ciphertext FROM datasource_credentials WHERE tenant_id = 'acme'",
    );
    // Whoever can write this table can also copy a row into it. The key is
    // one per deployment, so without the tenant and ref under the tag this
    // decrypts, and globex resolves acme's token.
    await driver.all(
      "UPDATE datasource_credentials SET ciphertext = ? WHERE tenant_id = 'globex'",
      [stolen!.ciphertext],
    );

    await expect(vault.resolve("globex", "fleet")).rejects.toThrow(
      /could not be decrypted/,
    );
  });
});

describe("its schema", () => {
  it("is recorded apart from the core's", async () => {
    const fresh = createSqliteDriver({ path: SQLITE_MEMORY });
    await runMigrations(fresh);
    await createSqlCredentialsVault({ driver: fresh, key: KEY });

    const core = await fresh.all<{ version: number }>(
      "SELECT version FROM schema_migrations",
    );
    const plugin = await fresh.all<{ version: number }>(
      "SELECT version FROM credentials_schema_migrations",
    );

    expect(core.length).toBeGreaterThan(1);
    expect(plugin.map((row) => row.version)).toEqual([1]);
  });

  it("does not exist when the plugin is not enabled", async () => {
    const fresh = createSqliteDriver({ path: SQLITE_MEMORY });
    await runMigrations(fresh);

    const tables = await fresh.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    expect(tables.map((table) => table.name)).not.toContain(
      "datasource_credentials",
    );
  });
});

describe("re-encrypting", () => {
  it("refuses a key too short for the vault that wrote the rows", async () => {
    await expect(
      reencryptCredentials({ driver, key: "short" }),
    ).rejects.toThrow(VaultConfigError);
  });

  it("rewrites the rows an older scheme wrote, and leaves NONE alone", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    await vault.putCredential("acme", "open", { kind: "NONE" });
    await driver.all("UPDATE datasource_credentials SET key_version = 0");
    const [before] = await driver.all<{ ciphertext: string }>(
      "SELECT ciphertext FROM datasource_credentials WHERE ref = 'fleet'",
    );

    const rewritten = await reencryptCredentials({ driver, key: KEY });

    expect(rewritten).toBe(1);
    const rows = await driver.all<{
      ref: string;
      ciphertext: string | null;
      key_version: number;
    }>(
      "SELECT ref, ciphertext, key_version FROM datasource_credentials ORDER BY ref",
    );
    expect(rows).toEqual([
      // Nothing to re-encrypt, so this row is not touched and keeps the
      // version it was written with.
      { ref: "fleet", ciphertext: expect.any(String), key_version: 1 },
      { ref: "open", ciphertext: null, key_version: 0 },
    ]);
    expect(rows[0]!.ciphertext).not.toBe(before!.ciphertext);
    await expect(vault.resolve("acme", "fleet")).resolves.toEqual({
      kind: "HTTP_AUTH",
      headers: { Authorization: `Bearer ${TOKEN}` },
      queryParams: {},
    });
  });

  it("leaves a row already on the current scheme where it is", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    const [before] = await driver.all<{ ciphertext: string }>(
      "SELECT ciphertext FROM datasource_credentials WHERE ref = 'fleet'",
    );

    expect(await reencryptCredentials({ driver, key: KEY })).toBe(0);

    const [after] = await driver.all<{ ciphertext: string }>(
      "SELECT ciphertext FROM datasource_credentials WHERE ref = 'fleet'",
    );
    expect(after!.ciphertext).toBe(before!.ciphertext);
  });

  it("keeps each row readable in its own row and nowhere else", async () => {
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    await driver.all("UPDATE datasource_credentials SET key_version = 0");

    await reencryptCredentials({ driver, key: KEY });

    // The rewrite has to re-apply the same context, or the row it just
    // wrote would no longer decrypt in the row it belongs to.
    await expect(vault.resolve("acme", "fleet")).resolves.toMatchObject({
      kind: "HTTP_AUTH",
    });
  });
});

const CONTEXT = JSON.stringify(["acme", "fleet"]);

describe("the cipher", () => {
  it("produces a different envelope each time", async () => {
    const cipher = createCipher(KEY);

    const first = await cipher.encrypt(TOKEN, CONTEXT);
    const second = await cipher.encrypt(TOKEN, CONTEXT);

    expect(first).not.toBe(second);
    await expect(cipher.decrypt(first, CONTEXT)).resolves.toBe(TOKEN);
    await expect(cipher.decrypt(second, CONTEXT)).resolves.toBe(TOKEN);
  });

  it("round-trips non-ASCII", async () => {
    const cipher = createCipher(KEY);
    const value = "contraseña · 密码";

    await expect(
      cipher.decrypt(await cipher.encrypt(value, CONTEXT), CONTEXT),
    ).resolves.toBe(value);
  });

  it("refuses an envelope from a scheme it does not know", async () => {
    const cipher = createCipher(KEY);

    await expect(cipher.decrypt("v2:aaaa:bbbb", CONTEXT)).rejects.toThrow(
      /not in a form this build can read/,
    );
  });

  it("refuses an envelope written for another context", async () => {
    const cipher = createCipher(KEY);

    const envelope = await cipher.encrypt(TOKEN, CONTEXT);

    await expect(
      cipher.decrypt(envelope, JSON.stringify(["globex", "fleet"])),
    ).rejects.toThrow(/could not be decrypted/);
  });
});
