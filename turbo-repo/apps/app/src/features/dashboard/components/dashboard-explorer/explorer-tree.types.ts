/**
 * The dashboards page's file/folder explorer. Folders and placements come
 * from the dashboard server; drafts exist only while a new item is named.
 */

export type ExplorerNodeKind = "file" | "folder";

/** A role on a folder, as the dashboard server names it. */
export type ExplorerFolderRole =
  | "Consumer"
  | "Contributor"
  | "Editor"
  | "Coordinator";

/** A folder created in the explorer. `parentId` null is the top level. */
export interface ExplorerFolder {
  id: string;
  name: string;
  parentId: string | null;
  /**
   * The signed-in user's role on it: Consumer sees it, Editor creates
   * inside, renames and moves it, Coordinator deletes it and manages its
   * permissions. Absent until the server says (a folder just created, or an
   * older server): the server still decides.
   */
  role?: ExplorerFolderRole;
}

/** A file created in the explorer (no backend record, so no link). */
export interface ExplorerDraftFile {
  id: string;
  name: string;
  parentId: string | null;
}

/** A file that is a real dashboard on the server. */
export interface ExplorerSourceFile {
  id: string;
  name: string;
  href: string;
  tags?: readonly string[];
  /** Starred by the signed-in user. */
  starred?: boolean;
  /** ISO-8601, when the server knows when it was created. */
  createdAt?: string;
  /** ISO-8601, its last save: an edit or a rename. */
  updatedAt?: string;
}

/** What the column headers narrow the list to, besides the search text. */
export interface ExplorerFacets {
  /** A dashboard must carry every one of these. */
  tags: readonly string[];
  starredOnly: boolean;
  /**
   * Created within these local times, both ends included ("YYYY-MM-DD
   * HH:mm:ss", as the date range picker gives them); null for any time.
   */
  created: { from: string; to: string } | null;
}

/** What a sort button orders the cards by. */
export type ExplorerSortKey = "name" | "created";

/** The cards' order; null keeps the default, folders first, A to Z. */
export interface ExplorerSort {
  key: ExplorerSortKey;
  direction: "asc" | "desc";
}

/** Everything the explorer adds on top of the source files. */
export interface ExplorerLayout {
  folders: Record<string, ExplorerFolder>;
  drafts: Record<string, ExplorerDraftFile>;
  /** Folder a source file was moved into; absent means the top level. */
  placements: Record<string, string | null>;
  expanded: Record<string, boolean>;
  /** Source files deleted in the explorer; only hidden, never deleted for real. */
  hidden: Record<string, true>;
  /**
   * Names shown for source files that would clash with a sibling ("Sales(1)").
   * The real dashboard keeps its name; only the explorer shows it this way.
   */
  sourceNames: Record<string, string>;
}

/** What copy or cut put on the explorer's clipboard. */
export interface ExplorerClipboard {
  mode: "copy" | "cut";
  ids: string[];
}

/** A node of the tree as rendered. */
export interface ExplorerTreeNode {
  id: string;
  kind: ExplorerNodeKind;
  name: string;
  href?: string;
  isDraft: boolean;
  children: ExplorerTreeNode[];
  tags?: readonly string[];
  starred?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
