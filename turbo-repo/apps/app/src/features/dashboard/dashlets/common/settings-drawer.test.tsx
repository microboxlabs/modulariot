// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import { SettingsDrawer } from "./settings-drawer";

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const dictionary = es as unknown as I18nRecord;

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

function clickCopy() {
  render(
    <SettingsDrawer
      open
      onClose={vi.fn()}
      widgetId="w1"
      dictionary={dictionary}
    >
      <div />
    </SettingsDrawer>
  );
  fireEvent.click(screen.getByRole("button", { name: "#widget-w1" }));
}

describe("SettingsDrawer anchor copy", () => {
  beforeEach(() => {
    vi.mocked(ShowNotification).mockClear();
  });

  afterEach(() => {
    cleanup();
    setClipboard(undefined);
  });

  it("notifies success after the anchor is written", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    clickCopy();

    await waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "success",
        message: "Copiado al portapapeles",
      })
    );
    expect(writeText).toHaveBeenCalledWith("#widget-w1");
  });

  it.each([
    [
      "the write is rejected",
      {
        writeText: vi
          .fn()
          .mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      },
    ],
    ["the Clipboard API is unavailable", undefined],
  ])(
    "notifies an error and never success when %s",
    async (_case, clipboard) => {
      setClipboard(clipboard);

      clickCopy();

      await waitFor(() =>
        expect(ShowNotification).toHaveBeenCalledWith({
          type: "error",
          message: "No se pudo copiar al portapapeles",
        })
      );
      expect(ShowNotification).toHaveBeenCalledTimes(1);
    }
  );
});
