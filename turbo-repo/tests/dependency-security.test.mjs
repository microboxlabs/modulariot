import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const app = createRequire(new URL("../apps/app/package.json", import.meta.url));
const bff = createRequire(new URL("../apps/bff/package.json", import.meta.url));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);

// Bound parser regressions in a separate process so an infinite loop fails the test.
function isolated(source) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    {
      cwd: new URL("../", import.meta.url),
      timeout: 5000,
      encoding: "utf8",
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
}

test("JWT verifier rejects a signed array instead of treating it as claims", () => {
  const { createVerifier } = bff("fast-jwt");
  const key = "dependency-regression-test-secret";
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify(["unexpected", "claims"]),
  ).toString("base64url");
  const body = `${header}.${payload}`;
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  assert.throws(() =>
    createVerifier({ key, algorithms: ["HS256"] })(`${body}.${signature}`),
  );
});

test("cached JWT without iat stops working at exp", () => {
  const { createSigner, createVerifier } = bff("fast-jwt");
  const key = "dependency-regression-test-secret";
  const initial = 1_700_000_000_000;
  const originalNow = Date.now;
  try {
    Date.now = () => initial;
    const token = createSigner({ key, algorithm: "HS256", noTimestamp: true })({
      sub: "alice",
      exp: initial / 1000 + 1,
    });
    const verify = createVerifier({ key, algorithms: ["HS256"], cache: true });
    assert.equal(verify(token).sub, "alice");
    Date.now = () => initial + 2000;
    assert.throws(() => verify(token), { code: "FAST_JWT_EXPIRED" });
  } finally {
    Date.now = originalNow;
  }
});

test("DOM sanitizer scrubs template expressions joined inside shadow roots", () => {
  const { JSDOM } = app("jsdom");
  const { window } = new JSDOM("");
  try {
    const purify = app("dompurify")(window);
    const host = window.document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.append("$", window.document.createElement("object"), "{unsafe()}");
    purify.sanitize(host, { IN_PLACE: true, SAFE_FOR_TEMPLATES: true });
    assert.equal(shadow.textContent.includes("${unsafe()}"), false);
    assert.equal(
      purify.sanitize('<b>safe</b><img src="x" onerror="unsafe()">'),
      '<b>safe</b><img src="x">',
    );
  } finally {
    window.close();
  }
});

test("image parser rejects a zero-length ICNS entry without blocking", () => {
  isolated(`
    import assert from 'node:assert/strict';
    import { imageSize } from 'image-size';
    const invalid = Buffer.alloc(16);
    invalid.write('icns'); invalid.writeUInt32BE(16, 4); invalid.write('ic07', 8);
    assert.throws(() => imageSize(invalid));
  `);
});

test("ZIP64 sentinel without its extra field fails without blocking", () => {
  isolated(`
    import assert from 'node:assert/strict';
    import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
    const zip = zipSync({ 'file.txt': strToU8('round trip') });
    assert.equal(strFromU8(unzipSync(zip)['file.txt']), 'round trip');
    const broken = Buffer.from(zip);
    const central = broken.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    assert.ok(central >= 0);
    broken.writeUInt16LE(45, central + 6);
    broken.writeUInt32LE(0xffffffff, central + 20);
    broken.writeUInt16LE(0, central + 30);
    const end = broken.length - 22;
    const zip64 = Buffer.alloc(56);
    zip64.writeUInt32LE(0x06064b50);
    zip64.writeBigUInt64LE(44n, 4);
    zip64.writeUInt16LE(45, 12);
    zip64.writeUInt16LE(45, 14);
    zip64.writeBigUInt64LE(1n, 24);
    zip64.writeBigUInt64LE(1n, 32);
    zip64.writeBigUInt64LE(BigInt(broken.readUInt32LE(end + 12)), 40);
    zip64.writeBigUInt64LE(BigInt(central), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50);
    locator.writeBigUInt64LE(BigInt(end), 8);
    locator.writeUInt32LE(1, 16);
    const malformed = Buffer.concat([broken.subarray(0, end), zip64, locator, broken.subarray(end)]);
    assert.throws(() => unzipSync(malformed));
  `);
});

test("theme merge handles cycles and preserves nested overrides", () => {
  isolated(`
    import assert from 'node:assert/strict';
    import { deepmerge } from 'deepmerge-ts';
    const a = {}; const b = {}; a.self = a; b.self = b;
    const merged = deepmerge(a, b);
    assert.equal(merged.self, merged);
    assert.deepEqual(deepmerge({ colors: { base: 'blue' } }, { colors: { accent: 'red' } }),
      { colors: { base: 'blue', accent: 'red' } });
  `);
});

test("texture compressor still reads dimensions from a file with image-size 2", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miot-image-size-"));
  try {
    const file = join(directory, "pixel.png");
    await writeFile(file, png);
    const { getImageSize } = app(
      "texture-compressor/dist/cli/lib/utilities.js",
    );
    assert.deepEqual(getImageSize(file), { width: 1, height: 1, type: "png" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("presentation export embeds an image and math rendering still works", async () => {
  const PptxGenJS = app("pptxgenjs");
  const deck = new PptxGenJS();
  deck
    .addSlide()
    .addImage({
      data: `image/png;base64,${png.toString("base64")}`,
      x: 1,
      y: 1,
      w: 1,
      h: 1,
    });
  const output = await deck.write({ outputType: "nodebuffer" });
  const entries = app("fflate").unzipSync(output);
  assert.ok(Object.keys(entries).some((name) => name.startsWith("ppt/media/")));
  assert.match(app("katex").renderToString("x^2 + y^2"), /katex/);
});
