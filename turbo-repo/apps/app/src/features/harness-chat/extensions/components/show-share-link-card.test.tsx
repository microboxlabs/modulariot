import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../../context/harness-chat-i18n-context";
import { ShowShareLinkCard } from "./show-share-link-card";

type Props = ComponentProps<typeof ShowShareLinkCard>;

const url = "https://app.example.com/app/share/tok_1";

function renderCard(args: Record<string, unknown>) {
  const props = { args, addResult: vi.fn() } as unknown as Props;
  return render(
    <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
      <ShowShareLinkCard {...props} />
    </HarnessChatI18nProvider>
  );
}

describe("ShowShareLinkCard", () => {
  it("shows the story title and a link that opens in a new tab", () => {
    renderCard({ url, targetType: "story", targetId: "s1", title: "Top" });

    expect(screen.getByText("Enlace a la historia")).toBeTruthy();
    expect(screen.getByText("Top")).toBeTruthy();
    const link = screen.getByText(url).closest("a")!;
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("copies the URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderCard({ url, targetType: "thread", targetId: "t1" });

    expect(screen.getByText("Enlace a la conversación")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Copiar enlace/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
  });
});
