import { AsyncLocalStorage } from "node:async_hooks";
import type { DashboardFolderStore, FolderScope } from "../seams/folders";
import type { ScopeVisibility } from "./visibility";

type Cache = WeakMap<
  DashboardFolderStore,
  Map<string, Promise<ScopeVisibility>>
>;
const current = new AsyncLocalStorage<Cache | undefined>();

/** A fresh cache starts after acquiring the mutation's scope transaction. */
export function withVisibilitySnapshot<T>(body: () => Promise<T>): Promise<T> {
  return current.run(new WeakMap(), body);
}

/** A new HTTP request never inherits another request's cached authorization data. */
export function withoutVisibilitySnapshot<T>(
  body: () => Promise<T>,
): Promise<T> {
  return current.run(undefined, body);
}

export function cachedVisibility(
  folders: DashboardFolderStore,
  scope: FolderScope,
  load: () => Promise<ScopeVisibility>,
): Promise<ScopeVisibility> {
  const cache = current.getStore();
  if (!cache) return load();
  let scopes = cache.get(folders);
  if (!scopes) {
    scopes = new Map();
    cache.set(folders, scopes);
  }
  const key = JSON.stringify([scope.tenantId, scope.scopeId]);
  let loaded = scopes.get(key);
  if (!loaded) {
    loaded = load();
    scopes.set(key, loaded);
  }
  return loaded;
}
