import { describe, expect, it } from "vitest";
import pagesConfig from "@/features/layout/models/pages-config.json";
import { getRouteRule } from "../config/route-permissions";
import { ACCESS_RULES, PERMISSIONS } from "./access-rules";
import type { AccessRule } from "./access-control";

const KNOWN_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

interface ConfigEntry {
  label: string;
  href?: string;
  requiredPermissions?: string[];
  items?: ConfigEntry[];
}

function flatten(entries: ConfigEntry[]): ConfigEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.items ?? [])]);
}

describe("ACCESS_RULES", () => {
  it("only uses permissions from the catalog", () => {
    for (const rule of Object.values(ACCESS_RULES) as AccessRule[]) {
      expect(rule.requiredPermissions?.length ?? 0).toBeGreaterThan(0);
      for (const permission of rule.requiredPermissions ?? []) {
        expect(KNOWN_PERMISSIONS).toContain(permission);
      }
    }
  });

  it("opens the calendar with any calendar permission", () => {
    expect(ACCESS_RULES.calendar.requiredPermissions).toEqual([
      "calendar:view",
      "calendar:plan",
      "calendar:assign",
    ]);
    expect(ACCESS_RULES.bookingWrite.requiredPermissions).toEqual([
      "calendar:plan",
      "calendar:assign",
    ]);
  });
});

describe("route rules", () => {
  it.each([
    ["/home/sales", "dashboards:view"],
    ["/shipping", "coordination:kanban.view"],
    ["/mytasks", "coordination:kanban.view"],
    ["/planning", "coordination:kanban.view"],
    ["/delivery", "coordination:kanban.view"],
    ["/task/edit/42", "coordination:kanban.view"],
    ["/finished", "coordination:finished.view"],
    ["/reports", "coordination:reports.view"],
    ["/geographic-view", "coordination:geographic.view"],
    ["/symptoms", "controltower:view"],
    ["/where-is-my-load", "coordination:loads.search"],
    ["/calendar/planning", "calendar:view"],
    ["/live-streams/devices", "admin:livestreams.view"],
    ["/collaborators-management/123", "collaborators:manage"],
    ["/whatsapp/conversations", "conversations:view"],
    ["/admin/console/logs", "admin:console"],
  ])("%s needs %s", (path, permission) => {
    expect(getRouteRule(path).requiredPermissions).toContain(permission);
  });

  it.each(["/fleet", "/users/settings/team", "/storytelling", "/"])(
    "%s stays open",
    (path) => {
      expect(getRouteRule(path)).toEqual({});
    }
  );
});

describe("pages-config", () => {
  const entries = flatten(pagesConfig as ConfigEntry[]);

  it("has no group gates", () => {
    const withGroups = entries
      .filter((e) => "requiredGroups" in e || "blockedGroups" in e)
      .map((e) => e.label);
    expect(withGroups).toEqual([]);
  });

  it("only uses permissions from the catalog", () => {
    for (const entry of entries) {
      for (const permission of entry.requiredPermissions ?? []) {
        expect(KNOWN_PERMISSIONS).toContain(permission);
      }
    }
  });

  it("gates the menus by the same permissions as their pages", () => {
    const byLabel = new Map(entries.map((e) => [e.label, e]));
    expect(byLabel.get("home")?.requiredPermissions).toEqual(
      ACCESS_RULES.dashboards.requiredPermissions
    );
    expect(byLabel.get("tasks")?.requiredPermissions).toEqual(
      ACCESS_RULES.kanban.requiredPermissions
    );
    expect(byLabel.get("calendar")?.requiredPermissions).toEqual(
      ACCESS_RULES.calendar.requiredPermissions
    );
    expect(byLabel.get("liveStreams")?.requiredPermissions).toEqual(
      ACCESS_RULES.liveStreams.requiredPermissions
    );
    expect(byLabel.get("whereIsMyLoad")?.requiredPermissions).toEqual(
      ACCESS_RULES.loadsSearch.requiredPermissions
    );
  });
});
