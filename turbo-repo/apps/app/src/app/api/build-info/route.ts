"use server";

import { NextResponse } from "next/server";

type BuildComponentInfo = {
  changed?: boolean;
  version?: string;
  tag?: string;
  imageRepository?: string;
  imageTag?: string;
  imageRef?: string;
  sourceTag?: string;
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

export async function GET() {
  const fromJson = parseBuildInfoJson();
  if (fromJson) {
    return NextResponse.json(fromJson);
  }

  const releaseVersion =
    optionalEnv("RELEASE_VERSION") ?? optionalEnv("APP_VERSION") ?? "local";

  const shortSha =
    optionalEnv("SHORT_SHA") ?? optionalEnv("GIT_SHA")?.slice(0, 7);

  const channel = optionalEnv("BUILD_CHANNEL") ?? inferChannel(releaseVersion);

  return NextResponse.json({
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
    components: stripEmptyComponentValues({
      app: component("APP"),
      modulith: component("MODULITH"),
      harness: component("HARNESS"),
    }),
  } satisfies BuildInfo);
}
