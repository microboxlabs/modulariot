import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const templateMock = vi.fn();

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock(
  "@/features/common/providers/alfresco-api/alfresco-api.provider",
  () => ({
    getSympthomTemplate: (...args: unknown[]) => templateMock(...args),
  })
);

import { GET } from "./route";

const url = "http://x/t?serviceCode=7&conditionName=Speed&icuCode=3";

describe("GET /api/treatments/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers an empty template without the ECM", async () => {
    vi.stubEnv("ECM_API_URL", "");
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { icuCode: "3", name: "", conditionName: "Speed", message: "" },
      success: false,
    });
    expect(templateMock).not.toHaveBeenCalled();
  });

  it("reads the template from the ECM when it is configured", async () => {
    vi.stubEnv("ECM_API_URL", "http://ecm");
    const template = {
      icuCode: "3",
      name: "t",
      conditionName: "Speed",
      message: "Hello",
    };
    templateMock.mockResolvedValue({ success: true, data: template });
    const res = await GET(new Request(url));
    expect(await res.json()).toEqual({ data: template });
  });
});
