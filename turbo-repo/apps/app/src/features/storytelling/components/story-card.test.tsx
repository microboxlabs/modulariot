import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { Story } from "../storytelling.types";
import StoryCard from "./story-card";

const dict = (en as unknown as I18nRecord).storytelling as I18nRecord;

const story: Story = {
  id: "s1",
  title: "Q3 delivery report",
  description: null,
  kind: "pdf",
  ownerId: "u1",
  owned: true,
  permission: "owner",
  sourceThreadId: null,
  sourceMessageId: null,
  currentVersionId: null,
  createdAt: "2026-11-20T10:00:00.000Z",
  createdBy: "Ana",
  updatedAt: "2026-11-20T10:00:00.000Z",
  updatedBy: "Ana",
  sharedWith: null,
  currentVersion: null,
};

function renderCard(overrides: Partial<Story> = {}, selected = false) {
  const onToggleSelect = vi.fn();
  render(
    <StoryCard
      story={{ ...story, ...overrides }}
      lang="en"
      dict={dict}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onDetails={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />
  );
  return { onToggleSelect };
}

describe("StoryCard", () => {
  it("links the whole card to the story and shows its kind", () => {
    renderCard();
    expect(
      screen.getByRole("link", { name: "Q3 delivery report" })
    ).toHaveAttribute("href", "/en/storytelling/s1");
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("selects an owned story from its checkbox", async () => {
    const user = userEvent.setup();
    const { onToggleSelect } = renderCard({}, true);
    const checkbox = screen.getByRole("checkbox", {
      name: "Select Q3 delivery report",
    });
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    await user.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1" })
    );
  });

  it("can't select a story the viewer doesn't own", () => {
    renderCard({ owned: false });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
