import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import ChannelPanel from "./channel-panel";
import { CHANNEL_TYPES, channelType } from "./channel-types";
import { channelKeyOf, sectionOf } from "./communications-sections";

const d = es.pages.userSettings.communications;

describe("sectionOf", () => {
  it("defaults to the rules and ignores unknown sections", () => {
    expect(sectionOf(new URLSearchParams())).toBe("rules");
    expect(sectionOf(new URLSearchParams("section=channel:fax"))).toBe("rules");
  });

  it("opens a channel, and the old tab link still opens Actividad", () => {
    expect(sectionOf(new URLSearchParams("section=channel:whatsapp"))).toBe(
      "channel:whatsapp"
    );
    expect(sectionOf(new URLSearchParams("tab=activity"))).toBe("activity");
    expect(channelKeyOf("channel:slack")).toBe("slack");
    expect(channelKeyOf("rules")).toBeNull();
  });
});

describe("ChannelPanel", () => {
  it("has every channel's texts in both dictionaries", () => {
    for (const c of CHANNEL_TYPES) {
      for (const prefix of [
        "channel_",
        "channelMenu_",
        "channelHint_",
        "channelOwnBody_",
      ]) {
        expect(d).toHaveProperty(`${prefix}${c.key}`);
      }
    }
  });

  it("offers the platform's account only where the platform has one", () => {
    const { unmount } = render(
      <ChannelPanel channel={channelType("whatsapp")!} d={d} />
    );
    expect(screen.getByText("Incluida")).toBeTruthy();
    unmount();
    render(<ChannelPanel channel={channelType("slack")!} d={d} />);
    expect(screen.getByText("No disponible")).toBeTruthy();
  });
});
