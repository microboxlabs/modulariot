import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import ContactBadgesSection, {
  placeDetail,
  placeSuggestions,
} from "./contact-badges-section";

const dict = es.pages.userSettings.contactBook as unknown as I18nRecord;

const PLACES = [
  { label: "Planta Peñón", origins: 3, destinations: 1 },
  { label: "Bodega Sur", origins: 0, destinations: 2 },
];

describe("placeSuggestions", () => {
  it("offers the trip places that match, ignoring case and accents", () => {
    expect(placeSuggestions(PLACES, [], "PENON").map((p) => p.label)).toEqual([
      "Planta Peñón",
    ]);
    expect(placeSuggestions(PLACES, [], "  ")).toEqual([]);
  });

  it("leaves out a place that is already a tag", () => {
    expect(
      placeSuggestions(PLACES, [{ id: "b1", name: "planta penon" }], "planta")
    ).toEqual([]);
  });

  it("matches and deduplicates with the same spacing rules as step conditions", () => {
    expect(placeSuggestions(PLACES, [], " planta  PENON ")).toEqual([
      PLACES[0],
    ]);
    expect(
      placeSuggestions(
        PLACES,
        [{ id: "b1", name: "Planta\u00a0 Peñón" }],
        "planta"
      )
    ).toEqual([]);
  });

  it("says how many live trips start and end there", () => {
    expect(placeDetail(PLACES[0], dict)).toBe(
      "Origen de 3 viajes en curso · destino de 1"
    );
    expect(placeDetail(PLACES[1], dict)).toBe("destino de 2");
  });
});

describe("ContactBadgesSection", () => {
  it("uses the trip spelling for an exact match beyond the suggestion limit", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((name: string) => ({ id: `id-${name}`, name }));
    const places = [
      ...Array.from({ length: 8 }, (_, i) => ({
        label: `Planta Peñón ${i}`,
        origins: 20,
        destinations: 0,
      })),
      PLACES[0],
    ];
    render(
      <ContactBadgesSection
        selectedIds={[]}
        onChange={() => {}}
        badges={[]}
        onCreate={onCreate}
        onRename={() => true}
        onDelete={() => {}}
        places={places}
        d={dict}
      />
    );

    await user.type(screen.getByRole("textbox"), "planta penon");
    expect(screen.queryByText('Crear "planta penon"')).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Planta Peñón Origen/ })
    ).toBeDefined();
    await user.keyboard("{Enter}");
    expect(onCreate).toHaveBeenCalledWith("Planta Peñón");
  });

  it("adds a trip place as a tag written as the trips write it, and keeps free text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCreate = vi.fn((name: string) => ({ id: `id-${name}`, name }));
    render(
      <ContactBadgesSection
        selectedIds={[]}
        onChange={onChange}
        badges={[]}
        onCreate={onCreate}
        onRename={() => true}
        onDelete={() => {}}
        places={PLACES}
        d={dict}
      />
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "planta penon");
    expect(screen.queryByText('Crear "planta penon"')).toBeNull();
    await user.click(screen.getByRole("button", { name: /Planta Peñón/ }));
    expect(onCreate).toHaveBeenLastCalledWith("Planta Peñón");
    expect(onChange).toHaveBeenLastCalledWith(["id-Planta Peñón"]);

    await user.type(input, "zona libre{Enter}");
    expect(onCreate).toHaveBeenLastCalledWith("zona libre");
  });
});
