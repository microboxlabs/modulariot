import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, MouseEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExplorerPanel from "./explorer-panel";
import { readExplorerLayout, resetExplorerLayout } from "./explorer-store";
import { resetExplorerView } from "./explorer-navigation";
import type * as ServerModule from "./use-explorer-server";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: notify,
}));

const { push, fake } = vi.hoisted(() => {
  interface Dashboard {
    slug: string;
    name: string;
    folderId?: string;
    tags?: string[];
    starred?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }
  interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    role?: "Consumer" | "Editor" | "Coordinator";
  }
  interface Grant {
    authorityId: string;
    role: "Consumer" | "Contributor" | "Editor" | "Coordinator";
  }
  interface State {
    dashboards: Dashboard[];
    folders: Folder[];
    loading?: boolean;
    /** The list could not be read; trying again reads it. */
    loadError?: boolean;
    /** The caller's recent opens, newest first. */
    recent?: { id: string; openedAt: string }[];
    grants?: Record<
      string,
      { assignments: Grant[]; visibility: "organization" | "restricted" }
    >;
  }
  const initial = (): State => ({
    dashboards: [
      {
        slug: "sales",
        name: "Sales",
        tags: ["finance", "ops"],
        // Created today: the only one that gets the "New" badge.
        createdAt: new Date().toISOString(),
      },
      {
        slug: "fleet",
        name: "Fleet",
        tags: ["ops"],
        starred: true,
        createdAt: "2026-01-15T10:00:00.000Z",
      },
      { slug: "yard", name: "Yard" },
    ],
    folders: [],
  });
  let state = initial();
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    for (const listener of listeners) listener();
    return Promise.resolve();
  };
  return {
    push: vi.fn(),
    /** An in-memory dashboard server with the same answers as the real one. */
    fake: {
      reset() {
        state = initial();
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      get: () => state,
      set,
    },
  };
});

vi.mock("./use-explorer-server", async (importOriginal) => {
  const original = await importOriginal<typeof ServerModule>();
  const React = await import("react");
  const { dashboardHref, slugOfHref, freeSlug } = original;
  const slugOf = (id: string) => slugOfHref(id) ?? id;

  function build(
    state: ReturnType<typeof fake.get>
  ): ServerModule.ExplorerServer {
    const now = fake.get;
    const saveNew = async (name: string, folderId: string | null) => {
      const state = now();
      const slug = freeSlug(name, new Set(state.dashboards.map((d) => d.slug)));
      await fake.set({
        ...state,
        dashboards: [
          ...state.dashboards,
          { slug, name, ...(folderId ? { folderId } : {}) },
        ],
      });
      return dashboardHref(slug);
    };
    const inside = (id: string): string[] => [
      id,
      ...now()
        .folders.filter((f) => f.parentId === id)
        .flatMap((f) => inside(f.id)),
    ];
    return {
      sources: state.dashboards.map((d) => ({
        id: dashboardHref(d.slug),
        name: d.name,
        href: dashboardHref(d.slug),
        tags: d.tags ?? [],
        starred: d.starred === true,
        ...(d.createdAt ? { createdAt: d.createdAt } : {}),
        ...(d.updatedAt ? { updatedAt: d.updatedAt } : {}),
      })),
      folders: Object.fromEntries(state.folders.map((f) => [f.id, f])),
      placements: Object.fromEntries(
        state.dashboards
          .filter((d) => d.folderId !== undefined)
          .map((d) => [dashboardHref(d.slug), d.folderId ?? null])
      ),
      isLoading: state.loading === true,
      loadError: state.loadError === true,
      canCreate: true,
      createDashboard: saveNew,
      copyDashboard: async (_id, name, folderId) => {
        await saveNew(name, folderId);
      },
      deleteDashboard: (id) =>
        fake.set({
          ...now(),
          dashboards: now().dashboards.filter((d) => d.slug !== slugOf(id)),
        }),
      fileDashboard: (id, folderId) =>
        fake.set({
          ...now(),
          dashboards: now().dashboards.map((d) =>
            d.slug === slugOf(id)
              ? { ...d, folderId: folderId ?? undefined }
              : d
          ),
        }),
      createFolder: (name, parentId) =>
        fake.set({
          ...now(),
          folders: [
            ...now().folders,
            { id: `f${now().folders.length + 1}-${name}`, name, parentId },
          ],
        }),
      updateFolder: (id, patch) =>
        fake.set({
          ...now(),
          folders: now().folders.map((f) =>
            f.id === id ? { ...f, ...patch } : f
          ),
        }),
      deleteFolder: (id) => {
        const gone = new Set(inside(id));
        return fake.set({
          folders: now().folders.filter((f) => !gone.has(f.id)),
          dashboards: now().dashboards.filter(
            (d) => d.folderId === undefined || !gone.has(d.folderId)
          ),
        });
      },
      setStarred: (id, starred) =>
        fake.set({
          ...now(),
          dashboards: now().dashboards.map((d) =>
            d.slug === slugOf(id) ? { ...d, starred } : d
          ),
        }),
      setTags: (id, tags) =>
        fake.set({
          ...now(),
          dashboards: now().dashboards.map((d) =>
            d.slug === slugOf(id) ? { ...d, tags: [...tags] } : d
          ),
        }),
      renameDashboard: (id, name) =>
        fake.set({
          ...now(),
          dashboards: now().dashboards.map((d) =>
            d.slug === slugOf(id) ? { ...d, name } : d
          ),
        }),
      folderPermissions: async (id) =>
        now().grants?.[id] ?? { assignments: [], visibility: "organization" },
      setFolderPermissions: (id, permissions) =>
        fake.set({
          ...now(),
          grants: { ...now().grants, [id]: permissions },
        }),
      refresh: () => fake.set({ ...now(), loadError: false }),
      recent: state.recent ?? [],
    };
  }

  return {
    ...original,
    useExplorerServer: () => {
      const state = React.useSyncExternalStore(
        fake.subscribe,
        fake.get,
        fake.get
      );
      return React.useMemo(() => build(state), [state]);
    },
  };
});

vi.mock(
  "../dashboard-setup/use-principal-directory",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    usePrincipalDirectory: () => ({
      principals: [
        { authorityId: "ana@test.example", kind: "member", name: "Ana" },
      ],
      isLoading: false,
    }),
  })
);

vi.mock("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/en/dashboards/sales",
  useRouter: () => ({ push }),
  // Read on every render, as the real hook follows history.pushState.
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
}));

// jsdom cannot navigate; a plain click on a dashboard just stays put.
vi.mock("next/link", () => ({
  default: ({
    onClick,
    children,
    ...rest
  }: ComponentProps<"a"> & { href: string }) => (
    <a
      {...rest}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

const dict = {
  filterBar: {
    today: "Today",
    last7Days: "Last 7 days",
    selectDateRange: "Select a date range",
  },
  explorer: {
    title: "Dashboards",
    search: "Search",
    new: "New",
    name: "Name",
    nameSearch: "Search by name",
    clearSearch: "Clear search",
    breadcrumb: "Folder path",
    parentFolder: 'Up to "{name}"',
    addTag: "Add tag",
    editTagsOf: 'Edit tags of "{name}"',
    emptyFolder: "This folder is empty.",
    expandFolder: 'Expand "{name}"',
    collapseFolder: 'Collapse "{name}"',
    view: { cards: "Cards", list: "List" },
    cards: {
      filters: "Filters",
      starredOnly: "Starred",
      recent: "Recently opened",
      all: "All",
      folders: "Folders",
      dashboards: "Dashboards",
      oneItem: "1 item",
      items: "{count} items",
      created: "Created {when}",
      opened: "Opened {when}",
      edited: "Edited {when}",
      sortByName: "Sort by name",
      sortedNameAsc: "Sorted by name, A to Z",
      sortedNameDesc: "Sorted by name, Z to A",
      sortByCreated: "Sort by creation date",
      sortedCreatedAsc: "Sorted by creation date, oldest first",
      sortedCreatedDesc: "Sorted by creation date, newest first",
    },
    newFile: "New file",
    newFolder: "New folder",
    untitledFile: "Untitled file",
    untitledFolder: "Untitled folder",
    namePlaceholder: "Type a name…",
    empty: "Nothing here yet",
    loadError: "Couldn't load the dashboards",
    loadErrorBody: "It may be a connection problem.",
    retry: "Try again",
    createFirst: "Create dashboard",
    noResults: "No matches",
    menu: {
      clone: "Clone",
      copy: "Copy",
      cut: "Cut",
      paste: "Paste",
      rename: "Rename",
      editTags: "Edit tags",
      delete: "Delete",
      permissions: "Permissions",
    },
    folderPermissions: {
      title: 'Permissions for "{name}"',
      body: "Who sees this folder.",
      save: "Save",
      cancel: "Cancel",
      saved: 'Permissions for "{name}" saved',
      loadError: "Could not load",
      visibility: {
        organizationHelp: "Everyone in the organization sees this folder.",
        restrictedHelp:
          "Only who is listed can see this folder and what is inside it.",
      },
    },
    columns: {
      tags: "Tags",
      created: "Created",
      createdUnknown: "Creation date unknown",
      new: "New",
      filterTags: "Filter by tag",
      clearFilter: "Clear filter",
      noTags: "No tags yet",
      starredOnly: "Show starred only",
      filterCreated: "Filter by creation date",
      folder: "Folder",
      folderNoDate: "Folders have no creation date",
      clearCreated: "Clear the date filter",
      star: "Star",
      unstar: "Unstar",
      selectAll: "Select all",
      select: 'Select "{name}"',
    },
    toasts: {
      dashboardCreated: 'Dashboard "{name}" created',
      folderCreated: 'Folder "{name}" created',
      folderRenamed: 'Folder renamed to "{name}"',
      copied: '"{name}" copied',
      copiedMany: "{count} dashboards copied",
      movedInto: '"{name}" moved to "{target}"',
      movedToTop: '"{name}" moved to the top level',
      movedManyInto: '{count} items moved to "{target}"',
      movedManyToTop: "{count} items moved to the top level",
      deleted: '"{name}" deleted',
      deletedMany: "{count} items deleted",
      starring: { loading: 'Starring "{name}"…', ok: '"{name}" starred' },
      unstarring: {
        loading: 'Unstarring "{name}"…',
        ok: '"{name}" unstarred',
      },
      tagsSaved: 'Tags saved for "{name}"',
    },
    errors: {
      forbidden: "Not allowed",
      conflict: "Name taken",
      generic: "Could not save",
    },
    tagsDialog: {
      title: 'Tags for "{name}"',
      save: "Save",
      cancel: "Cancel",
    },
    confirm: {
      deleteTitle: 'Delete "{name}"?',
      deleteManyTitle: "Delete {count} items?",
      moveManyTitle: "Move {count} items?",
      deleteBody: "The dashboard will be deleted.",
      deleteFolderBody:
        "The folder and everything inside it ({count}) will be removed.",
      moveTitle: 'Move "{name}"?',
      moveInto: 'It will be moved into "{target}".',
      moveToTop: "It will be moved to the top level.",
      move: "Move",
      cancel: "Cancel",
    },
  },
  // The new dashboard's tags step, which the tags dialog shows too.
  setup: {
    tags: {
      body: "They help find this dashboard in the list.",
      placeholder: "Add a tag",
      create: 'Create "{name}"',
      empty: "No tags yet.",
      suggestions: "Suggestions",
      suggested: "Operations, Fleet",
      remove: "Remove {tag}",
    },
    permissions: {
      visibility: {
        label: "Who sees it",
        organization: "Whole organization",
        restricted: "Only people with access",
      },
    },
  },
};

function renderPanel() {
  return render(<ExplorerPanel dict={dict} />);
}

function dragOnto(source: HTMLElement, target: HTMLElement) {
  fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn() } });
  fireEvent.dragOver(target, { dataTransfer: {} });
  fireEvent.drop(target, { dataTransfer: {} });
  fireEvent.dragEnd(source);
}

function link(name: string) {
  return screen.getByRole("link", { name });
}

function search() {
  return screen.getByRole("searchbox", { name: "Search by name" });
}

/** A link's text without what screen readers skip, like the "New" badge. */
function spokenText(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll("[aria-hidden]")) hidden.remove();
  return copy.textContent;
}

function checkbox(name: string) {
  return screen.getByRole("checkbox", { name: `Select "${name}"` });
}

/** Opens the "New" menu and picks `label` from it. */
async function newItem(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await user.click(screen.getByRole("button", { name: "New" }));
  await user.click(screen.getByRole("menuitem", { name: label }));
}

async function createFolder(user: ReturnType<typeof userEvent.setup>) {
  await newItem(user, "New folder");
  await user.keyboard("{Enter}");
  // The row being named is local; wait for the one the server created.
  await waitFor(() =>
    expect(Object.keys(readExplorerLayout().folders)).toEqual([])
  );
  return screen.getByRole("treeitem", { name: /Untitled folder/ });
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  row: HTMLElement,
  action: string
) {
  fireEvent.contextMenu(row);
  await user.click(
    within(screen.getByRole("menu")).getByRole("menuitem", { name: action })
  );
}

describe("ExplorerPanel", () => {
  beforeEach(() => {
    resetExplorerLayout();
    resetExplorerView();
    notify.mockReset();
    fake.reset();
    push.mockReset();
    globalThis.history.replaceState(null, "", "/en/dashboards");
  });

  it("discards abandoned drafts when the workspace unmounts", async () => {
    const user = userEvent.setup();
    const mounted = renderPanel();
    await newItem(user, "New folder");
    expect(Object.keys(readExplorerLayout().folders)).toHaveLength(1);
    mounted.unmount();
    renderPanel();
    expect(Object.keys(readExplorerLayout().folders)).toHaveLength(0);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("clears facets before naming a new folder", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Show starred only" }));
    await newItem(user, "New folder");
    expect(
      screen.getByRole("textbox", { name: "Untitled folder" })
    ).toBeVisible();
  });

  it.each(["New file", "New folder"])(
    "reveals the destination of %s in cards",
    async (action) => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
      });
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cards" }));
      await pick(user, screen.getByText("Ops"), action);
      expect(globalThis.location.search).toContain("folder=ops");
      expect(screen.getByRole("textbox")).toBeVisible();
    }
  );

  it.each([undefined, "ops"])(
    "renames a recent dashboard with one editor, parent %s",
    async (folderId) => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
        dashboards: [{ slug: "sales", name: "Sales", folderId }],
        recent: [{ id: "/dashboards/sales", openedAt: "2026-11-23T14:05:00Z" }],
      });
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cards" }));
      const recent = screen.getByRole("region", { name: "Recently opened" });
      await pick(
        user,
        within(recent).getByRole("link", { name: "Sales" }),
        "Rename"
      );
      const input = screen.getByRole("textbox", { name: "Sales" });
      expect(input).toHaveFocus();
      await user.clear(input);
      await user.type(input, "Revenue{Enter}");
      await waitFor(() =>
        expect(fake.get().dashboards[0]?.name).toBe("Revenue")
      );
    }
  );

  it("moves valid selected files without moving a folder into its descendant", async () => {
    const user = userEvent.setup();
    await fake.set({
      ...fake.get(),
      folders: [
        { id: "ops", name: "Ops", parentId: null },
        { id: "daily", name: "Daily", parentId: "ops" },
      ],
    });
    renderPanel();
    await user.click(screen.getByRole("button", { name: 'Expand "Ops"' }));
    await user.click(checkbox("Ops"));
    await user.click(checkbox("Sales"));
    dragOnto(link("Sales"), screen.getByText("Daily"));
    await user.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() =>
      expect(
        fake.get().dashboards.find((d) => d.slug === "sales")?.folderId
      ).toBe("daily")
    );
    expect(
      fake.get().folders.find((folder) => folder.id === "ops")?.parentId
    ).toBeNull();
  });

  it("copies a selected dashboard when its parent is also selected", async () => {
    const user = userEvent.setup();
    await fake.set({
      ...fake.get(),
      folders: [{ id: "ops", name: "Ops", parentId: null }],
      dashboards: [{ slug: "sales", name: "Sales", folderId: "ops" }],
    });
    renderPanel();
    await user.click(screen.getByRole("button", { name: 'Expand "Ops"' }));
    await user.click(checkbox("Ops"));
    await user.click(checkbox("Sales"));
    await pick(user, link("Sales"), "Copy");
    await pick(user, screen.getByTestId("explorer-root"), "Paste");
    await waitFor(() => expect(fake.get().dashboards).toHaveLength(2));
    expect(fake.get().dashboards[1]?.folderId).toBeUndefined();
  });

  it("excludes collapsed selected dashboards from keyboard deletion", async () => {
    const user = userEvent.setup();
    await fake.set({
      ...fake.get(),
      folders: [{ id: "ops", name: "Ops", parentId: null }],
      dashboards: [
        { slug: "sales", name: "Sales", folderId: "ops" },
        { slug: "fleet", name: "Fleet" },
        { slug: "yard", name: "Yard" },
      ],
    });
    renderPanel();
    await user.click(screen.getByRole("button", { name: 'Expand "Ops"' }));
    await user.click(checkbox("Sales"));
    await user.click(checkbox("Fleet"));
    await user.click(checkbox("Yard"));
    await user.click(screen.getByRole("button", { name: 'Collapse "Ops"' }));
    fireEvent.keyDown(link("Fleet"), { key: "Delete" });
    expect(screen.getByText("Delete 2 items?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(fake.get().dashboards).toEqual([
        { slug: "sales", name: "Sales", folderId: "ops" },
      ])
    );
  });

  it("shows the dashboards as files and offers new files and folders", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(link("Sales")).toHaveAttribute("href", "/en/dashboards/sales");
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByRole("menuitem", { name: "New file" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "New folder" })).toBeEnabled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("asks before a drag-and-drop move, then moves into the folder", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);

    dragOnto(link("Fleet"), screen.getByText("Untitled folder"));
    expect(screen.getByText('Move "Fleet"?')).toBeVisible();
    expect(
      screen.getByText('It will be moved into "Untitled folder".')
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move" }));

    expect(folder).toHaveAttribute("aria-expanded", "true");
    expect(folder).toContainElement(link("Fleet"));

    // Collapse hides what is inside.
    await user.click(
      screen.getByRole("button", { name: 'Collapse "Untitled folder"' })
    );
    expect(screen.queryByRole("link", { name: "Fleet" })).toBeNull();
  });

  it("leaves things where they were when the move is cancelled", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);

    dragOnto(link("Sales"), screen.getByText("Untitled folder"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(folder).not.toContainElement(link("Sales"));
  });

  it("asks before moving back to the top level too", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);
    await pick(user, link("Sales"), "Cut");
    await pick(user, screen.getByText("Untitled folder"), "Paste");

    dragOnto(link("Sales"), screen.getByTestId("explorer-root"));
    expect(
      screen.getByText("It will be moved to the top level.")
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move" }));
    expect(folder).not.toContainElement(link("Sales"));
  });

  it("renames a dashboard from the right-click menu, keeping its slug", async () => {
    const user = userEvent.setup();
    renderPanel();
    await pick(user, link("Sales"), "Rename");
    const input = screen.getByRole("textbox", { name: "Sales" });
    await user.clear(input);
    await user.type(input, "Revenue{Enter}");
    await waitFor(() =>
      expect(fake.get().dashboards.find((d) => d.slug === "sales")?.name).toBe(
        "Revenue"
      )
    );
    expect(link("Revenue")).toHaveAttribute("href", "/en/dashboards/sales");
  });

  it("clones a dashboard from the right-click menu", async () => {
    const user = userEvent.setup();
    renderPanel();
    await pick(user, link("Sales"), "Clone");
    expect(screen.getByText("Sales(1)")).toBeVisible();
  });

  it("copies a dashboard and pastes it into a folder", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);

    await pick(user, link("Fleet"), "Copy");
    await pick(user, screen.getByText("Untitled folder"), "Paste");

    // The copy is a real dashboard in the folder; the original stays put.
    expect(
      await within(folder).findByRole("link", { name: "Fleet" })
    ).toHaveAttribute("href", "/en/dashboards/fleet-1");
    expect(screen.getAllByRole("link", { name: "Fleet" })).toHaveLength(2);
  });

  it("cuts and pastes to move without asking", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);

    await pick(user, link("Sales"), "Cut");
    await pick(user, screen.getByText("Untitled folder"), "Paste");

    expect(screen.queryByText('Move "Sales"?')).toBeNull();
    expect(folder).toContainElement(link("Sales"));
  });

  it("deletes a dashboard only after confirming", async () => {
    const user = userEvent.setup();
    renderPanel();

    await pick(user, link("Sales"), "Delete");
    expect(screen.getByText('Delete "Sales"?')).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(link("Sales")).toBeVisible();

    await pick(user, link("Sales"), "Delete");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("link", { name: "Sales" })).toBeNull();
  });

  it("says how much a folder delete takes with it", async () => {
    const user = userEvent.setup();
    renderPanel();
    await createFolder(user);
    await pick(user, link("Sales"), "Cut");
    await pick(user, screen.getByText("Untitled folder"), "Paste");

    await pick(user, screen.getByText("Untitled folder"), "Delete");
    expect(
      screen.getByText(
        "The folder and everything inside it (1) will be removed."
      )
    ).toBeVisible();
  });

  describe("folder roles", () => {
    const seed = () =>
      fake.set({
        ...fake.get(),
        folders: [
          { id: "shared", name: "Shared", parentId: null, role: "Consumer" },
          { id: "mine", name: "Mine", parentId: null, role: "Coordinator" },
        ],
      });

    it("offers only what the folder role allows", async () => {
      await seed();
      renderPanel();
      fireEvent.contextMenu(screen.getByText("Shared"));
      const menu = within(screen.getByRole("menu"));
      expect(menu.getByRole("menuitem", { name: "Rename" })).toBeDisabled();
      expect(menu.getByRole("menuitem", { name: /Delete/ })).toBeDisabled();
      expect(menu.getByRole("menuitem", { name: "New folder" })).toBeDisabled();
      expect(menu.queryByRole("menuitem", { name: "Permissions" })).toBeNull();
    });

    it("lets a folder's maintainer give it permissions of its own", async () => {
      const user = userEvent.setup();
      await seed();
      renderPanel();
      await pick(user, screen.getByText("Mine"), "Permissions");
      expect(await screen.findByText('Permissions for "Mine"')).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith({
          type: "success",
          message: 'Permissions for "Mine" saved',
        })
      );
      expect(fake.get().grants).toEqual({
        mine: { assignments: [], visibility: "organization" },
      });
    });

    it("keeps a folder to who it names", async () => {
      const user = userEvent.setup();
      await seed();
      renderPanel();
      await pick(user, screen.getByText("Mine"), "Permissions");
      await user.click(
        await screen.findByRole("radio", { name: /Only people with access/ })
      );
      expect(
        screen.getByText(
          "Only who is listed can see this folder and what is inside it."
        )
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(fake.get().grants).toEqual({
          mine: { assignments: [], visibility: "restricted" },
        })
      );
    });
  });

  it("supports keyboard copy and paste on a focused row", async () => {
    const user = userEvent.setup();
    renderPanel();
    link("Fleet").focus();
    await user.keyboard("{Control>}c{/Control}{Control>}v{/Control}");
    expect(screen.getByText("Fleet(1)")).toBeVisible();
  });

  it("offers new items and paste on the empty explorer", () => {
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId("explorer-root"));
    const menu = screen.getByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Paste" })
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "New folder" })
    ).toBeEnabled();
  });

  describe("columns", () => {
    function row(name: string) {
      return link(name).closest("li")!;
    }

    it("fills a folder's columns with a Folder badge and a dash", async () => {
      await fake.set({
        ...fake.get(),
        folders: [{ id: "f1", name: "Ops", parentId: null }],
      });
      renderPanel();
      const folder = screen.getByRole("treeitem", { name: /Ops/ });
      expect(within(folder).getByText("Folder")).toBeInTheDocument();
      expect(
        within(folder).getByTitle("Folders have no creation date")
      ).toHaveTextContent("—");
      // Dashboards keep their own values; only folders get the badge.
      expect(within(row("Sales")).queryByText("Folder")).toBeNull();
    });

    it("shows each dashboard's tags and the user's stars", () => {
      renderPanel();
      expect(within(row("Sales")).getByText("finance")).toBeVisible();
      expect(
        within(row("Fleet")).getByRole("button", { name: "Unstar" })
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(row("Yard")).getByRole("button", { name: "Star" })
      ).toHaveAttribute("aria-pressed", "false");
    });

    it("shows when each dashboard was created, and marks those created today as new", () => {
      renderPanel();
      expect(screen.getByText("Created")).toBeInTheDocument();
      const fleetDate = new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
      }).format(new Date("2026-01-15T10:00:00.000Z"));
      expect(within(row("Fleet")).getByText(fleetDate).tagName).toBe("TIME");
      expect(within(row("Sales")).getByText("New")).toBeInTheDocument();
      expect(within(row("Fleet")).queryByText("New")).toBeNull();
      // Saved before the server recorded it: no date, and never "New".
      expect(
        within(row("Yard")).getByTitle("Creation date unknown")
      ).toBeInTheDocument();
      expect(within(row("Yard")).queryByText("New")).toBeNull();
    });

    it("stars and unstars from the row", async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(
        within(row("Yard")).getByRole("button", { name: "Star" })
      );
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "yard")?.starred
        ).toBe(true)
      );
      expect(push).not.toHaveBeenCalled();
      // One toast follows the change from saving to saved.
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "promise",
          loading: 'Starring "Yard"…',
          ok: '"Yard" starred',
        })
      );
    });

    it("has no menu to hide columns: every column always shows", () => {
      renderPanel();
      expect(screen.queryByRole("button", { name: "Columns" })).toBeNull();
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Filter by tag" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Show starred only" })
      ).toBeInTheDocument();
    });

    it("filters by creation date from the Created header", async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(
        screen.getByRole("button", { name: "Filter by creation date" })
      );
      // Only Sales was created today; Yard's date is unknown.
      await user.click(screen.getByRole("button", { name: "Today" }));
      // The capsule shows the chosen day in place of "Created".
      const trigger = screen.getByRole("button", {
        name: "Filter by creation date",
      });
      expect(trigger).not.toHaveTextContent("Created");
      expect(trigger).toHaveTextContent(
        new Intl.DateTimeFormat("en", {
          day: "numeric",
          month: "short",
        }).format(new Date())
      );
      expect(link("Sales")).toBeVisible();
      expect(screen.queryByRole("link", { name: "Fleet" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Yard" })).toBeNull();
      await user.click(
        screen.getByRole("button", { name: "Clear the date filter" })
      );
      expect(link("Fleet")).toBeVisible();
      expect(link("Yard")).toBeVisible();
    });

    it("filters by tag from the Tags header", async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Filter by tag" }));
      await user.click(
        screen.getByRole("menuitemcheckbox", { name: "finance" })
      );
      expect(link("Sales")).toBeVisible();
      expect(screen.queryByRole("link", { name: "Fleet" })).toBeNull();
      await user.click(screen.getByRole("menuitem", { name: "Clear filter" }));
      expect(link("Fleet")).toBeVisible();
    });

    it("shows only starred dashboards from the star header", async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(
        screen.getByRole("button", { name: "Show starred only" })
      );
      expect(link("Fleet")).toBeVisible();
      expect(screen.queryByRole("link", { name: "Sales" })).toBeNull();
    });

    it("edits a dashboard's tags from the right-click menu", async () => {
      const user = userEvent.setup();
      renderPanel();
      await pick(user, link("Yard"), "Edit tags");
      // The app's floating dialog, with the setup's tags step inside.
      const dialog = screen.getByRole("dialog", { name: 'Tags for "Yard"' });
      expect(
        within(dialog).getByText("They help find this dashboard in the list.")
      ).toBeVisible();
      // The organization's tags come first among the suggestions.
      expect(
        within(dialog)
          .getAllByRole("button", { name: /^(finance|ops|Operations|Fleet)$/ })
          .map((button) => button.textContent)
      ).toEqual(["finance", "ops", "Operations", "Fleet"]);
      const input = screen.getByRole("textbox", { name: "Add a tag" });
      // Tags already used elsewhere are offered as you type.
      await user.type(input, "fin");
      expect(
        screen.getByRole("button", { name: "finance", pressed: false })
      ).toBeInTheDocument();
      await user.clear(input);
      await user.type(input, "night{Enter}dock{Enter}");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "yard")?.tags
        ).toEqual(["night", "dock"])
      );
      expect(within(row("Yard")).getByText("dock")).toBeVisible();
    });

    it("edits tags from the Tags cell, without opening the dashboard", async () => {
      const user = userEvent.setup();
      renderPanel();
      // A dashboard with tags: its chips are the button.
      await user.click(
        screen.getByRole("button", { name: 'Edit tags of "Fleet"' })
      );
      expect(screen.getByText('Tags for "Fleet"')).toBeVisible();
      expect(push).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      // One without: "Add tag".
      const add = screen.getByRole("button", { name: 'Edit tags of "Yard"' });
      expect(add).toHaveTextContent("Add tag");
      await user.click(add);
      await user.type(
        screen.getByRole("textbox", { name: "Add a tag" }),
        "night{Enter}"
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "yard")?.tags
        ).toEqual(["night"])
      );
    });
  });

  it("shows placeholder rows, not a message, while the list loads", async () => {
    await fake.set({ dashboards: [], folders: [], loading: true });
    renderPanel();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create dashboard" })
    ).toBeNull();
  });

  it("shows the cards' sections as placeholders while they load", async () => {
    const user = userEvent.setup();
    await fake.set({ dashboards: [], folders: [], loading: true });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Cards" }));
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      [...status.querySelectorAll("[data-skeleton-section]")].map((el) =>
        el.getAttribute("data-skeleton-section")
      )
    ).toEqual(["recent", "all"]);
  });

  it("orders the list's rows from the same arrows as the cards", async () => {
    const user = userEvent.setup();
    renderPanel();
    const rows = () =>
      within(screen.getByRole("tree"))
        .getAllByRole("link")
        .map((link) => link.textContent ?? "");
    const before = rows();
    await user.click(screen.getByRole("button", { name: "Sort by name" }));
    await user.click(
      screen.getByRole("button", { name: "Sorted by name, A to Z" })
    );
    expect(before.length).toBeGreaterThan(1);
    expect(rows()).toEqual([...before].sort((a, b) => b.localeCompare(a)));
    // The cards keep the same order.
    await user.click(screen.getByRole("button", { name: "Cards" }));
    expect(
      screen.getByRole("button", { name: "Sorted by name, Z to A" })
    ).toHaveAttribute("data-sort", "desc");
  });

  it("orders the rows by creation date from the arrow inside Created", async () => {
    const user = userEvent.setup();
    await fake.set({
      ...fake.get(),
      dashboards: [
        { slug: "b", name: "B", createdAt: "2026-11-20T10:00:00.000Z" },
        { slug: "a", name: "A", createdAt: "2026-11-01T10:00:00.000Z" },
        { slug: "c", name: "C", createdAt: "2026-11-10T10:00:00.000Z" },
      ],
    });
    renderPanel();
    const rows = () =>
      within(screen.getByRole("tree"))
        .getAllByRole("link")
        .map((link) => link.textContent ?? "");
    await user.click(
      screen.getByRole("button", { name: "Sort by creation date" })
    );
    expect(rows()).toEqual(["A", "C", "B"]);
    await user.click(
      screen.getByRole("button", {
        name: "Sorted by creation date, oldest first",
      })
    );
    expect(rows()).toEqual(["B", "C", "A"]);
  });

  describe("checkboxes", () => {
    const selectedNames = () =>
      screen
        .queryAllByRole("treeitem", { selected: true })
        .map((row) => spokenText(within(row).getByRole("link")));

    it("selects rows from their checkbox without opening them", async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(
        screen.getByRole("checkbox", { name: 'Select "Fleet"' })
      );
      await user.click(screen.getByRole("checkbox", { name: 'Select "Yard"' }));
      expect(selectedNames()).toEqual(["Fleet", "Yard"]);
      expect(
        screen.getByRole("checkbox", { name: 'Select "Fleet"' })
      ).toBeChecked();
      expect(push).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole("checkbox", { name: 'Select "Fleet"' })
      );
      expect(selectedNames()).toEqual(["Yard"]);
    });

    it("selects all, shows a partial selection, and clears it", async () => {
      const user = userEvent.setup();
      renderPanel();
      const all = screen.getByRole("checkbox", { name: "Select all" });
      expect(all).not.toBeChecked();

      await user.click(screen.getByRole("checkbox", { name: 'Select "Yard"' }));
      expect(all).toBePartiallyChecked();

      await user.click(all);
      expect(all).toBeChecked();
      expect(selectedNames()).toEqual(["Fleet", "Sales", "Yard"]);

      await user.click(all);
      expect(all).not.toBeChecked();
      expect(selectedNames()).toEqual([]);
    });
  });

  describe("toasts", () => {
    const success = (message: string) =>
      expect(notify).toHaveBeenCalledWith({ type: "success", message });

    it("says when a folder and a dashboard are created", async () => {
      const user = userEvent.setup();
      renderPanel();
      await createFolder(user);
      success('Folder "Untitled folder" created');
      await newItem(user, "New file");
      await user.keyboard("Report{Enter}");
      await waitFor(() => success('Dashboard "Report" created'));
    });

    it("says where a drag moved a dashboard", async () => {
      const user = userEvent.setup();
      renderPanel();
      await createFolder(user);
      dragOnto(link("Fleet"), screen.getByText("Untitled folder"));
      await user.click(screen.getByRole("button", { name: "Move" }));
      await waitFor(() => success('"Fleet" moved to "Untitled folder"'));
    });

    it("says what was deleted", async () => {
      const user = userEvent.setup();
      renderPanel();
      await pick(user, link("Sales"), "Delete");
      await user.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() => success('"Sales" deleted'));
    });

    it("turns a failed change into an error toast", async () => {
      const user = userEvent.setup();
      renderPanel();
      const original = fake.set;
      fake.set = () =>
        Promise.reject(Object.assign(new Error(), { status: 409 }));
      try {
        await pick(user, link("Sales"), "Delete");
        await user.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() =>
          expect(notify).toHaveBeenCalledWith({
            type: "error",
            message: "Name taken",
          })
        );
      } finally {
        fake.set = original;
      }
      expect(notify).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" })
      );
    });
  });

  it("offers to create the first dashboard when the server has none", async () => {
    const user = userEvent.setup();
    await fake.set({ dashboards: [], folders: [] });
    renderPanel();
    expect(screen.getByText("Nothing here yet")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create dashboard" }));
    expect(screen.getByRole("textbox", { name: "Untitled file" })).toHaveValue(
      ""
    );
    await user.keyboard("Fleet{Enter}");
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/en/dashboards/fleet")
    );
  });

  it("explains a failed load and loads again on Try again", async () => {
    const user = userEvent.setup();
    await fake.set({ dashboards: [], folders: [], loadError: true });
    renderPanel();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the dashboards");
    expect(alert).toHaveTextContent("It may be a connection problem.");
    // Nothing to create into while the list is unknown.
    expect(
      screen.queryByRole("button", { name: "Create dashboard" })
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    // Read this time, and empty: the usual first-dashboard offer.
    expect(await screen.findByText("Nothing here yet")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not offer to create one when the search finds nothing", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "zzz");
    expect(screen.getByText("No matches")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Create dashboard" })
    ).toBeNull();
  });

  it("creates a real dashboard from a new file and opens it", async () => {
    const user = userEvent.setup();
    renderPanel();
    await newItem(user, "New file");
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("link", { name: "Untitled file" })
    ).toHaveAttribute("href", "/en/dashboards/untitled-file");
    expect(push).toHaveBeenCalledWith("/en/dashboards/untitled-file");
  });

  it("creates the new dashboard inside the folder it was started in", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);
    await pick(user, screen.getByText("Untitled folder"), "New file");
    await user.keyboard("Report{Enter}");
    await waitFor(() => expect(fake.get().dashboards).toHaveLength(4));
    expect(
      await within(folder).findByRole("link", { name: "Report" })
    ).toBeVisible();
    expect(fake.get().dashboards.at(-1)).toMatchObject({
      slug: "report",
      folderId: expect.any(String),
    });
  });

  it("searches by name from the Name header, and clears it", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(search()).toHaveAttribute("placeholder", "Name");
    await user.type(search(), "fle");
    expect(link("Fleet")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sales" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search()).toHaveValue("");
    expect(link("Sales")).toBeVisible();

    await user.type(search(), "sal{Escape}");
    expect(search()).toHaveValue("");
  });

  it("drops the name search when a new item is created, so it shows", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "fle");
    await newItem(user, "New folder");
    expect(search()).toHaveValue("");
    expect(
      screen.getByRole("textbox", { name: "Untitled folder" })
    ).toBeVisible();
  });

  it("highlights the open dashboard", () => {
    renderPanel();
    expect(link("Sales").parentElement?.className).toContain("bg-blue-50");
    expect(link("Fleet").parentElement?.className).not.toContain("bg-blue-50");
  });

  it("expands a folder in place from its chevron without selecting it", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);
    await user.click(
      within(folder).getByRole("button", { name: 'Expand "Untitled folder"' })
    );
    expect(folder).toHaveAttribute("aria-expanded", "true");
    expect(folder).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("checkbox", { name: 'Select "Untitled folder"' })
    ).not.toBeChecked();
  });

  it("builds a selection with Ctrl/⌘-click without navigating", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(checkbox("Fleet"));
    await user.keyboard("{Control>}");
    await user.click(link("Yard"));
    await user.keyboard("{/Control}");

    const selected = screen
      .getAllByRole("treeitem", { selected: true })
      .map((row) => spokenText(within(row).getByRole("link")));
    expect(selected).toEqual(["Fleet", "Yard"]);
  });

  it("selects a range with Shift-click", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(checkbox("Fleet"));
    await user.keyboard("{Shift>}");
    await user.click(link("Yard"));
    await user.keyboard("{/Shift}");
    // Rows are alphabetical, so the range runs Fleet → Sales → Yard.
    const selected = screen
      .getAllByRole("treeitem", { selected: true })
      .map((row) => spokenText(within(row).getByRole("link")));
    expect(selected).toEqual(["Fleet", "Sales", "Yard"]);
  });

  it("clears the selection on a click outside the rows", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(checkbox("Fleet"));
    expect(screen.getAllByRole("treeitem", { selected: true })).toHaveLength(1);

    await user.click(screen.getByTestId("explorer-root"));
    expect(screen.queryAllByRole("treeitem", { selected: true })).toEqual([]);

    await user.click(checkbox("Fleet"));
    await user.click(document.body);
    expect(screen.queryAllByRole("treeitem", { selected: true })).toEqual([]);
  });

  it("drags a whole selection into a folder after one confirmation", async () => {
    const user = userEvent.setup();
    renderPanel();
    const folder = await createFolder(user);
    await user.click(checkbox("Fleet"));
    await user.keyboard("{Control>}");
    await user.click(link("Yard"));
    await user.keyboard("{/Control}");

    dragOnto(link("Yard"), screen.getByText("Untitled folder"));
    expect(screen.getByText("Move 2 items?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move" }));

    expect(folder).toContainElement(link("Fleet"));
    expect(folder).toContainElement(link("Yard"));
    expect(folder).not.toContainElement(link("Sales"));
  });

  it("deletes the whole selection from the right-click menu", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(checkbox("Fleet"));
    await user.keyboard("{Control>}");
    await user.click(link("Yard"));
    await user.keyboard("{/Control}");

    await pick(user, link("Yard"), "Delete");
    expect(screen.getByText("Delete 2 items?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("link", { name: "Fleet" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Yard" })).toBeNull();
    expect(link("Sales")).toBeVisible();
  });

  it("right-clicking outside the selection acts on that item only", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(link("Fleet"));
    await user.keyboard("{Control>}");
    await user.click(link("Yard"));
    await user.keyboard("{/Control}");

    await pick(user, link("Sales"), "Delete");
    expect(screen.getByText('Delete "Sales"?')).toBeVisible();
  });

  it("disables the New menu until the new item is named", async () => {
    const user = userEvent.setup();
    renderPanel();
    const newButton = screen.getByRole("button", { name: "New" });

    await newItem(user, "New file");
    expect(newButton).toBeDisabled();
    expect(screen.queryByRole("menu")).toBeNull();

    await user.keyboard("{Enter}");
    expect(newButton).toBeEnabled();
  });

  it("numbers a second new item with the same name", async () => {
    const user = userEvent.setup();
    renderPanel();
    await createFolder(user);
    await newItem(user, "New folder");
    expect(
      screen.getByRole("textbox", { name: "Untitled folder(1)" })
    ).toHaveValue("");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Untitled folder(1)")).toBeVisible();
  });

  it("renames to name(1) when the name is taken in the folder", async () => {
    const user = userEvent.setup();
    renderPanel();
    await newItem(user, "New file");
    const input = screen.getByRole("textbox", { name: "Untitled file" });
    await user.clear(input);
    await user.type(input, "Sales{Enter}");
    expect(screen.getByText("Sales(1)")).toBeVisible();
    expect(link("Sales")).toBeVisible();
  });

  it("starts a new item's name empty and falls back to the default name", async () => {
    const user = userEvent.setup();
    renderPanel();
    await newItem(user, "New file");
    const input = screen.getByRole("textbox", { name: "Untitled file" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Type a name…");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Untitled file")).toBeVisible();
  });

  it("keeps the default name when the empty box loses focus", async () => {
    const user = userEvent.setup();
    renderPanel();
    await newItem(user, "New folder");
    await user.click(document.body);
    expect(screen.getByText("Untitled folder")).toBeVisible();
  });

  it("prefills the current name when renaming an existing item", async () => {
    const user = userEvent.setup();
    renderPanel();
    await createFolder(user);
    await pick(user, screen.getByText("Untitled folder"), "Rename");
    expect(
      screen.getByRole("textbox", { name: "Untitled folder" })
    ).toHaveValue("Untitled folder");
  });

  describe("opening folders", () => {
    /** Ops holds Sales; Fleet and Yard stay at the top level. */
    async function withOps(
      folders: { id: string; name: string; parentId: string | null }[] = [
        { id: "ops", name: "Ops", parentId: null },
      ]
    ) {
      await fake.set({
        ...fake.get(),
        folders,
        dashboards: fake
          .get()
          .dashboards.map((d) =>
            d.slug === "sales" ? { ...d, folderId: "ops" } : d
          ),
      });
    }
    const crumbs = () =>
      screen.getByRole("navigation", { name: "Folder path" });

    it("opens a folder on a plain click, and goes back up from the breadcrumb", async () => {
      const user = userEvent.setup();
      await withOps();
      renderPanel();
      expect(
        screen.queryByRole("navigation", { name: "Folder path" })
      ).toBeNull();
      await user.click(screen.getByText("Ops"));
      expect(globalThis.location.search).toBe("?folder=ops");
      expect(link("Sales")).toBeVisible();
      expect(screen.queryByRole("link", { name: "Fleet" })).toBeNull();
      expect(
        within(crumbs()).getByText("Ops").closest("[aria-current]")
      ).toHaveAttribute("aria-current", "page");
      // The folder's own name, not the list's names prefixed with it.
      expect(screen.getByRole("heading", { name: "Ops" })).toBeVisible();
      await user.click(
        within(crumbs()).getByRole("button", { name: /Dashboards/ })
      );
      expect(globalThis.location.search).toBe("");
      expect(link("Fleet")).toBeVisible();
    });

    it('goes up a level from the ".." row, which only a folder has', async () => {
      const user = userEvent.setup();
      await withOps([
        { id: "ops", name: "Ops", parentId: null },
        { id: "daily", name: "Daily", parentId: "ops" },
      ]);
      globalThis.history.replaceState(null, "", "/en/dashboards?folder=daily");
      renderPanel();
      // There even when the folder is empty.
      expect(screen.getByText("This folder is empty.")).toBeVisible();
      await user.click(screen.getByRole("button", { name: 'Up to "Ops"' }));
      expect(globalThis.location.search).toBe("?folder=ops");
      await user.click(
        screen.getByRole("button", { name: 'Up to "Dashboards"' })
      );
      expect(globalThis.location.search).toBe("");
      expect(screen.queryByRole("button", { name: /^Up to / })).toBeNull();
    });

    it('moves items up by dropping them on the ".." row', async () => {
      const user = userEvent.setup();
      await withOps();
      renderPanel();
      await user.click(screen.getByText("Ops"));
      dragOnto(
        link("Sales"),
        screen.getByRole("button", { name: 'Up to "Dashboards"' })
      );
      expect(screen.getByText('Move "Sales"?')).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Move" }));
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "sales")?.folderId
        ).toBeUndefined()
      );
    });

    it("opens the folder the URL names, and the top level for one that is gone", async () => {
      await withOps([
        { id: "ops", name: "Ops", parentId: null },
        { id: "daily", name: "Daily", parentId: "ops" },
      ]);
      globalThis.history.replaceState(null, "", "/en/dashboards?folder=daily");
      const { unmount } = renderPanel();
      const nav = crumbs();
      expect(
        within(nav).getByRole("button", { name: /Dashboards/ })
      ).toBeVisible();
      expect(within(nav).getByRole("button", { name: "Ops" })).toBeVisible();
      expect(
        within(nav).getByText("Daily").closest("[aria-current]")
      ).toHaveAttribute("aria-current", "page");
      expect(screen.getByText("This folder is empty.")).toBeVisible();
      unmount();

      globalThis.history.replaceState(null, "", "/en/dashboards?folder=nope");
      renderPanel();
      expect(link("Fleet")).toBeVisible();
      expect(
        screen.queryByRole("navigation", { name: "Folder path" })
      ).toBeNull();
    });

    it("creates new items inside the open folder", async () => {
      const user = userEvent.setup();
      await withOps();
      renderPanel();
      await user.click(screen.getByText("Ops"));
      await newItem(user, "New folder");
      await user.keyboard("Reports{Enter}");
      await waitFor(() =>
        expect(fake.get().folders).toContainEqual(
          expect.objectContaining({ name: "Reports", parentId: "ops" })
        )
      );
    });

    it("moves items up by dropping them on the breadcrumb", async () => {
      const user = userEvent.setup();
      await withOps();
      renderPanel();
      await user.click(screen.getByText("Ops"));
      dragOnto(
        link("Sales"),
        within(crumbs()).getByRole("button", { name: /Dashboards/ })
      );
      expect(screen.getByText('Move "Sales"?')).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Move" }));
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "sales")?.folderId
        ).toBeUndefined()
      );
    });
  });

  describe("card view", () => {
    async function showCards(user: ReturnType<typeof userEvent.setup>) {
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Cards" }));
    }
    const card = (name: string) => screen.getByRole("listitem", { name });

    it("shows the filters as a card, and everything as cards, folders first", async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
        dashboards: fake
          .get()
          .dashboards.map((d) =>
            d.slug === "yard" ? { ...d, folderId: "ops" } : d
          ),
      });
      await showCards(user);
      expect(screen.getByRole("search", { name: "Filters" })).toBeVisible();
      expect(screen.queryByRole("tree")).toBeNull();
      const all = screen.getByRole("region", { name: "All" });
      expect(
        within(all)
          .getAllByRole("listitem")
          .map((item) => item.getAttribute("aria-label"))
      ).toEqual(["Ops", "Fleet", "Sales"]);
      expect(within(card("Ops")).getByText("1 item")).toBeVisible();
      // Tags stay in the list view; a card shows none.
      expect(within(card("Sales")).queryByText("finance")).toBeNull();
    });

    it("keeps the view in the URL, so a reload opens the same one", async () => {
      const user = userEvent.setup();
      globalThis.history.replaceState(null, "", "/en/dashboards?folder=x");
      const replaceState = vi.spyOn(globalThis.history, "replaceState");
      const { unmount } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Cards" }));
      // In place, keeping the other parameters: not a step for Back.
      expect(globalThis.location.search).toBe("?folder=x&view=cards");
      expect(replaceState).toHaveBeenCalledTimes(1);
      replaceState.mockRestore();
      unmount();

      resetExplorerView();
      renderPanel();
      expect(screen.getByRole("search", { name: "Filters" })).toBeVisible();
      await user.click(screen.getByRole("button", { name: "List" }));
      expect(globalThis.location.search).toBe("?folder=x&view=list");
      expect(screen.getByRole("tree")).toBeVisible();
    });

    it("opens the view the browser last chose when the URL names none", async () => {
      const user = userEvent.setup();
      const { unmount } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Cards" }));
      unmount();
      globalThis.history.replaceState(null, "", "/en/dashboards");
      renderPanel();
      expect(screen.getByRole("search", { name: "Filters" })).toBeVisible();
    });

    it("lists the dashboards opened lately at the top level only", async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
        recent: [
          { id: "/dashboards/fleet", openedAt: "2026-11-23T14:05:00Z" },
          { id: "/dashboards/gone", openedAt: "2026-11-22T10:00:00Z" },
        ],
      });
      await showCards(user);
      const recent = screen.getByRole("region", { name: "Recently opened" });
      const items = within(recent).getAllByRole("listitem");
      // Only what is still in the list.
      expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
        "Fleet",
      ]);
      // The day it was opened, without the hour.
      expect(within(items[0]!).getByText("Opened Nov 23, 2026")).toBeVisible();
      await user.click(within(card("Ops")).getByText("Ops"));
      expect(
        screen.queryByRole("region", { name: "Recently opened" })
      ).toBeNull();
    });

    it("shows no tags on the cards; the name is the card's link", async () => {
      const user = userEvent.setup();
      await showCards(user);
      const fleet = card("Fleet");
      expect(within(fleet).queryByText("ops")).toBeNull();
      expect(within(fleet).queryByText("Add tag")).toBeNull();
      expect(
        within(fleet).getByRole("link", { name: "Fleet" })
      ).toHaveAttribute("href", expect.stringContaining("/dashboards/fleet"));
    });

    it("dates every card by what happened to it last, on the same side", async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        dashboards: [
          {
            slug: "fresh",
            name: "Fresh",
            tags: ["ops"],
            createdAt: "2026-11-20T10:00:00.000Z",
            updatedAt: "2026-11-20T10:00:00.000Z",
          },
          {
            slug: "fleet",
            name: "Fleet",
            tags: ["ops"],
            createdAt: "2026-11-01T10:00:00.000Z",
            updatedAt: "2026-11-21T10:00:00.000Z",
          },
          {
            slug: "yard",
            name: "Yard",
            createdAt: "2026-11-01T10:00:00.000Z",
            updatedAt: "2026-11-21T10:00:00.000Z",
          },
        ],
        recent: [{ id: "/dashboards/yard", openedAt: "2026-11-23T14:05:00Z" }],
      });
      await showCards(user);
      const all = screen.getByRole("region", { name: "All" });
      const dateOf = (name: string) =>
        within(within(all).getByRole("listitem", { name })).getByTitle(
          /^Created /
        );
      expect(dateOf("Fresh")).toHaveTextContent("Created Nov 20, 2026");
      expect(dateOf("Fresh")).toHaveAttribute("data-activity", "created");
      expect(dateOf("Fleet")).toHaveTextContent("Edited Nov 21, 2026");
      expect(dateOf("Yard")).toHaveTextContent("Opened Nov 23, 2026");
      // The tooltip has every date it knows, with the hour.
      expect(dateOf("Yard").getAttribute("title")).toMatch(
        /^Created .+\nOpened .+\nEdited .+$/
      );
      // The same date, in the same place, on the recent card.
      const recent = screen.getByRole("region", { name: "Recently opened" });
      expect(within(recent).getByTitle(/^Created /)).toHaveTextContent(
        "Opened Nov 23, 2026"
      );
    });

    it("opens a folder card in place, and selects cards with Ctrl/⌘-click", async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
        dashboards: fake
          .get()
          .dashboards.map((d) =>
            d.slug === "sales" ? { ...d, folderId: "ops" } : d
          ),
      });
      await showCards(user);
      await user.keyboard("{Control>}");
      await user.click(within(card("Fleet")).getByText("Fleet"));
      await user.keyboard("{/Control}");
      expect(push).not.toHaveBeenCalled();
      expect(
        within(card("Fleet")).getByRole("checkbox", { name: 'Select "Fleet"' })
      ).toBeChecked();

      await user.click(within(card("Ops")).getByText("Ops"));
      expect(globalThis.location.search).toBe("?view=cards&folder=ops");
      expect(screen.getByRole("listitem", { name: "Sales" })).toBeVisible();
      expect(screen.queryByRole("listitem", { name: "Fleet" })).toBeNull();
    });

    it("moves a card into a folder card, after asking", async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
      });
      await showCards(user);
      dragOnto(card("Fleet"), card("Ops"));
      expect(screen.getByText('Move "Fleet"?')).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Move" }));
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "fleet")?.folderId
        ).toBe("ops")
      );
    });

    it("has the same right-click menu and star as the list", async () => {
      const user = userEvent.setup();
      await showCards(user);
      await pick(user, card("Yard"), "Rename");
      await user.keyboard("{Control>}a{/Control}Patio{Enter}");
      await waitFor(() =>
        expect(fake.get().dashboards.find((d) => d.slug === "yard")?.name).toBe(
          "Patio"
        )
      );
      await user.click(
        within(card("Patio")).getByRole("button", { name: "Star" })
      );
      await waitFor(() =>
        expect(
          fake.get().dashboards.find((d) => d.slug === "yard")?.starred
        ).toBe(true)
      );
    });

    it("filters from the filter card, showing every match as one level", async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [{ id: "ops", name: "Ops", parentId: null }],
        dashboards: fake
          .get()
          .dashboards.map((d) =>
            d.slug === "sales" ? { ...d, folderId: "ops" } : d
          ),
      });
      await showCards(user);
      await user.type(
        screen.getByRole("searchbox", { name: "Search by name" }),
        "sal"
      );
      expect(card("Sales")).toBeVisible();
      expect(screen.queryByRole("listitem", { name: "Ops" })).toBeNull();
      expect(screen.queryByRole("listitem", { name: "Fleet" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Starred" }));
      expect(screen.getByText("No matches")).toBeVisible();
    });

    it("orders the cards from the arrows left of Name and Created", async () => {
      const user = userEvent.setup();
      await showCards(user);
      const all = screen.getByRole("region", { name: "All" });
      const shown = () =>
        within(all)
          .getAllByRole("listitem")
          .map((item) => item.getAttribute("aria-label"));
      const before = shown();
      await user.click(screen.getByRole("button", { name: "Sort by name" }));
      expect(shown()).toEqual([...before].sort((a, b) => a!.localeCompare(b!)));
      await user.click(
        screen.getByRole("button", { name: "Sorted by name, A to Z" })
      );
      expect(shown()).toEqual([...before].sort((a, b) => b!.localeCompare(a!)));
      await user.click(
        screen.getByRole("button", { name: "Sorted by name, Z to A" })
      );
      expect(shown()).toEqual(before);
      expect(
        screen.getByRole("button", { name: "Sort by creation date" })
      ).toHaveAttribute("data-sort", "off");
    });

    it('goes up from the ".." card, first among the dashboards', async () => {
      const user = userEvent.setup();
      await fake.set({
        ...fake.get(),
        folders: [
          { id: "ops", name: "Ops", parentId: null },
          { id: "daily", name: "Daily", parentId: "ops" },
        ],
      });
      globalThis.history.replaceState(
        null,
        "",
        "/en/dashboards?folder=daily&view=cards"
      );
      renderPanel();
      // There even when the folder is empty.
      expect(screen.getByText("This folder is empty.")).toBeVisible();
      await user.click(screen.getByRole("button", { name: 'Up to "Ops"' }));
      // First among the dashboards, after the folders.
      const all = screen.getByRole("region", { name: "All" });
      const folders = within(all).getByRole("list", { name: "Folders" });
      expect(within(folders).getAllByRole("listitem")[0]).toHaveAttribute(
        "aria-label",
        "Daily"
      );
      const dashboards = within(all).getByRole("list", { name: "Dashboards" });
      expect(within(dashboards).getAllByRole("listitem")[0]).toHaveAttribute(
        "aria-label",
        'Up to "Dashboards"'
      );
      await user.click(
        screen.getByRole("button", { name: 'Up to "Dashboards"' })
      );
      expect(screen.queryByRole("button", { name: /^Up to / })).toBeNull();
    });

    it("moves the focus between cards with the arrow keys", async () => {
      const user = userEvent.setup();
      await showCards(user);
      const fleet = within(card("Fleet")).getByRole("link");
      fleet.focus();
      await user.keyboard("{ArrowRight}");
      expect(within(card("Sales")).getByRole("link")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(fleet).toHaveFocus();
    });
  });
});
