import { NextResponse } from "next/server";

export type TemplateParams = {
  params: Promise<{ kind: string; lang: string }>;
};

const SEGMENT = /^[a-z]+$/;

/** The modulith path of one platform template, or null for a bad kind or language. */
export async function templatePath({
  params,
}: TemplateParams): Promise<string | null> {
  const { kind, lang } = await params;
  if (!SEGMENT.test(kind) || !SEGMENT.test(lang)) return null;
  return `/api/v1/platform/mail-templates/${kind}/${lang}`;
}

export function invalidPath() {
  return NextResponse.json({ error: "Invalid path" }, { status: 400 });
}

export async function readJson(
  request: Request
): Promise<{ body: unknown } | null> {
  try {
    return { body: await request.json() };
  } catch {
    return null;
  }
}

export function invalidJson() {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}
