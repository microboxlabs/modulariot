import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../context/harness-chat-i18n-context";
import type { Session } from "../harness-chat-types";
import { HistoryList } from "./history-list";

const session: Session = {
  id: "t1",
  createdAt: Date.parse("2026-09-01T10:00:00Z"),
  title: "Lane review",
  initialMessage: null,
  owned: true,
  sharedWith: [],
};

describe("HistoryList share panel", () => {
  it("copies a link to the thread, with per-person sharing kept below it", () => {
    const onCopyLink = vi.fn();
    const onShare = vi.fn();
    render(
      <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
        <HistoryList
          sessions={[session]}
          activeId="t1"
          isLoading={false}
          hasFailed={false}
          onRetry={vi.fn()}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
          onShare={onShare}
          onUnshare={vi.fn()}
          onCopyLink={onCopyLink}
          locale="es"
        />
      </HarnessChatI18nProvider>
    );

    fireEvent.click(screen.getByLabelText("Compartir chat"));
    fireEvent.click(screen.getByText("Compartir enlace"));
    expect(onCopyLink).toHaveBeenCalledWith("t1");

    const email = screen.getByPlaceholderText("correo de la persona");
    fireEvent.change(email, { target: { value: "ana@example.com" } });
    fireEvent.keyDown(email, { key: "Enter" });
    expect(onShare).toHaveBeenCalledWith("t1", "ana@example.com");
  });
});
