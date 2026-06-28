"use server";

import fs from "node:fs";
import { NextResponse } from "next/server";
import path from "node:path";

type BuildComponentInfo = {
  changed?: boolean;
  version?: string;
  tag?: string;
  imageRepository?: string;
  imageTag?: string;
  imageRef?: string;
  sourceTag?: string;
};

type BuildCredit = {
  name: string;
  email?: string;
  username?: string;
  url?: string;
  avatarUrl?: string;
  role?: string;
  commitCount?: number;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  impactScore?: number;
  rank?: number;
};

type BuildInfo = {
  product: string;
  channel: string;
  releaseVersion: string;
  releaseNotesVersion?: string;
  stackTag?: string;
  gitSha?: string;
  shortSha?: string;
  builtAt?: string;
  deployedAt?: string;
  workflowRunUrl?: string;
  manifestVersion: number;
  credits: BuildCredit[];
  components: Record<string, BuildComponentInfo>;
};

type RawBuildComponentInfo = BuildComponentInfo & {
  image_repository?: string;
  image_tag?: string;
  image_ref?: string;
  source_tag?: string;
};

type RawBuildInfo = Partial<BuildInfo> & {
  release_version?: string;
  release_notes_version?: string;
  stack_tag?: string;
  git_sha?: string;
  short_sha?: string;
  built_at?: string;
  deployed_at?: string;
  workflow_run_url?: string;
  manifest_version?: number;
  components?: Record<string, RawBuildComponentInfo>;
};

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeComponent(info: RawBuildComponentInfo): BuildComponentInfo {
  return {
    changed: info.changed,
    version: info.version,
    tag: info.tag,
    imageRepository: info.imageRepository ?? info.image_repository,
    imageTag: info.imageTag ?? info.image_tag,
    imageRef: info.imageRef ?? info.image_ref,
    sourceTag: info.sourceTag ?? info.source_tag,
  };
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function normalizeCredits(credits: unknown): BuildCredit[] {
  if (!Array.isArray(credits)) {
    return [];
  }

  return credits.flatMap((credit) => {
    if (typeof credit === "string") {
      const name = credit.trim();
      return name ? [{ name }] : [];
    }

    if (!credit || typeof credit !== "object") {
      return [];
    }

    const candidate = credit as Partial<BuildCredit>;
    const name = candidate.name?.trim();
    if (!name) {
      return [];
    }

    return [
      {
        name,
        email: candidate.email?.trim() || undefined,
        username: candidate.username?.trim() || undefined,
        url: candidate.url?.trim() || undefined,
        avatarUrl: candidate.avatarUrl?.trim() || undefined,
        role: candidate.role?.trim() || undefined,
        commitCount: normalizeNumber(candidate.commitCount),
        filesChanged: normalizeNumber(candidate.filesChanged),
        additions: normalizeNumber(candidate.additions),
        deletions: normalizeNumber(candidate.deletions),
        impactScore: normalizeNumber(candidate.impactScore),
        rank: normalizeNumber(candidate.rank),
      },
    ];
  });
}

function normalizeBuildInfo(raw: RawBuildInfo): BuildInfo {
  return {
    product: raw.product ?? "ModularIoT",
    channel: raw.channel ?? "release",
    releaseVersion: raw.releaseVersion ?? raw.release_version ?? "unknown",
    releaseNotesVersion: raw.releaseNotesVersion ?? raw.release_notes_version,
    stackTag: raw.stackTag ?? raw.stack_tag,
    gitSha: raw.gitSha ?? raw.git_sha,
    shortSha: raw.shortSha ?? raw.short_sha,
    builtAt: raw.builtAt ?? raw.built_at,
    deployedAt: raw.deployedAt ?? raw.deployed_at,
    workflowRunUrl: raw.workflowRunUrl ?? raw.workflow_run_url,
    manifestVersion: raw.manifestVersion ?? raw.manifest_version ?? 1,
    credits: normalizeCredits(raw.credits),
    components: Object.fromEntries(
      Object.entries(raw.components ?? {}).map(([name, info]) => [
        name,
        normalizeComponent(info),
      ])
    ),
  };
}

function parseBuildInfoJson(): BuildInfo | null {
  const raw = optionalEnv("MIOT_BUILD_INFO_JSON");
  if (!raw) {
    return null;
  }

  try {
    return normalizeBuildInfo(JSON.parse(raw) as RawBuildInfo);
  } catch (error) {
    console.error("Invalid MIOT_BUILD_INFO_JSON:", error);
    return null;
  }
}

function readPackagedBuildInfo(): BuildInfo | null {
  const filePath = path.join(process.cwd(), "public", "build-info.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return normalizeBuildInfo(
      JSON.parse(fs.readFileSync(filePath, "utf8")) as RawBuildInfo
    );
  } catch (error) {
    console.error("Invalid packaged build-info.json:", error);
    return null;
  }
}

function component(prefix: string): BuildComponentInfo {
  const changed = optionalEnv(`${prefix}_CHANGED`);

  return {
    changed: changed ? changed === "true" : undefined,
    version: optionalEnv(`${prefix}_VERSION`),
    tag: optionalEnv(`${prefix}_TAG`),
    imageRepository: optionalEnv(`${prefix}_IMAGE_REPOSITORY`),
    imageTag: optionalEnv(`${prefix}_IMAGE_TAG`),
    imageRef: optionalEnv(`${prefix}_IMAGE_REF`),
    sourceTag: optionalEnv(`${prefix}_SOURCE_TAG`),
  };
}

function inferChannel(releaseVersion: string): string {
  if (releaseVersion.startsWith("nightly-")) {
    return "nightly";
  }

  if (releaseVersion === "local") {
    return "local";
  }

  return "release";
}

function stripEmptyComponentValues(
  components: Record<string, BuildComponentInfo>
): Record<string, BuildComponentInfo> {
  return Object.fromEntries(
    Object.entries(components).map(([name, info]) => [
      name,
      Object.fromEntries(
        Object.entries(info).filter(([, value]) => value !== undefined)
      ),
    ])
  );
}

function parseCreditsEnv(): BuildCredit[] {
  const raw = optionalEnv("BUILD_CREDITS_JSON");
  if (!raw) {
    return [];
  }

  try {
    return normalizeCredits(JSON.parse(raw));
  } catch (error) {
    console.error("Invalid BUILD_CREDITS_JSON:", error);
    return [];
  }
}

function buildInfoFromEnv(): BuildInfo {
  const releaseVersion =
    optionalEnv("RELEASE_VERSION") ?? optionalEnv("APP_VERSION") ?? "local";

  const shortSha =
    optionalEnv("SHORT_SHA") ?? optionalEnv("GIT_SHA")?.slice(0, 7);

  const channel = optionalEnv("BUILD_CHANNEL") ?? inferChannel(releaseVersion);

  return {
    product: "ModularIoT",
    channel,
    releaseVersion,
    releaseNotesVersion: optionalEnv("RELEASE_NOTES_VERSION"),
    stackTag: optionalEnv("STACK_TAG"),
    gitSha: optionalEnv("GIT_SHA"),
    shortSha,
    builtAt: optionalEnv("BUILT_AT"),
    deployedAt: optionalEnv("DEPLOYED_AT"),
    workflowRunUrl: optionalEnv("WORKFLOW_RUN_URL"),
    manifestVersion: 1,
    credits: parseCreditsEnv(),
    components: stripEmptyComponentValues({
      app: component("APP"),
      modulith: component("MODULITH"),
      harness: component("HARNESS"),
    }),
  } satisfies BuildInfo;
}

function hasRuntimeBuildInfoEnv(): boolean {
  return [
    "RELEASE_VERSION",
    "APP_VERSION",
    "BUILD_CHANNEL",
    "STACK_TAG",
    "GIT_SHA",
  ].some((key) => optionalEnv(key));
}

export async function GET() {
  const fromJson = parseBuildInfoJson();
  if (fromJson) {
    return NextResponse.json(fromJson);
  }

  if (hasRuntimeBuildInfoEnv()) {
    return NextResponse.json(buildInfoFromEnv());
  }

  const fromPackage = readPackagedBuildInfo();
  if (fromPackage) {
    return NextResponse.json(fromPackage);
  }

  return NextResponse.json(buildInfoFromEnv());
}
