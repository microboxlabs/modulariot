import { File } from "node:buffer";
import { TransformStream } from "node:stream/web";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scope = vi.fn();
const relay = vi.fn();
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scope(),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  relayToStreamhubModulith: (...args: unknown[]) => relay(...args),
}));
import { POST } from "./route";

const URL =
  "http://localhost/api/trips/documents/upload?trip=11111111-1111-1111-1111-111111111111";

describe("trip document uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("TransformStream", TransformStream);
    vi.stubGlobal("File", File);
    scope.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "sample" } },
    });
    relay.mockResolvedValue(new Response("{}"));
  });

  it("relays the multipart file after resolving the organization", async () => {
    const body =
      '--sample\r\nContent-Disposition: form-data; name="file"; filename="sample.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-test\r\n--sample\r\nContent-Disposition: form-data; name="docType"\r\n\r\nCARGO_MANIFEST\r\n--sample--\r\n';
    const request = new Request(URL, {
      method: "POST",
      body,
      headers: { "content-type": "multipart/form-data; boundary=sample" },
    });
    expect((await POST(request)).status).toBe(200);
    const [path, init] = relay.mock.calls[0]!;
    expect(path).toContain("/api/v1/orgs/sample/trips/");
    expect(init.body.get("docType")).toBe("CARGO_MANIFEST");
    expect(init.body.get("file").name).toBe("sample.pdf");
  });

  it("rejects a declared oversized request before reading it", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-length": String(41 * 1024 * 1024) },
    });
    expect((await POST(request)).status).toBe(413);
    expect(relay).not.toHaveBeenCalled();
  });

  it("bounds multipart reads even without a content-length header", async () => {
    const request = new Request(URL, {
      method: "POST",
      body:
        '--sample\r\nContent-Disposition: form-data; name="file"; filename="sample.pdf"\r\n\r\n' +
        "a".repeat(41 * 1024 * 1024) +
        "\r\n--sample--\r\n",
      headers: { "content-type": "multipart/form-data; boundary=sample" },
    });
    expect(request.headers.has("content-length")).toBe(false);
    expect((await POST(request)).status).toBe(413);
    expect(relay).not.toHaveBeenCalled();
  });

  it("returns a client error for malformed multipart data", async () => {
    expect(
      (await POST(new Request(URL, { method: "POST", body: "invalid" }))).status
    ).toBe(400);
    expect(relay).not.toHaveBeenCalled();
  });
});
