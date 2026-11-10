import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, MouseEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SecondaryPanelItemList from "./secondary-panel-item-list";
import IconBarItem from "../icon-bar/icon-bar-item";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

// The open task form: the page the operators reported the menu dead on.
vi.mock("next/navigation", () => ({
  useParams: () => ({ lang: "es", taskId: "2984416" }),
  usePathname: () => "/es/task/edit/2984416",
  useSearchParams: () => new URLSearchParams(),
}));

// Client navigation stands in for next/link's router call.
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    ...rest
  }: ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      {...rest}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          push(href);
        }
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/features/auth/hooks/use-permissions", () => ({
  usePermissions: () => ({ canAccess: () => true }),
}));

const kanbanMenu = [
  { href: "/planning", label: "planning" },
  { href: "/shipping", label: "shipping" },
  { href: "/delivery", label: "delivery" },
  { href: "/finished", label: "finished" },
];

describe("Kanban side menu while a task is open", () => {
  beforeEach(() => push.mockClear());

  it("links every entry with the page's locale", () => {
    render(
      <SecondaryPanelItemList
        items={kanbanMenu}
        searchQuery=""
        totals={{}}
        dict={{}}
      />
    );

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    ).toEqual(["/es/planning", "/es/shipping", "/es/delivery", "/es/finished"]);
  });

  it("navigates on click and closes the panel", async () => {
    const onNavigate = vi.fn();
    render(
      <SecondaryPanelItemList
        items={kanbanMenu}
        searchQuery=""
        totals={{}}
        dict={{}}
        onNavigate={onNavigate}
      />
    );

    await userEvent.click(screen.getByRole("link", { name: "finished" }));

    expect(push).toHaveBeenCalledWith("/es/finished");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("keeps a query string and leaves a localized href alone", () => {
    render(
      <SecondaryPanelItemList
        items={[
          { href: "/mytasks?status=finished", label: "completed" },
          { href: "/en/shipping", label: "english" },
        ]}
        searchQuery=""
        totals={{}}
        dict={{}}
      />
    );

    expect(
      screen.getByRole("link", { name: "completed" }).getAttribute("href")
    ).toBe("/es/mytasks?status=finished");
    expect(
      screen.getByRole("link", { name: "english" }).getAttribute("href")
    ).toBe("/en/shipping");
  });
});

describe("Sidebar icon bar while a task is open", () => {
  beforeEach(() => push.mockClear());

  it("links a direct item with the page's locale and navigates", async () => {
    render(
      <ul>
        <IconBarItem
          translatedLabel="Torre de control"
          href="/symptoms"
          hasChildren={false}
          isActive={false}
          isPanelOpen={false}
          onClick={vi.fn()}
        />
      </ul>
    );

    const link = screen.getByRole("link", { name: "Torre de control" });
    expect(link.getAttribute("href")).toBe("/es/symptoms");
    await userEvent.click(link);
    expect(push).toHaveBeenCalledWith("/es/symptoms");
  });
});
