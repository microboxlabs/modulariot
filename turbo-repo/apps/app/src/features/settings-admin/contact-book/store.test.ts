import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TowerContact } from "@/features/symptoms/control-tower/control-tower-api";
import {
  TagUpdateError,
  makeContactId,
  bookCompanies,
  toBookContact,
  toContactBody,
  useContactBook,
  useContactBookPages,
  type BookContact,
} from "./store";

const api = vi.hoisted(() => ({
  data: [] as TowerContact[],
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  importContacts: vi.fn(),
  mutate: vi.fn(),
  setSize: vi.fn(),
  pages: [] as { items: TowerContact[]; next: string | null }[],
  pageError: undefined as Error | undefined,
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  createContact: api.createContact,
  updateContact: api.updateContact,
  deleteContact: api.deleteContact,
  importContacts: api.importContacts,
  contactsKey: "contacts",
  contactFacetsKey: "contacts/facets",
  useContacts: () => ({ data: api.data, error: undefined, mutate: api.mutate }),
  useContactPages: () => ({
    data: api.pages,
    size: api.pages.length,
    setSize: api.setSize,
    error: api.pageError,
    mutate: api.mutate,
  }),
  useContactFacets: () => ({ data: undefined, mutate: api.mutate }),
  fetchAllContacts: (query: { tag: string }) =>
    Promise.resolve(
      api.data.filter((c) =>
        (c.tags ?? []).some((t) => t.toLowerCase() === query.tag.toLowerCase())
      )
    ),
}));

const BADGES_KEY = "miot.prototype.contact-badges.v1";

function apiContact(patch: Partial<TowerContact> = {}): TowerContact {
  return {
    id: "c1",
    name: "Persona Ejemplo",
    role: "Supervisor",
    phone: "+56900000001",
    methods: ["PHONE", "MEET"],
    active: true,
    notes: "Jefe de turno",
    nationalId: "111111111",
    nationalIdType: "RUT",
    company: "Empresa Ejemplo",
    position: "Supervisor",
    channels: { phone: "+56900000001", meet: "persona@example.com" },
    tags: ["transporte"],
    memberUserId: null,
    provisional: false,
    lastCalledAt: null,
    answered: 0,
    missed: 0,
    ...patch,
  };
}

describe("contact book mapping", () => {
  it("maps an API contact to the book and back", () => {
    const badges = [{ id: "b1", name: "Transporte" }];
    const book = toBookContact(apiContact(), badges);
    expect(book).toMatchObject({
      id: "c1",
      methods: ["phone", "meet"],
      channels: { phone: "+56900000001", meet: "persona@example.com" },
      description: "Jefe de turno",
      rut: "11.111.111-1",
      company: "Empresa Ejemplo",
      badgeIds: ["b1"],
      provisional: false,
    });
    expect(toContactBody(book, badges)).toEqual({
      name: "Persona Ejemplo",
      role: "Supervisor",
      phone: "+56900000001",
      methods: ["PHONE", "MEET"],
      notes: "Jefe de turno",
      nationalId: "11.111.111-1",
      nationalIdType: "RUT",
      company: "Empresa Ejemplo",
      companyRut: "",
      companyTaxIdType: "",
      position: "Supervisor",
      channels: {
        phone: "+56900000001",
        meet: "persona@example.com",
        email: "",
      },
      tags: ["Transporte"],
      memberUserId: "",
      provisional: false,
    });
  });

  it("keeps the email apart from the call channels and shows the company's RUT", () => {
    const book = toBookContact(
      apiContact({
        companyRut: "761112228",
        channels: { phone: "+56900000001", email: "despacho@example.com" },
      }),
      []
    );
    expect(book.email).toBe("despacho@example.com");
    expect(book.channels).toEqual({ phone: "+56900000001" });
    expect(book.companyRut).toBe("76.111.222-8");
    expect(toContactBody(book, []).channels).toEqual({
      phone: "+56900000001",
      email: "despacho@example.com",
    });
  });

  it("sends empty strings so an edit can clear a field", () => {
    const minimal: BookContact = {
      id: "c1",
      name: "Sin datos",
      phone: "",
      role: "",
      methods: [],
    };
    expect(toContactBody(minimal, [])).toMatchObject({
      nationalId: "",
      company: "",
      notes: "",
      tags: [],
    });
  });
});

describe("useContactBook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    api.data = [];
  });

  it("reads the book from the API and creates a local badge for each tag", async () => {
    api.data = [apiContact({ tags: ["transporte", "turno noche"] })];
    const { result } = renderHook(() => useContactBook());
    expect(result.current.hydrated).toBe(true);
    await waitFor(() =>
      expect(result.current.contacts[0]?.badgeIds).toHaveLength(2)
    );
    const badges = JSON.parse(window.localStorage.getItem(BADGES_KEY) ?? "[]");
    expect(badges.map((b: { name: string }) => b.name)).toEqual([
      "transporte",
      "turno noche",
    ]);
    expect(
      window.localStorage.getItem("miot.prototype.contact-book.v1")
    ).toBeNull();
  });

  it("creates a new contact and updates an existing one", async () => {
    window.localStorage.setItem(
      BADGES_KEY,
      JSON.stringify([{ id: "b1", name: "transporte" }])
    );
    api.data = [apiContact()];
    api.createContact.mockResolvedValue(
      apiContact({ id: "c2", name: "Nueva" })
    );
    api.updateContact.mockResolvedValue(apiContact());
    const { result } = renderHook(() => useContactBook());

    let saved: BookContact | undefined;
    await act(async () => {
      saved = await result.current.save({
        id: makeContactId(),
        name: "Nueva",
        phone: "",
        role: "",
        methods: [],
        badgeIds: ["b1"],
      });
    });
    expect(saved?.id).toBe("c2");
    expect(api.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nueva", tags: ["transporte"] })
    );

    await act(async () => {
      await result.current.save({ ...result.current.contacts[0], company: "" });
    });
    expect(api.updateContact).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ company: "" })
    );
    expect(api.mutate).toHaveBeenCalledTimes(2);
  });

  it("imports through one request and deletes through the API", async () => {
    const outcome = { created: 1, skipped: 1, errors: 0, rows: [] };
    api.importContacts.mockResolvedValue(outcome);
    api.deleteContact.mockResolvedValue(undefined);
    const { result } = renderHook(() => useContactBook());
    const rows: BookContact[] = [
      {
        id: makeContactId(),
        name: "Uno",
        phone: "",
        role: "",
        methods: [],
        rut: "11.111.111-1",
      },
      {
        id: makeContactId(),
        name: "Dos",
        phone: "",
        role: "",
        methods: [],
        rut: "22.222.222-2",
      },
    ];

    await act(async () => {
      await expect(result.current.addMany(rows)).resolves.toEqual(outcome);
      await result.current.remove("c1");
    });
    expect(api.importContacts).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Uno", nationalId: "11.111.111-1" }),
      expect.objectContaining({ name: "Dos", nationalId: "22.222.222-2" }),
    ]);
    expect(api.deleteContact).toHaveBeenCalledWith("c1");
  });

  it("renames a tag on every contact that has it", async () => {
    api.data = [
      apiContact({ id: "c1", tags: ["transporte", "norte"] }),
      apiContact({ id: "c2", tags: ["sur"] }),
    ];
    api.updateContact.mockResolvedValue(apiContact());
    const { result } = renderHook(() => useContactBook());
    await act(async () => {
      await result.current.renameTag("Transporte", "transportista");
      await result.current.deleteTag("sur");
    });
    expect(api.updateContact).toHaveBeenCalledWith("c1", {
      tags: ["norte", "transportista"],
    });
    expect(api.updateContact).toHaveBeenCalledWith("c2", { tags: [] });
  });
  it("reloads the book and reports how many contacts a tag change missed", async () => {
    api.data = [
      apiContact({ id: "c1", tags: ["sur"] }),
      apiContact({ id: "c2", tags: ["sur"] }),
    ];
    api.updateContact
      .mockResolvedValueOnce(apiContact())
      .mockRejectedValueOnce(new Error("HTTP 500"));
    const { result } = renderHook(() => useContactBook());
    let error: unknown;
    await act(async () => {
      error = await result.current
        .renameTag("sur", "austral")
        .catch((e: unknown) => e);
    });
    expect(error).toBeInstanceOf(TagUpdateError);
    expect(error).toMatchObject({ failed: 1, updated: 1 });
    expect(api.updateContact).toHaveBeenCalledTimes(2);
    expect(api.mutate).toHaveBeenCalledTimes(1);
  });
});

describe("bookCompanies", () => {
  it("lists the book's companies sorted, with the RUT the API gave", () => {
    expect(
      bookCompanies({
        total: 3,
        roles: [],
        tags: [],
        members: [],
        companies: [
          { name: "Minera Sur", rut: "761112228", taxIdType: "RUT" },
          { name: "Logística", rut: null, taxIdType: null },
        ],
      })
    ).toEqual([
      {
        name: "Logística",
        rut: undefined,
        taxIdType: undefined,
        source: "book",
      },
      {
        name: "Minera Sur",
        rut: "761112228",
        taxIdType: "RUT",
        source: "book",
      },
    ]);
    expect(bookCompanies(undefined)).toEqual([]);
  });
});

describe("useContactBookPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.pages = [];
    api.pageError = undefined;
  });

  it("shows the pages loaded so far and asks for the next one", () => {
    api.pages = [{ items: [apiContact({ id: "c1" })], next: "cursor-1" }];
    const { result } = renderHook(() => useContactBookPages({}));
    expect(result.current.contacts.map((c) => c.id)).toEqual(["c1"]);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    expect(api.setSize).toHaveBeenCalledWith(2);
  });

  it("stops at the last page", () => {
    api.pages = [
      { items: [apiContact({ id: "c1" })], next: "cursor-1" },
      { items: [apiContact({ id: "c2" })], next: null },
    ];
    const { result } = renderHook(() => useContactBookPages({}));
    expect(result.current.contacts.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(api.setSize).not.toHaveBeenCalled();
  });

  it("stops automatic pagination after a later page fails", () => {
    api.pages = [{ items: [apiContact({ id: "c1" })], next: "cursor-1" }];
    api.pageError = new Error("Unavailable");
    const { result } = renderHook(() => useContactBookPages({}));
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(api.setSize).not.toHaveBeenCalled();
  });
});
