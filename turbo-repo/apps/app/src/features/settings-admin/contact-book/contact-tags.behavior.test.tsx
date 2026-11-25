/**
 * The contact book's tags, as a person uses them: with the real badge list
 * (this browser's storage) behind the section, and nothing but what is on
 * screen to go by. It only names roles, labels and texts, so it keeps
 * checking the same behaviour whatever component draws the section.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import ContactBadgesSection from "./contact-badges-section";
import { readBadges, useContactBadges } from "./taxonomy-store";

const dict = es.pages.userSettings.contactBook as unknown as I18nRecord;

const PLACES = [
  { label: "Planta Peñón", origins: 3, destinations: 1 },
  { label: "Bodega Sur", origins: 0, destinations: 2 },
];

/** The section as the contact form holds it: its own selection, the shared list. */
function ContactTags({ initial = [] }: Readonly<{ initial?: string[] }>) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initial);
  const { badges, ensure, rename, remove } = useContactBadges();
  return (
    <ContactBadgesSection
      selectedIds={selectedIds}
      onChange={setSelectedIds}
      badges={badges}
      onCreate={ensure}
      onRename={rename}
      onDelete={remove}
      places={PLACES}
      d={dict}
    />
  );
}

function seed(...names: string[]) {
  const badges = names.map((name, i) => ({ id: `b${i + 1}`, name }));
  window.localStorage.setItem(
    "miot.prototype.contact-badges.v1",
    JSON.stringify(badges)
  );
  return badges;
}

const field = () =>
  screen.getByPlaceholderText(dict.badgesInputPlaceholder as string);

/** The chips the contact carries, by name. */
function contactTags(): string[] {
  const box = screen.getByText(dict.badgesSelectedTitle as string)
    .nextElementSibling as HTMLElement;
  return within(box)
    .queryAllByRole("button", { name: /^Quitar / })
    .map((b) => (b.getAttribute("aria-label") ?? "").replace(/^Quitar /, ""));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("contact book tags", () => {
  it("starts with no tags and says how to add one", () => {
    render(<ContactTags />);
    expect(contactTags()).toEqual([]);
    expect(
      screen.getByText(dict.badgesSelectedEmpty as string)
    ).toBeInTheDocument();
  });

  it("creates a new tag on Enter, keeps it in the shared list and on the contact", async () => {
    const user = userEvent.setup();
    render(<ContactTags />);
    await user.type(field(), "transportista{Enter}");
    expect(contactTags()).toEqual(["transportista"]);
    expect(readBadges().map((b) => b.name)).toEqual(["transportista"]);
    expect(field()).toHaveValue("");
  });

  it("creates one from the Create option", async () => {
    const user = userEvent.setup();
    render(<ContactTags />);
    await user.type(field(), "turno noche");
    await user.click(
      screen.getByRole("button", { name: 'Crear "turno noche"' })
    );
    expect(contactTags()).toEqual(["turno noche"]);
  });

  it("reuses an existing tag whatever its case or accents, without a duplicate", async () => {
    const user = userEvent.setup();
    seed("Peñalolén");
    render(<ContactTags />);
    await user.type(field(), "PENALOLEN");
    expect(
      screen.queryByRole("button", { name: /^Crear / })
    ).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(contactTags()).toEqual(["Peñalolén"]);
    expect(readBadges()).toHaveLength(1);
  });

  it("lists matching tags to add and take off again", async () => {
    const user = userEvent.setup();
    seed("norte", "noche");
    render(<ContactTags />);
    await user.type(field(), "no");
    const norte = screen.getByRole("button", { name: "norte", pressed: false });
    await user.click(norte);
    expect(contactTags()).toEqual(["norte"]);
    expect(
      screen.getByRole("button", { name: "norte", pressed: true })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "norte" }));
    expect(contactTags()).toEqual([]);
  });

  it("takes a tag off the contact from its chip, leaving it in the list", async () => {
    const user = userEvent.setup();
    const [norte] = seed("norte");
    render(<ContactTags initial={[norte!.id]} />);
    expect(contactTags()).toEqual(["norte"]);
    await user.click(screen.getByRole("button", { name: "Quitar norte" }));
    expect(contactTags()).toEqual([]);
    expect(readBadges().map((b) => b.name)).toEqual(["norte"]);
  });

  it("renames a tag, and refuses a name another tag has", async () => {
    const user = userEvent.setup();
    const [norte] = seed("norte", "sur");
    render(<ContactTags initial={[norte!.id]} />);
    await user.type(field(), "nor");
    await user.click(screen.getByRole("button", { name: "Renombrar norte" }));
    const box = screen.getByRole("textbox", { name: "Renombrar" });

    await user.clear(box);
    await user.type(box, "SUR{Enter}");
    expect(box).toHaveAttribute("aria-invalid", "true");

    await user.clear(box);
    await user.type(box, "zona norte{Enter}");
    expect(contactTags()).toEqual(["zona norte"]);
    expect(readBadges().map((b) => b.name)).toEqual(["zona norte", "sur"]);
  });

  it("deletes a tag from the list and from the contact", async () => {
    const user = userEvent.setup();
    const [norte] = seed("norte", "sur");
    render(<ContactTags initial={[norte!.id]} />);
    await user.type(field(), "nor");
    await user.click(screen.getByRole("button", { name: "Eliminar norte" }));
    expect(contactTags()).toEqual([]);
    expect(readBadges().map((b) => b.name)).toEqual(["sur"]);
  });

  it("offers trip places and writes the tag as the trips do", async () => {
    const user = userEvent.setup();
    render(<ContactTags />);
    await user.type(field(), "planta penon");
    expect(
      screen.queryByRole("button", { name: /^Crear / })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Planta Peñón/ }));
    expect(contactTags()).toEqual(["Planta Peñón"]);
  });

  it("does nothing on Enter with an empty field", async () => {
    const user = userEvent.setup();
    render(<ContactTags />);
    await user.type(field(), "   {Enter}");
    expect(contactTags()).toEqual([]);
    expect(readBadges()).toEqual([]);
  });
});
