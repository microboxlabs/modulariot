import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ENV_KEYS = [
  "MIOT_BUILD_INFO_JSON",
  "RELEASE_VERSION",
  "RELEASE_NOTES_VERSION",
  "BUILD_CHANNEL",
  "STACK_TAG",
  "GIT_SHA",
  "SHORT_SHA",
  "APP_VERSION",
  "APP_TAG",
  "APP_IMAGE_REF",
] as const;

describe("build info route", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("normalizes manifest JSON from deployment payloads", async () => {
    process.env.MIOT_BUILD_INFO_JSON = JSON.stringify({
      release_version: "nightly-20260627-abc1234",
      channel: "nightly",
      git_sha: "abc1234def",
      short_sha: "abc1234",
      manifest_version: 1,
      components: {
        app: {
          tag: "app@nightly-20260627-abc1234",
          image_repository: "ghcr.io/microboxlabs/miot-app",
          image_tag: "sha-abc1234",
          image_ref: "ghcr.io/microboxlabs/miot-app@sha256:abc",
        },
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toMatchObject({
      product: "ModularIoT",
      channel: "nightly",
      releaseVersion: "nightly-20260627-abc1234",
      gitSha: "abc1234def",
      components: {
        app: {
          imageRepository: "ghcr.io/microboxlabs/miot-app",
          imageTag: "sha-abc1234",
          imageRef: "ghcr.io/microboxlabs/miot-app@sha256:abc",
        },
      },
    });
  });

  it("falls back to individual runtime env vars", async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    process.env.RELEASE_VERSION = "1.31.20";
    process.env.RELEASE_NOTES_VERSION = "v1.31.20";
    process.env.BUILD_CHANNEL = "release";
    process.env.STACK_TAG = "miot-stack@v0.5.21";
    process.env.GIT_SHA = "1234567890";
    process.env.APP_VERSION = "0.5.21";
    process.env.APP_TAG = "app@v0.5.21";
    process.env.APP_IMAGE_REF = "ghcr.io/microboxlabs/miot-app@sha256:def";

    const response = await GET();
    const data = await response.json();

    expect(data).toMatchObject({
      channel: "release",
      releaseVersion: "1.31.20",
      releaseNotesVersion: "v1.31.20",
      stackTag: "miot-stack@v0.5.21",
      shortSha: "1234567",
      components: {
        app: {
          version: "0.5.21",
          tag: "app@v0.5.21",
          imageRef: "ghcr.io/microboxlabs/miot-app@sha256:def",
        },
      },
    });
  });
});
