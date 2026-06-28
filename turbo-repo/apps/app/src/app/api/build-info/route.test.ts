import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import fs from "fs";
import os from "os";
import path from "path";

const ENV_KEYS = [
  "MIOT_BUILD_INFO_JSON",
  "RELEASE_VERSION",
  "RELEASE_NOTES_VERSION",
  "BUILD_CHANNEL",
  "STACK_TAG",
  "GIT_SHA",
  "SHORT_SHA",
  "BUILD_CREDITS_JSON",
  "APP_VERSION",
  "APP_TAG",
  "APP_IMAGE_REF",
] as const;

describe("build info route", () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();

  afterEach(() => {
    process.env = { ...originalEnv };
    process.chdir(originalCwd);
  });

  it("normalizes manifest JSON from deployment payloads", async () => {
    process.env.MIOT_BUILD_INFO_JSON = JSON.stringify({
      release_version: "nightly-20260627-abc1234",
      channel: "nightly",
      git_sha: "abc1234def",
      short_sha: "abc1234",
      manifest_version: 1,
      credits: [
        {
          name: "Ada Lovelace",
          username: "ada",
          url: "https://github.com/ada",
          avatarUrl: "https://github.com/ada.png?size=96",
          role: "Contributor",
          commitCount: 3,
          filesChanged: 8,
          additions: 120,
          deletions: 14,
          impactScore: 82,
          rank: 1,
        },
      ],
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
      credits: [
        {
          name: "Ada Lovelace",
          username: "ada",
          url: "https://github.com/ada",
          avatarUrl: "https://github.com/ada.png?size=96",
          role: "Contributor",
          commitCount: 3,
          filesChanged: 8,
          additions: 120,
          deletions: 14,
          impactScore: 82,
          rank: 1,
        },
      ],
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
    process.env.BUILD_CREDITS_JSON = JSON.stringify([
      {
        name: "Grace Hopper",
        email: "grace@example.com",
        avatarUrl:
          "https://www.gravatar.com/avatar/abc123?d=identicon&s=96",
        role: "Contributor",
        commitCount: 2,
        filesChanged: 5,
        additions: 30,
        deletions: 7,
        impactScore: 66,
        rank: 2,
      },
    ]);
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
      credits: [
        {
          name: "Grace Hopper",
          email: "grace@example.com",
          avatarUrl:
            "https://www.gravatar.com/avatar/abc123?d=identicon&s=96",
          role: "Contributor",
          commitCount: 2,
          filesChanged: 5,
          additions: 30,
          deletions: 7,
          impactScore: 66,
          rank: 2,
        },
      ],
      components: {
        app: {
          version: "0.5.21",
          tag: "app@v0.5.21",
          imageRef: "ghcr.io/microboxlabs/miot-app@sha256:def",
        },
      },
    });
  });

  it("uses packaged build info when runtime env vars are absent", async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miot-build-info-"));
    const publicDir = path.join(tempDir, "public");
    fs.mkdirSync(publicDir);
    fs.writeFileSync(
      path.join(publicDir, "build-info.json"),
      JSON.stringify({
        release_version: "nightly-20260628-def5678",
        channel: "nightly",
        git_sha: "def5678901",
        short_sha: "def5678",
        credits: ["Release Pilot"],
        components: {
          app: {
            tag: "app@nightly-20260628-def5678",
            image_tag: "sha-def5678",
          },
        },
      })
    );
    process.chdir(tempDir);

    const response = await GET();
    const data = await response.json();

    expect(data).toMatchObject({
      channel: "nightly",
      releaseVersion: "nightly-20260628-def5678",
      gitSha: "def5678901",
      credits: [
        {
          name: "Release Pilot",
        },
      ],
      components: {
        app: {
          tag: "app@nightly-20260628-def5678",
          imageTag: "sha-def5678",
        },
      },
    });
  });
});
