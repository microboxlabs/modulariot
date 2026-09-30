import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type {
  I18nDictionary,
  I18nRecord,
} from "@/features/i18n/i18n.service.types";
import {
  LinkApiError,
  type LinkSnapshot,
  type SharedMessage,
} from "../share-links-api";

const resolveLinkMock = vi.fn();

vi.mock("../share-links-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../share-links-api")>()),
  resolveLink: (...args: unknown[]) => resolveLinkMock(...args),
}));

import ShareSnapshotPage, { MESSAGE_PAGE } from "./share-snapshot-page";

const root = es as unknown as I18nRecord;

function renderPage() {
  return render(
    <ShareSnapshotPage
      token="tok_1"
      lang="es"
      dict={root.shareLink as I18nRecord}
      storyDict={root.storytelling as I18nRecord}
      chatDict={es as I18nDictionary}
    />
  );
}

function textMessage(seq: number, role: string, text: string): SharedMessage {
  return {
    id: `m${seq}`,
    parentId: null,
    format: "aui-v1",
    payload: { role, content: [{ type: "text", text }] },
    seq,
    createdAt: null,
  };
}

function artifactMessage(
  seq: number,
  args: Record<string, unknown>
): SharedMessage {
  return {
    id: `m${seq}`,
    parentId: null,
    format: "aui-v1",
    payload: {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: `c${seq}`,
          toolName: "show_artifact",
          args,
          result: {},
        },
      ],
    },
    seq,
    createdAt: null,
  };
}

function threadSnapshot(messages: SharedMessage[]): LinkSnapshot {
  return {
    targetType: "thread",
    story: null,
    version: null,
    thread: {
      id: "t1",
      title: "Lane review",
      ownerId: "u",
      createdAt: "2026-09-01T10:00:00Z",
      lastMessageAt: null,
    },
    messages,
  };
}

beforeEach(() => {
  resolveLinkMock.mockReset();
});

describe("ShareSnapshotPage", () => {
  it("renders a shared story's version with the story renderer", async () => {
    resolveLinkMock.mockResolvedValue({
      targetType: "story",
      story: {
        id: "s1",
        title: "Weekly",
        kind: "markdown",
        updatedAt: "2026-09-01T10:00:00Z",
      },
      version: { id: "v2", label: "v2", content: "# Numbers\n\nUp 4%." },
      thread: null,
      messages: null,
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Numbers" })
    ).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
  });

  it("renders a shared thread as a transcript", async () => {
    resolveLinkMock.mockResolvedValue(
      threadSnapshot([
        textMessage(1, "user", "Which lanes are late?"),
        textMessage(2, "assistant", "North is late."),
      ])
    );
    renderPage();
    expect(
      await screen.findByText("Which lanes are late?")
    ).toBeInTheDocument();
    expect(screen.getByText("North is late.")).toBeInTheDocument();
    expect(screen.getByText("Lane review")).toBeInTheDocument();
    expect(screen.queryByText("Cargar más mensajes")).toBeNull();
  });

  it("renders an artifact the assistant showed as the chat's card", async () => {
    resolveLinkMock.mockResolvedValue(
      threadSnapshot([
        artifactMessage(1, {
          id: "a1",
          kind: "markdown",
          title: "Lane notes",
          content: "## Late lanes\n\nNorth is late.",
        }),
      ])
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Late lanes" })
    ).toBeInTheDocument();
    expect(screen.getByText("Lane notes")).toBeInTheDocument();
    expect(screen.queryByText(/show_artifact/)).toBeNull();
  });

  it("says so when an artifact's content was not stored", async () => {
    resolveLinkMock.mockResolvedValue(
      threadSnapshot([
        artifactMessage(1, {
          id: "a1",
          kind: "html",
          title: "Big page",
          content: "",
          omitted: true,
        }),
      ])
    );
    renderPage();
    expect(await screen.findByText("Big page")).toBeInTheDocument();
    expect(screen.getByText(/demasiado grande/)).toBeInTheDocument();
  });

  it("shows an unanswered question without a way to answer it", async () => {
    resolveLinkMock.mockResolvedValue(
      threadSnapshot([
        {
          id: "m1",
          parentId: null,
          format: "aui-v1",
          payload: {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "ask_user_question",
                args: {
                  question: "Which lane?",
                  options: [{ label: "North" }, { label: "South" }],
                },
              },
            ],
          },
          seq: 1,
          createdAt: null,
        },
      ])
    );
    renderPage();
    expect(await screen.findByText("Which lane?")).toBeInTheDocument();
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
  });

  it("loads the next page of a long thread after the last seq", async () => {
    const firstPage = Array.from({ length: MESSAGE_PAGE }, (_, i) =>
      textMessage(i + 1, "user", `message ${i + 1}`)
    );
    resolveLinkMock
      .mockResolvedValueOnce(threadSnapshot(firstPage))
      .mockResolvedValueOnce(
        threadSnapshot([textMessage(MESSAGE_PAGE + 1, "assistant", "the end")])
      );
    renderPage();

    fireEvent.click(await screen.findByText("Cargar más mensajes"));

    expect(await screen.findByText("the end")).toBeInTheDocument();
    expect(resolveLinkMock).toHaveBeenLastCalledWith("tok_1", {
      after: MESSAGE_PAGE,
      limit: MESSAGE_PAGE,
    });
  });

  it("says the link is not available when it was revoked", async () => {
    resolveLinkMock.mockRejectedValue(new LinkApiError(404));
    renderPage();
    expect(await screen.findByText("Enlace no disponible")).toBeInTheDocument();
  });
});
