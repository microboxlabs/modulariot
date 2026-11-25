/**
 * What the signed-in user may do with a folder, from their role on it. Only
 * to offer the right actions: the dashboard server checks every one again.
 */
import type { ExplorerFolder, ExplorerFolderRole } from "./explorer-tree.types";

const RANK: Record<ExplorerFolderRole, number> = {
  Consumer: 0,
  Contributor: 1,
  Editor: 2,
  Coordinator: 3,
};

export type FolderAbility = "edit" | "manage";

const NEEDS: Record<FolderAbility, ExplorerFolderRole> = {
  edit: "Editor",
  manage: "Coordinator",
};

/**
 * Whether the folder's role allows `ability`: creating inside, renaming and
 * moving it ("edit"), or deleting it and managing its permissions
 * ("manage"). A folder without a role (just created, older server) allows
 * everything here and leaves the refusal to the server.
 */
export function folderAllows(
  folder: Pick<ExplorerFolder, "role"> | undefined,
  ability: FolderAbility
): boolean {
  if (folder?.role === undefined) return true;
  return RANK[folder.role] >= RANK[NEEDS[ability]];
}
