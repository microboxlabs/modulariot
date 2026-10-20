import { describe, expect, it } from "vitest";
import pagesConfig from "@/features/layout/models/pages-config.json";
import { getRouteRule } from "../config/route-permissions";
import { ACCESS_RULES, PERMISSIONS } from "./access-rules";
import type { AccessRule } from "./access-control";

const KNOWN_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

interface ConfigEntry {
  label: string;
  href?: string;
  requiredGroups?: string[];
  requiredPermissions?: string[];
  items?: ConfigEntry[];
}

function flatten(entries: ConfigEntry[]): ConfigEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.items ?? [])]);
}

describe("ACCESS_RULES", () => {
  it("only uses permissions from the catalog", () => {
    for (const rule of Object.values(ACCESS_RULES) as AccessRule[]) {
      for (const permission of rule.requiredPermissions ?? []) {
        expect(KNOWN_PERMISSIONS).toContain(permission);
      }
    }
  });

  it("maps each legacy group gate to its permission", () => {
    const expected: Array<[AccessRule, string[], string[]]> = [
      [
        ACCESS_RULES.adminConsole,
        ["GROUP_ALFRESCO_ADMINISTRATORS", "GROUP_MINTRAL_SYSTEM_ADMIN"],
        ["admin:console"],
      ],
      [
        ACCESS_RULES.taskUnclaim,
        ["GROUP_ALFRESCO_ADMINISTRATORS", "GROUP_MINTRAL_SYSTEM_ADMIN"],
        ["admin:task.unclaim"],
      ],
      [
        ACCESS_RULES.liveStreamsMenu,
        ["GROUP_ALFRESCO_ADMINISTRATORS"],
        ["admin:livestreams.view"],
      ],
      [ACCESS_RULES.dashboards, ["GROUP_DASHBOARD"], ["dashboards:view"]],
      [ACCESS_RULES.calendarView, ["GROUP_CALENDAR_VIEWER"], ["calendar:view"]],
      [ACCESS_RULES.calendarPlan, ["GROUP_PLANNING"], ["calendar:plan"]],
      [ACCESS_RULES.calendarAssign, ["GROUP_ASSIGNMENT"], ["calendar:assign"]],
      [
        ACCESS_RULES.bookingWrite,
        ["GROUP_PLANNING", "GROUP_ASSIGNMENT"],
        ["calendar:plan", "calendar:assign"],
      ],
      [
        ACCESS_RULES.kanban,
        ["GROUP_MINTRAL_KANBAN_ACCESS", "GROUP_GAMA_KANBAN_ACCESS"],
        ["coordination:kanban.view"],
      ],
      [
        ACCESS_RULES.loadsSearch,
        ["GROUP_MINTRAL_BUSCADOR_CARGAS"],
        ["coordination:loads.search"],
      ],
      [
        ACCESS_RULES.conversations,
        ["GROUP_CONVERSATIONS"],
        ["conversations:view"],
      ],
      [
        ACCESS_RULES.collaboratorsMenu,
        ["GROUP_COLLABORATORS_MANAGEMENT", "GROUP_COLABORATORS_MANAGEMENT"],
        ["collaborators:manage"],
      ],
    ];
    for (const [rule, groups, permissions] of expected) {
      expect(rule.requiredGroups).toEqual(groups);
      expect(rule.requiredPermissions).toEqual(permissions);
    }
  });

  it("turns the reviewer deny-list on task outcomes into task.complete", () => {
    expect(ACCESS_RULES.taskComplete).toEqual({
      blockedGroups: ["GROUP_MINTRAL_REVISOR"],
      requiredPermissions: ["coordination:task.complete"],
    });
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

  it("keeps routes that were open in groups mode free of groups", () => {
    for (const path of ["/finished", "/planning", "/calendar", "/symptoms"]) {
      expect(getRouteRule(path).requiredGroups ?? []).toEqual([]);
    }
  });
});

describe("pages-config", () => {
  const entries = flatten(pagesConfig as ConfigEntry[]);

  it("gives every group-gated entry a permission", () => {
    const missing = entries
      .filter((e) => (e.requiredGroups?.length ?? 0) > 0)
      .filter((e) => (e.requiredPermissions?.length ?? 0) === 0)
      .map((e) => e.label);
    expect(missing).toEqual([]);
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
      ACCESS_RULES.calendarMenu.requiredPermissions
    );
    expect(byLabel.get("liveStreams")?.requiredPermissions).toEqual(
      ACCESS_RULES.liveStreamsMenu.requiredPermissions
    );
    expect(byLabel.get("whereIsMyLoad")?.requiredPermissions).toEqual(
      ACCESS_RULES.loadsSearch.requiredPermissions
    );
  });

  it("opens the kanban container to anyone who can see one of its pages", () => {
    const kanban = (pagesConfig as ConfigEntry[]).find(
      (e) => e.label === "kanban"
    );
    const childPermissions = new Set(
      (kanban?.items ?? []).flatMap((item) => item.requiredPermissions ?? [])
    );
    expect(new Set(kanban?.requiredPermissions)).toEqual(childPermissions);
    expect(kanban?.requiredPermissions).toContain("coordination:finished.view");
  });
});
