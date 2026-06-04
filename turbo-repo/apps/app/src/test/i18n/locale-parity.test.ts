import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import en from "@/lang/en.json";
import es from "@/lang/es.json";

type JsonRecord = { [key: string]: JsonRecord | string };

// vitest runs with cwd = the app root (where vitest.config.ts lives).
const enPath = resolve(process.cwd(), "src/lang/en.json");
const esPath = resolve(process.cwd(), "src/lang/es.json");

/** Collect every dot-path that resolves to a string leaf. */
function leafKeys(
  obj: JsonRecord,
  prefix = "",
  out: Set<string> = new Set()
): Set<string> {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      leafKeys(value as JsonRecord, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

/**
 * Detect duplicate keys within any object scope of a raw JSON string.
 * `JSON.parse` silently keeps only the last occurrence of a duplicate key, so
 * duplicates are invisible after parsing yet silently drop translations. This
 * scans the source text instead.
 */
function findDuplicateKeys(raw: string): string[] {
  let i = 0;
  const stack: Array<{
    type: "obj" | "arr";
    keys?: Set<string>;
    path: string;
    expectKey?: boolean;
  }> = [];
  const dups: string[] = [];
  let pendingKey: string | null = null;

  const readString = (): string => {
    let result = "";
    i++; // opening quote
    while (i < raw.length) {
      const c = raw[i];
      if (c === "\\") {
        result += raw[i] + raw[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') {
        i++;
        break;
      }
      result += c;
      i++;
    }
    return result;
  };

  const childPath = (key: string): string => {
    const top = stack[stack.length - 1];
    if (!top) return key;
    if (top.type === "obj") {
      const base = top.path ? `${top.path}.` : "";
      return base + key;
    }
    return top.path;
  };

  while (i < raw.length) {
    const c = raw[i];
    if (c === '"') {
      const top = stack[stack.length - 1];
      if (top && top.type === "obj" && top.expectKey) {
        const key = readString();
        if (top.keys!.has(key)) {
          dups.push((top.path ? `${top.path}.` : "") + key);
        }
        top.keys!.add(key);
        pendingKey = key;
        top.expectKey = false;
      } else {
        readString();
      }
      continue;
    }
    if (c === "{") {
      stack.push({
        type: "obj",
        keys: new Set(),
        path: childPath(pendingKey ?? ""),
        expectKey: true,
      });
      pendingKey = null;
      i++;
      continue;
    }
    if (c === "[") {
      stack.push({ type: "arr", path: childPath(pendingKey ?? "") });
      pendingKey = null;
      i++;
      continue;
    }
    if (c === "}" || c === "]") {
      stack.pop();
      i++;
      continue;
    }
    if (c === ",") {
      const top = stack[stack.length - 1];
      if (top && top.type === "obj") top.expectKey = true;
      i++;
      continue;
    }
    i++;
  }
  return dups;
}

describe("i18n locale integrity", () => {
  const enKeys = leafKeys(en as JsonRecord);
  const esKeys = leafKeys(es as JsonRecord);

  // es is the canonical locale (defaultLocale + type source for TrKey). en must
  // match it exactly, in both directions, so a build never ships a locale that
  // renders raw key paths instead of translations.
  it("es (canonical) and en have identical leaf-key sets", () => {
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();
    expect({ missingInEn, missingInEs }).toEqual({
      missingInEn: [],
      missingInEs: [],
    });
  });

  it.each([
    ["en", enPath],
    ["es", esPath],
  ])("%s.json has no duplicate keys", (_locale, filePath) => {
    expect(findDuplicateKeys(readFileSync(filePath, "utf8"))).toEqual([]);
  });
});
