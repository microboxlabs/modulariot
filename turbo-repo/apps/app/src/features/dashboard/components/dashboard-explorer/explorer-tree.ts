/**
 * Pure operations over the explorer layout: names, moves, uniqueness.
 * Kept free of React so they are tested on their own.
 */
import type {
  ExplorerFacets,
  ExplorerSort,
  ExplorerSortKey,
  ExplorerLayout,
  ExplorerSourceFile,
  ExplorerTreeNode,
} from "./explorer-tree.types";

export const EMPTY_LAYOUT: ExplorerLayout = {
  folders: {},
  drafts: {},
  placements: {},
  expanded: {},
  hidden: {},
  sourceNames: {},
};

/** Whether `folderId` is `ancestorId` or sits somewhere below it. */
export function isWithinFolder(
  layout: ExplorerLayout,
  folderId: string | null,
  ancestorId: string
): boolean {
  let current = folderId;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = layout.folders[current]?.parentId ?? null;
  }
  return false;
}

/** A folder's parent, ignoring folders that no longer exist. */
function existingFolder(
  layout: ExplorerLayout,
  folderId: string | null | undefined
): string | null {
  return folderId && layout.folders[folderId] ? folderId : null;
}

export function addFolder(
  layout: ExplorerLayout,
  folder: { id: string; name: string; parentId: string | null }
): ExplorerLayout {
  const parentId = existingFolder(layout, folder.parentId);
  return {
    ...layout,
    folders: { ...layout.folders, [folder.id]: { ...folder, parentId } },
    expanded: {
      ...layout.expanded,
      [folder.id]: true,
      ...(parentId ? { [parentId]: true } : {}),
    },
  };
}

export function addDraftFile(
  layout: ExplorerLayout,
  file: { id: string; name: string; parentId: string | null }
): ExplorerLayout {
  const parentId = existingFolder(layout, file.parentId);
  return {
    ...layout,
    drafts: { ...layout.drafts, [file.id]: { ...file, parentId } },
    expanded: parentId
      ? { ...layout.expanded, [parentId]: true }
      : layout.expanded,
  };
}

/**
 * Moves a file or folder into `targetFolderId` (null = top level). A folder
 * cannot move into itself or one of its own subfolders; such a move, or one to
 * a folder that does not exist, returns the layout unchanged.
 */
export function moveNode(
  layout: ExplorerLayout,
  nodeId: string,
  targetFolderId: string | null
): ExplorerLayout {
  if (targetFolderId !== null && !layout.folders[targetFolderId]) {
    return layout;
  }
  const expanded = targetFolderId
    ? { ...layout.expanded, [targetFolderId]: true }
    : layout.expanded;

  const folder = layout.folders[nodeId];
  if (folder) {
    if (isWithinFolder(layout, targetFolderId, nodeId)) return layout;
    if (folder.parentId === targetFolderId) return layout;
    return {
      ...layout,
      folders: {
        ...layout.folders,
        [nodeId]: { ...folder, parentId: targetFolderId },
      },
      expanded,
    };
  }

  const draft = layout.drafts[nodeId];
  if (draft) {
    if (draft.parentId === targetFolderId) return layout;
    return {
      ...layout,
      drafts: {
        ...layout.drafts,
        [nodeId]: { ...draft, parentId: targetFolderId },
      },
      expanded,
    };
  }

  if ((layout.placements[nodeId] ?? null) === targetFolderId) return layout;
  return {
    ...layout,
    placements: { ...layout.placements, [nodeId]: targetFolderId },
    expanded,
  };
}

/** Renames a folder or draft file; source files keep their real name. */
export function renameNode(
  layout: ExplorerLayout,
  nodeId: string,
  name: string
): ExplorerLayout {
  const trimmed = name.trim();
  if (!trimmed) return layout;
  const folder = layout.folders[nodeId];
  if (folder) {
    return {
      ...layout,
      folders: { ...layout.folders, [nodeId]: { ...folder, name: trimmed } },
    };
  }
  const draft = layout.drafts[nodeId];
  if (draft) {
    return {
      ...layout,
      drafts: { ...layout.drafts, [nodeId]: { ...draft, name: trimmed } },
    };
  }
  return layout;
}

export function toggleFolder(
  layout: ExplorerLayout,
  folderId: string
): ExplorerLayout {
  return {
    ...layout,
    expanded: { ...layout.expanded, [folderId]: !layout.expanded[folderId] },
  };
}

function visibleSources(
  layout: ExplorerLayout,
  sources: readonly ExplorerSourceFile[]
): ExplorerSourceFile[] {
  return sources.filter((source) => !layout.hidden[source.id]);
}

/** The folder holding a node; null for the top level. */
export function parentOf(layout: ExplorerLayout, id: string): string | null {
  const parentId =
    layout.folders[id]?.parentId ??
    layout.drafts[id]?.parentId ??
    layout.placements[id];
  return existingFolder(layout, parentId);
}

/**
 * The folders from the top level down to `folderId`, itself last; empty for
 * the top level or a folder that no longer exists.
 */
export function folderPath(
  layout: ExplorerLayout,
  folderId: string | null
): { id: string; name: string }[] {
  const path: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let id = existingFolder(layout, folderId);
  // A cycle cannot come from the server, but must not hang the page either.
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const folder = layout.folders[id]!;
    path.unshift({ id, name: folder.name });
    id = existingFolder(layout, folder.parentId);
  }
  return path;
}

/**
 * A dashboard's name without the folders it is in, for names saved as
 * "Ops/Daily/Fleet" or "Daily / Fleet": inside Ops › Daily it is "Fleet".
 * Only the end of the folder path counts, and the name is kept whole when
 * nothing would be left of it.
 */
export function nameInFolder(
  name: string,
  path: readonly { name: string }[]
): string {
  const names = path.map((folder) => folder.name.trim().toLowerCase());
  for (let start = 0; start < names.length; start++) {
    const parts = name.split("/");
    const prefix = parts
      .slice(0, names.length - start)
      .map((part) => part.trim().toLowerCase());
    if (prefix.length !== names.length - start) continue;
    if (prefix.join("/") !== names.slice(start).join("/")) continue;
    const rest = parts
      .slice(names.length - start)
      .join("/")
      .trim();
    if (rest) return rest;
  }
  return name;
}

/** Ids of everything directly inside `folderId` (null = top level). */
function childIds(
  layout: ExplorerLayout,
  folderId: string | null,
  sources: readonly ExplorerSourceFile[]
): string[] {
  const ids = [...Object.keys(layout.folders), ...Object.keys(layout.drafts)];
  for (const source of visibleSources(layout, sources)) ids.push(source.id);
  return ids.filter((id) => parentOf(layout, id) === folderId);
}

/** Ids of everything below a folder, at any depth. */
function descendantIds(
  layout: ExplorerLayout,
  folderId: string,
  sources: readonly ExplorerSourceFile[]
): string[] {
  const found: string[] = [];
  const pending = [folderId];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const id of childIds(layout, current, sources)) {
      found.push(id);
      if (layout.folders[id]) pending.push(id);
    }
  }
  return found;
}

/** How many files and folders sit below a folder, at any depth. */
export function countInside(
  layout: ExplorerLayout,
  folderId: string,
  sources: readonly ExplorerSourceFile[]
): number {
  return descendantIds(layout, folderId, sources).length;
}

function omit<T>(record: Record<string, T>, ids: Set<string>) {
  return Object.fromEntries(
    Object.entries(record).filter(([id]) => !ids.has(id))
  );
}

/**
 * Deletes a node and, for a folder, everything below it. Source files are only
 * hidden: deleting the dashboard itself is the server's job.
 */
export function deleteNode(
  layout: ExplorerLayout,
  id: string,
  sources: readonly ExplorerSourceFile[]
): ExplorerLayout {
  const ids = new Set([id]);
  if (layout.folders[id]) {
    for (const inside of descendantIds(layout, id, sources)) ids.add(inside);
  }
  const hidden = { ...layout.hidden };
  for (const source of sources) {
    if (ids.has(source.id)) hidden[source.id] = true;
  }
  return {
    folders: omit(layout.folders, ids),
    drafts: omit(layout.drafts, ids),
    placements: omit(layout.placements, ids),
    expanded: omit(layout.expanded, ids),
    hidden,
    sourceNames: omit(layout.sourceNames, ids),
  };
}

/** The name a node shows, including a source file's de-duplicated name. */
export function nameOf(
  layout: ExplorerLayout,
  id: string,
  sources: readonly ExplorerSourceFile[]
): string | undefined {
  return (
    layout.folders[id]?.name ??
    layout.drafts[id]?.name ??
    layout.sourceNames[id] ??
    sources.find((source) => source.id === id)?.name
  );
}

/** "dash(2)" → "dash"; a name without a "(n)" suffix comes back as is. */
function stripCounter(name: string): string {
  const open = name.lastIndexOf("(");
  if (open <= 0 || !name.endsWith(")")) return name;
  const digits = name.slice(open + 1, -1);
  const isCounter =
    digits.length > 0 && [...digits].every((c) => c >= "0" && c <= "9");
  return isCounter ? name.slice(0, open) : name;
}

/** `name`, or "name(1)", "name(2)"… when a sibling already has it. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const base = stripCounter(name);
  let n = 1;
  while (taken.has(`${base}(${n})`)) n++;
  return `${base}(${n})`;
}

/** Names of everything directly inside `folderId` (null = top level). */
export function namesInFolder(
  layout: ExplorerLayout,
  folderId: string | null,
  sources: readonly ExplorerSourceFile[]
): Set<string> {
  return new Set(
    childIds(layout, folderId, sources).map(
      (id) => nameOf(layout, id, sources) ?? ""
    )
  );
}

/** Names of a node's siblings, leaving the node itself out. */
function siblingNames(
  layout: ExplorerLayout,
  id: string,
  sources: readonly ExplorerSourceFile[]
): Set<string> {
  const siblings = childIds(layout, parentOf(layout, id), sources);
  return new Set(
    siblings
      .filter((sibling) => sibling !== id)
      .map((sibling) => nameOf(layout, sibling, sources) ?? "")
  );
}

/**
 * Gives a node a name no sibling in its folder has, adding "(1)", "(2)"…
 * Folders and drafts are renamed; a source file gets a shown name instead,
 * worked out again from its real name every time so it drops the suffix once
 * the clash is gone.
 */
export function ensureUniqueName(
  layout: ExplorerLayout,
  id: string,
  sources: readonly ExplorerSourceFile[]
): ExplorerLayout {
  const taken = siblingNames(layout, id, sources);
  const folder = layout.folders[id];
  if (folder) {
    const name = uniqueName(folder.name, taken);
    if (name === folder.name) return layout;
    return {
      ...layout,
      folders: { ...layout.folders, [id]: { ...folder, name } },
    };
  }
  const draft = layout.drafts[id];
  if (draft) {
    const name = uniqueName(draft.name, taken);
    if (name === draft.name) return layout;
    return {
      ...layout,
      drafts: { ...layout.drafts, [id]: { ...draft, name } },
    };
  }
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) return layout;
  const name = uniqueName(source.name, taken);
  const { [id]: previous, ...others } = layout.sourceNames;
  if (name === source.name) {
    return previous === undefined ? layout : { ...layout, sourceNames: others };
  }
  if (previous === name) return layout;
  return { ...layout, sourceNames: { ...others, [id]: name } };
}

/**
 * Copies a node (a folder with everything below it) into `targetFolderId`.
 * Copies are new local items: a copied dashboard becomes a draft file; the
 * server-side copy is made by use-explorer-actions. The top copied node gets a
 * unique name among its new siblings. Returns the layout unchanged when the
 * node or the target does not exist.
 */
export function copyNode(
  layout: ExplorerLayout,
  id: string,
  targetFolderId: string | null,
  sources: readonly ExplorerSourceFile[],
  makeId: (kind: "folder" | "draft") => string
): ExplorerLayout {
  const rootName = nameOf(layout, id, sources);
  const targetMissing =
    targetFolderId !== null && !layout.folders[targetFolderId];
  if (rootName === undefined || targetMissing) return layout;

  const taken = new Set(
    childIds(layout, targetFolderId, sources).map(
      (child) => nameOf(layout, child, sources) ?? ""
    )
  );
  let next = layout;
  // Walks the original layout so a folder pasted into itself copies once.
  const queue: { from: string; parentId: string | null; name: string }[] = [
    { from: id, parentId: targetFolderId, name: uniqueName(rootName, taken) },
  ];
  while (queue.length > 0) {
    const { from, parentId, name } = queue.shift() as (typeof queue)[number];
    if (!layout.folders[from]) {
      next = addDraftFile(next, { id: makeId("draft"), name, parentId });
      continue;
    }
    const copyId = makeId("folder");
    next = addFolder(next, { id: copyId, name, parentId });
    for (const child of childIds(layout, from, sources)) {
      const childName = nameOf(layout, child, sources) ?? "";
      queue.push({ from: child, parentId: copyId, name: childName });
    }
  }
  return next;
}

function byKindThenName(a: ExplorerTreeNode, b: ExplorerTreeNode): number {
  if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function matches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query);
}

/** Keeps the nodes that match, folders whose subtree matches, and whole matching folders. */
export const NO_FACETS: ExplorerFacets = {
  tags: [],
  starredOnly: false,
  created: null,
};

/** Whether a header filter (tags, star or creation date) narrows the list. */
export function isFaceted(facets: ExplorerFacets): boolean {
  return (
    facets.tags.length > 0 || facets.starredOnly || facets.created !== null
  );
}

/**
 * Created within the range. A dashboard whose creation time is unknown is
 * left out: nothing says it falls inside.
 */
function createdWithin(
  createdAt: string | undefined,
  range: ExplorerFacets["created"]
): boolean {
  if (range === null) return true;
  const time = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (Number.isNaN(time)) return false;
  return time >= localTime(range.from) && time <= localTime(range.to);
}

/** "YYYY-MM-DD HH:mm:ss" in the viewer's own time zone, as epoch ms. */
function localTime(value: string): number {
  return new Date(value.replace(" ", "T")).getTime();
}

interface TreeFilter {
  /** Lower-cased search text; empty matches every name. */
  query: string;
  facets: ExplorerFacets;
  /** Whether a tag, the star or the creation date narrows the list. */
  faceted: boolean;
}

/** A file kept by the filter. An item still being named is never hidden. */
function fileMatches(node: ExplorerTreeNode, filter: TreeFilter): boolean {
  if (node.isDraft) return true;
  if (filter.query && !matches(node.name, filter.query)) return false;
  if (filter.facets.starredOnly && !node.starred) return false;
  if (!createdWithin(node.createdAt, filter.facets.created)) return false;
  const tags = node.tags ?? [];
  return filter.facets.tags.every((tag) => tags.includes(tag));
}

/**
 * Keeps matching files and the folders leading to them. A folder whose own
 * name matches the search is kept whole, unless a header filter narrows the
 * list: folders carry no tags, star or date, so then only their matches count.
 */
function filterTree(
  nodes: ExplorerTreeNode[],
  filter: TreeFilter
): ExplorerTreeNode[] {
  const kept: ExplorerTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      if (fileMatches(node, filter)) kept.push(node);
      continue;
    }
    if (filter.query && !filter.faceted && matches(node.name, filter.query)) {
      kept.push(node);
      continue;
    }
    const children = filterTree(node.children, filter);
    if (children.length > 0) kept.push({ ...node, children });
  }
  return kept;
}

/**
 * A filtered tree as one flat level, for the cards: every dashboard that
 * matched, wherever it sits, and the folders whose own name matches the
 * search. Folders first, then dashboards, each alphabetical.
 */
export function flatMatches(
  tree: readonly ExplorerTreeNode[],
  query: string
): ExplorerTreeNode[] {
  const normalized = query.trim().toLowerCase();
  const found: ExplorerTreeNode[] = [];
  const visit = (nodes: readonly ExplorerTreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "file") found.push(node);
      else {
        if (normalized && matches(node.name, normalized)) found.push(node);
        visit(node.children);
      }
    }
  };
  visit(tree);
  return found.sort(byKindThenName);
}

/** Every node of a tree by id, however deep. */
export function nodesById(
  tree: readonly ExplorerTreeNode[]
): Map<string, ExplorerTreeNode> {
  const byId = new Map<string, ExplorerTreeNode>();
  const visit = (nodes: readonly ExplorerTreeNode[]) => {
    for (const node of nodes) {
      byId.set(node.id, node);
      visit(node.children);
    }
  };
  visit(tree);
  return byId;
}

/** Every tag on the given dashboards, each once, sorted. */
export function allTags(sources: readonly ExplorerSourceFile[]): string[] {
  const tags = new Set<string>();
  for (const source of sources)
    for (const tag of source.tags ?? []) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/**
 * Last guard against same-named siblings nothing renamed (two server
 * dashboards sharing a name): later ones show "(1)", "(2)"…
 */
function withShownName(taken: Set<string>) {
  return (node: ExplorerTreeNode): ExplorerTreeNode => {
    const name = uniqueName(node.name, taken);
    taken.add(name);
    return name === node.name ? node : { ...node, name };
  };
}

/**
 * Builds the rendered tree: folders first, then files, each alphabetical.
 * Source files placed in a folder that no longer exists fall back to the top
 * level. A non-empty `query` keeps only matches and the folders leading to them.
 */
export function buildTree(
  layout: ExplorerLayout,
  sources: readonly ExplorerSourceFile[],
  query = "",
  facets: ExplorerFacets = NO_FACETS,
  /** The folder whose contents are the tree's top level; null for all. */
  rootId: string | null = null
): ExplorerTreeNode[] {
  const childrenOf = new Map<string | null, ExplorerTreeNode[]>();
  const push = (parentId: string | null, node: ExplorerTreeNode) => {
    const list = childrenOf.get(parentId) ?? [];
    list.push(node);
    childrenOf.set(parentId, list);
  };

  for (const folder of Object.values(layout.folders)) {
    push(existingFolder(layout, folder.parentId), {
      id: folder.id,
      kind: "folder",
      name: folder.name,
      isDraft: false,
      children: [],
    });
  }
  for (const draft of Object.values(layout.drafts)) {
    push(existingFolder(layout, draft.parentId), {
      id: draft.id,
      kind: "file",
      name: draft.name,
      isDraft: true,
      children: [],
    });
  }
  for (const source of visibleSources(layout, sources)) {
    const folderId = existingFolder(layout, layout.placements[source.id]);
    push(folderId, {
      id: source.id,
      kind: "file",
      name: nameInFolder(
        layout.sourceNames[source.id] ?? source.name,
        folderPath(layout, folderId)
      ),
      href: source.href,
      isDraft: false,
      children: [],
      tags: source.tags ?? [],
      starred: source.starred === true,
      ...(source.createdAt ? { createdAt: source.createdAt } : {}),
      ...(source.updatedAt ? { updatedAt: source.updatedAt } : {}),
    });
  }

  const assemble = (parentId: string | null): ExplorerTreeNode[] =>
    (childrenOf.get(parentId) ?? [])
      .map((node) =>
        node.kind === "folder" ? { ...node, children: assemble(node.id) } : node
      )
      .sort(byKindThenName)
      .map(withShownName(new Set()));

  const tree = assemble(existingFolder(layout, rootId));
  const normalized = query.trim().toLowerCase();
  const faceted = isFaceted(facets);
  if (!normalized && !faceted) return tree;
  return filterTree(tree, { query: normalized, facets, faceted });
}

/**
 * Drops ids that sit inside another selected folder: acting on the folder
 * already carries them along.
 */
export function topLevelIds(
  layout: ExplorerLayout,
  ids: readonly string[]
): string[] {
  const folders = ids.filter((id) => layout.folders[id]);
  return ids.filter(
    (id) =>
      !folders.some(
        (folderId) =>
          folderId !== id &&
          isWithinFolder(layout, parentOf(layout, id), folderId)
      )
  );
}

/** Moves each node, renaming any that would clash in the target folder. */
export function moveNodes(
  layout: ExplorerLayout,
  ids: readonly string[],
  targetFolderId: string | null,
  sources: readonly ExplorerSourceFile[]
): ExplorerLayout {
  return topLevelIds(layout, ids).reduce((current, id) => {
    const moved = moveNode(current, id, targetFolderId);
    return moved === current ? current : ensureUniqueName(moved, id, sources);
  }, layout);
}

export function deleteNodes(
  layout: ExplorerLayout,
  ids: readonly string[],
  sources: readonly ExplorerSourceFile[]
): ExplorerLayout {
  return topLevelIds(layout, ids).reduce(
    (current, id) => deleteNode(current, id, sources),
    layout
  );
}

/** Node ids in the order the rows are drawn, skipping closed folders' contents. */
export function visibleOrder(
  nodes: readonly ExplorerTreeNode[],
  isExpanded: (id: string) => boolean
): string[] {
  return nodes.flatMap((node) =>
    node.kind === "folder" && isExpanded(node.id)
      ? [node.id, ...visibleOrder(node.children, isExpanded)]
      : [node.id]
  );
}

/**
 * A sort button's next step: off, then smallest first, then largest first,
 * then off again. Another key starts over at smallest first.
 */
export function nextSort(
  current: ExplorerSort | null,
  key: ExplorerSortKey
): ExplorerSort | null {
  if (current?.key !== key) return { key, direction: "asc" };
  return current.direction === "asc" ? { key, direction: "desc" } : null;
}

/** Creation time in ms; null when unknown or unreadable. */
function createdTime(node: ExplorerTreeNode): number | null {
  if (!node.createdAt) return null;
  const time = Date.parse(node.createdAt);
  return Number.isNaN(time) ? null : time;
}

function byCreated(
  a: ExplorerTreeNode,
  b: ExplorerTreeNode,
  sign: number
): number {
  const ta = createdTime(a);
  const tb = createdTime(b);
  // Undated ones go last whichever way, by name.
  if (ta === null && tb === null) return byKindThenName(a, b);
  if (ta === null) return 1;
  if (tb === null) return -1;
  return ta === tb ? byKindThenName(a, b) : sign * (ta - tb);
}

/**
 * One level of cards in the given order, folders always first. Folders have
 * no creation date, so by date they stay A to Z.
 */
export function sortNodes(
  nodes: readonly ExplorerTreeNode[],
  sort: ExplorerSort | null
): ExplorerTreeNode[] {
  if (!sort) return [...nodes];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    if (sort.key === "name") return sign * byKindThenName(a, b);
    return a.kind === "folder" ? byKindThenName(a, b) : byCreated(a, b, sign);
  });
}

/** The whole tree in the given order, every level, folders first. */
export function sortTree(
  nodes: readonly ExplorerTreeNode[],
  sort: ExplorerSort | null
): ExplorerTreeNode[] {
  if (!sort) return [...nodes];
  return sortNodes(nodes, sort).map((node) =>
    node.kind === "folder"
      ? { ...node, children: sortTree(node.children, sort) }
      : node
  );
}
