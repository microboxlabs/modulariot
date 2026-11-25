import { describe, expect, it } from "vitest";
import {
  EMPTY_LAYOUT,
  addDraftFile,
  addFolder,
  buildTree,
  copyNode,
  isFaceted,
  NO_FACETS,
  countInside,
  deleteNode,
  deleteNodes,
  ensureUniqueName,
  moveNodes,
  topLevelIds,
  visibleOrder,
  moveNode,
  nameInFolder,
  nextSort,
  sortNodes,
  sortTree,
  renameNode,
  toggleFolder,
  uniqueName,
} from "./explorer-tree";
import type { ExplorerTreeNode } from "./explorer-tree.types";

const sources = [
  { id: "/dashboards/sales", name: "Sales", href: "/dashboards/sales" },
  { id: "/dashboards/fleet", name: "Fleet", href: "/dashboards/fleet" },
];

function names(nodes: ExplorerTreeNode[]): string[] {
  return nodes.map((n) => n.name);
}

function withFolders() {
  let layout = addFolder(EMPTY_LAYOUT, {
    id: "a",
    name: "Ops",
    parentId: null,
  });
  layout = addFolder(layout, { id: "b", name: "Daily", parentId: "a" });
  return layout;
}

describe("explorer tree", () => {
  it("lists folders before files, each alphabetically", () => {
    const layout = addFolder(EMPTY_LAYOUT, {
      id: "f",
      name: "Zeta",
      parentId: null,
    });
    expect(names(buildTree(layout, sources))).toEqual([
      "Zeta",
      "Fleet",
      "Sales",
    ]);
  });

  it("moves a source file into a folder and back to the top level", () => {
    const moved = moveNode(withFolders(), "/dashboards/sales", "b");
    const tree = buildTree(moved, sources);
    expect(names(tree)).toEqual(["Ops", "Fleet"]);
    expect(names(tree[0]!.children[0]!.children)).toEqual(["Sales"]);

    const back = moveNode(moved, "/dashboards/sales", null);
    expect(names(buildTree(back, sources))).toEqual(["Ops", "Fleet", "Sales"]);
  });

  it("moves draft files and folders", () => {
    let layout = addDraftFile(withFolders(), {
      id: "d",
      name: "Draft",
      parentId: null,
    });
    layout = moveNode(layout, "d", "a");
    layout = moveNode(layout, "b", null);
    expect(layout.drafts["d"]?.parentId).toBe("a");
    expect(layout.folders["b"]?.parentId).toBeNull();
  });

  it("refuses to move a folder into itself or a descendant", () => {
    const layout = withFolders();
    expect(moveNode(layout, "a", "a")).toBe(layout);
    expect(moveNode(layout, "a", "b")).toBe(layout);
  });

  it("refuses to move into a folder that does not exist", () => {
    const layout = withFolders();
    expect(moveNode(layout, "/dashboards/sales", "missing")).toBe(layout);
  });

  it("expands the folder something is dropped into", () => {
    const layout = toggleFolder(withFolders(), "a");
    expect(layout.expanded["a"]).toBe(false);
    expect(moveNode(layout, "/dashboards/fleet", "a").expanded["a"]).toBe(true);
  });

  it("renames folders and drafts but not source files", () => {
    let layout = addDraftFile(withFolders(), {
      id: "d",
      name: "Draft",
      parentId: null,
    });
    layout = renameNode(layout, "a", "  Operations ");
    layout = renameNode(layout, "d", "Report");
    expect(layout.folders["a"]?.name).toBe("Operations");
    expect(layout.drafts["d"]?.name).toBe("Report");
    expect(renameNode(layout, "/dashboards/sales", "X")).toBe(layout);
    expect(renameNode(layout, "a", "   ")).toBe(layout);
  });

  it("keeps the folders that lead to a search match", () => {
    const layout = moveNode(withFolders(), "/dashboards/sales", "b");
    const tree = buildTree(layout, sources, "sal");
    expect(names(tree)).toEqual(["Ops"]);
    expect(names(tree[0]!.children)).toEqual(["Daily"]);
    expect(names(tree[0]!.children[0]!.children)).toEqual(["Sales"]);
  });

  it("drops a source file whose dashboard disappeared", () => {
    const layout = moveNode(withFolders(), "/dashboards/sales", "a");
    const tree = buildTree(layout, [sources[1]!]);
    expect(tree[0]!.children.map((n) => n.name)).toEqual(["Daily"]);
  });

  it("numbers a clashing name dash(1), dash(2)…", () => {
    expect(uniqueName("dash", new Set())).toBe("dash");
    expect(uniqueName("dash", new Set(["dash"]))).toBe("dash(1)");
    expect(uniqueName("dash", new Set(["dash", "dash(1)", "dash(2)"]))).toBe(
      "dash(3)"
    );
    // A numbered name counts up from its own base, not "dash(1)(1)".
    expect(uniqueName("dash(1)", new Set(["dash", "dash(1)"]))).toBe("dash(2)");
    // Parentheses that are not a counter stay part of the name.
    expect(uniqueName("Q1 (draft)", new Set(["Q1 (draft)"]))).toBe(
      "Q1 (draft)(1)"
    );
  });

  it("renames a new or renamed item that clashes in its folder", () => {
    let layout = addDraftFile(EMPTY_LAYOUT, {
      id: "d1",
      name: "dash",
      parentId: null,
    });
    layout = addDraftFile(layout, { id: "d2", name: "dash", parentId: null });
    layout = ensureUniqueName(layout, "d2", sources);
    expect(layout.drafts["d2"]?.name).toBe("dash(1)");

    // Renaming to a taken name lands on the next free number.
    layout = addDraftFile(layout, { id: "d3", name: "other", parentId: null });
    layout = ensureUniqueName(renameNode(layout, "d3", "dash"), "d3", sources);
    expect(layout.drafts["d3"]?.name).toBe("dash(2)");

    // Same name in a different folder is fine.
    layout = addFolder(layout, { id: "f", name: "Ops", parentId: null });
    layout = addDraftFile(layout, { id: "d4", name: "dash", parentId: "f" });
    expect(ensureUniqueName(layout, "d4", sources)).toBe(layout);
  });

  it("renames what is moved into a folder that has the name already", () => {
    let layout = addFolder(EMPTY_LAYOUT, {
      id: "f",
      name: "Ops",
      parentId: null,
    });
    layout = addDraftFile(layout, { id: "d1", name: "Sales", parentId: "f" });
    layout = addDraftFile(layout, { id: "d2", name: "Sales", parentId: null });
    layout = moveNodes(layout, ["d2"], "f", sources);
    expect(layout.drafts["d2"]?.name).toBe("Sales(1)");
  });

  it("shows a moved dashboard as name(1) and drops it once it moves away", () => {
    let layout = addFolder(EMPTY_LAYOUT, {
      id: "f",
      name: "Ops",
      parentId: null,
    });
    layout = addDraftFile(layout, { id: "d", name: "Sales", parentId: "f" });
    layout = moveNodes(layout, ["/dashboards/sales"], "f", sources);
    expect(names(buildTree(layout, sources)[0]!.children)).toEqual([
      "Sales",
      "Sales(1)",
    ]);

    layout = moveNodes(layout, ["/dashboards/sales"], null, sources);
    expect(layout.sourceNames).toEqual({});
  });

  it("numbers same-named server dashboards when nothing renamed them", () => {
    const twins = [
      { id: "/dashboards/a", name: "Sales", href: "/dashboards/a" },
      { id: "/dashboards/b", name: "Sales", href: "/dashboards/b" },
    ];
    expect(names(buildTree(EMPTY_LAYOUT, twins))).toEqual([
      "Sales",
      "Sales(1)",
    ]);
  });

  it("copies a folder with everything inside it, dashboards as drafts", () => {
    let counter = 0;
    const makeId = (kind: string) => `${kind}-${++counter}`;
    const layout = moveNode(withFolders(), "/dashboards/sales", "b");
    const copied = copyNode(layout, "a", null, sources, makeId);

    const tree = buildTree(copied, sources);
    expect(names(tree)).toEqual(["Ops", "Ops(1)", "Fleet"]);
    const copy = tree[1]!;
    expect(names(copy.children)).toEqual(["Daily"]);
    const copiedSales = copy.children[0]!.children[0]!;
    expect(copiedSales.name).toBe("Sales");
    expect(copiedSales.isDraft).toBe(true);
    expect(copiedSales.href).toBeUndefined();
  });

  it("copies a folder into itself only once", () => {
    let counter = 0;
    const makeId = (kind: string) => `${kind}-${++counter}`;
    const copied = copyNode(withFolders(), "a", "a", sources, makeId);
    expect(Object.keys(copied.folders)).toHaveLength(4);
  });

  it("deletes a folder and everything inside it, hiding dashboards", () => {
    const layout = moveNode(withFolders(), "/dashboards/sales", "b");
    expect(countInside(layout, "a", sources)).toBe(2);

    const deleted = deleteNode(layout, "a", sources);
    expect(deleted.folders).toEqual({});
    expect(deleted.hidden).toEqual({ "/dashboards/sales": true });
    expect(names(buildTree(deleted, sources))).toEqual(["Fleet"]);
  });

  it("moves several items at once, carrying a selected folder's contents", () => {
    let layout = addFolder(withFolders(), {
      id: "c",
      name: "Archive",
      parentId: null,
    });
    layout = moveNode(layout, "/dashboards/sales", "b");
    // "b" sits in "a", so selecting both moves only "a".
    expect(topLevelIds(layout, ["a", "b", "/dashboards/fleet"])).toEqual([
      "a",
      "/dashboards/fleet",
    ]);

    const moved = moveNodes(
      layout,
      ["a", "b", "/dashboards/fleet"],
      "c",
      sources
    );
    expect(moved.folders["a"]?.parentId).toBe("c");
    expect(moved.folders["b"]?.parentId).toBe("a");
    expect(moved.placements["/dashboards/fleet"]).toBe("c");
  });

  it("deletes several items at once", () => {
    const deleted = deleteNodes(
      withFolders(),
      ["b", "/dashboards/fleet"],
      sources
    );
    expect(Object.keys(deleted.folders)).toEqual(["a"]);
    expect(deleted.hidden).toEqual({ "/dashboards/fleet": true });
  });

  it("lists rows in drawn order, skipping closed folders", () => {
    const layout = moveNode(withFolders(), "/dashboards/sales", "b");
    const tree = buildTree(layout, sources);
    expect(visibleOrder(tree, () => true)).toEqual([
      "a",
      "b",
      "/dashboards/sales",
      "/dashboards/fleet",
    ]);
    expect(visibleOrder(tree, (id) => id !== "a")).toEqual([
      "a",
      "/dashboards/fleet",
    ]);
  });
});

describe("the creation date filter", () => {
  // Local times, as the date picker gives them.
  const dated = [
    {
      ...sources[0]!,
      createdAt: new Date(2026, 10, 20, 9, 30).toISOString(),
    },
    {
      ...sources[1]!,
      createdAt: new Date(2026, 10, 22, 23, 59, 59).toISOString(),
    },
    { id: "/dashboards/yard", name: "Yard", href: "/dashboards/yard" },
  ];
  const within = (from: string, to: string) =>
    names(
      buildTree(EMPTY_LAYOUT, dated, "", {
        ...NO_FACETS,
        created: { from, to },
      })
    );

  it("keeps the dashboards created in the range, both ends included", () => {
    expect(within("2026-11-20 00:00:00", "2026-11-20 23:59:59")).toEqual([
      "Sales",
    ]);
    expect(within("2026-11-20 00:00:00", "2026-11-22 23:59:59")).toEqual([
      "Fleet",
      "Sales",
    ]);
    expect(within("2026-11-21 00:00:00", "2026-11-21 23:59:59")).toEqual([]);
  });

  it("leaves out a dashboard whose creation date is unknown", () => {
    expect(within("2000-01-01 00:00:00", "2100-01-01 00:00:00")).not.toContain(
      "Yard"
    );
  });

  it("counts as a header filter", () => {
    expect(isFaceted(NO_FACETS)).toBe(false);
    expect(
      isFaceted({
        ...NO_FACETS,
        created: { from: "2026-11-20 00:00:00", to: "2026-11-20 23:59:59" },
      })
    ).toBe(true);
  });
});

describe("nameInFolder", () => {
  const path = [{ name: "Ops" }, { name: "Daily" }];

  it("drops the folders a name starts with, in full or from the end", () => {
    expect(nameInFolder("Ops/Daily/Fleet", path)).toBe("Fleet");
    expect(nameInFolder("daily / Fleet", path)).toBe("Fleet");
    expect(nameInFolder("ejemplo 2/Ejemplo", [{ name: "ejemplo 2" }])).toBe(
      "Ejemplo"
    );
  });

  it("keeps a name that does not start with them, or is only them", () => {
    expect(nameInFolder("Ops/Fleet", path)).toBe("Ops/Fleet");
    expect(nameInFolder("Fleet/Daily", path)).toBe("Fleet/Daily");
    expect(nameInFolder("Daily/", path)).toBe("Daily/");
    expect(nameInFolder("Ops/Fleet", [])).toBe("Ops/Fleet");
  });

  it("shows a dashboard inside a folder without the folder's name", () => {
    const layout = moveNode(withFolders(), "/dashboards/sales", "b");
    const named = [{ ...sources[0]!, name: "Ops/Daily/Sales" }, sources[1]!];
    const daily = buildTree(layout, named)[0]!.children[0]!;
    expect(names(daily.children)).toEqual(["Sales"]);
  });
});

describe("sorting the cards", () => {
  const node = (
    name: string,
    kind: ExplorerTreeNode["kind"],
    createdAt?: string
  ): ExplorerTreeNode => ({
    id: name,
    kind,
    name,
    isDraft: false,
    children: [],
    ...(createdAt ? { createdAt } : {}),
  });
  const nodes = [
    node("Ops", "folder"),
    node("Archive", "folder"),
    node("Sales", "file", "2026-11-01T10:00:00Z"),
    node("Fleet", "file", "2026-11-20T10:00:00Z"),
    node("Yard", "file"),
    node("Budget", "file", "2026-10-01T10:00:00Z"),
  ];

  it("steps a button from off to smallest first, largest first and off", () => {
    const asc = nextSort(null, "name");
    expect(asc).toEqual({ key: "name", direction: "asc" });
    const desc = nextSort(asc, "name");
    expect(desc).toEqual({ key: "name", direction: "desc" });
    expect(nextSort(desc, "name")).toBeNull();
    // Another button starts over.
    expect(nextSort(desc, "created")).toEqual({
      key: "created",
      direction: "asc",
    });
  });

  it("orders by name either way, folders always first", () => {
    expect(names(sortNodes(nodes, { key: "name", direction: "asc" }))).toEqual([
      "Archive",
      "Ops",
      "Budget",
      "Fleet",
      "Sales",
      "Yard",
    ]);
    expect(names(sortNodes(nodes, { key: "name", direction: "desc" }))).toEqual(
      ["Ops", "Archive", "Yard", "Sales", "Fleet", "Budget"]
    );
  });

  it("orders by creation date, undated last and folders A to Z", () => {
    expect(
      names(sortNodes(nodes, { key: "created", direction: "asc" }))
    ).toEqual(["Archive", "Ops", "Budget", "Sales", "Fleet", "Yard"]);
    expect(
      names(sortNodes(nodes, { key: "created", direction: "desc" }))
    ).toEqual(["Archive", "Ops", "Fleet", "Sales", "Budget", "Yard"]);
  });

  it("orders every level of a tree", () => {
    const tree = [
      {
        ...node("Ops", "folder"),
        children: [node("A", "file"), node("B", "file")],
      },
      node("Fleet", "file"),
    ];
    const sorted = sortTree(tree, { key: "name", direction: "desc" });
    expect(names(sorted)).toEqual(["Ops", "Fleet"]);
    expect(names(sorted[0]!.children)).toEqual(["B", "A"]);
  });

  it("keeps the order it was given when off", () => {
    expect(names(sortNodes(nodes, null))).toEqual(names(nodes));
  });
});
