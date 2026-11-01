import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import ChannelPanel from "./channel-panel";
import { accountsKey } from "./conversations-api";
import {
  CHANNEL_TYPES,
  channelType,
  isConnectionChannel,
} from "./channel-types";
import {
  channelKeyOf,
  sectionOf,
  sectionsFor,
} from "./communications-sections";

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
      for (const prefix of ["channel_", "channelMenu_", "channelHint_"]) {
        expect(d).toHaveProperty(`${prefix}${c.key}`);
      }
      if (!isConnectionChannel(c.key)) {
        expect(d).toHaveProperty(`channelOwnBody_${c.key}`);
      }
    }
  });

  it("sends Webhook, Slack and Teams through connections, and WhatsApp and email through the platform's account", () => {
    expect(
      CHANNEL_TYPES.filter((c) => isConnectionChannel(c.key)).map((c) => c.key)
    ).toEqual(["slack", "teams", "webhook"]);
    render(
      <ChannelPanel
        channel={channelType("whatsapp")!}
        d={d}
        settingsDict={es.pages.userSettings}
        orgSlug="demo"
        platformScope={false}
        canConfigure={false}
      />
    );
    expect(screen.getByText("Incluida")).toBeTruthy();
    expect(
      screen.getByText(
        "Solo los dueños de la organización pueden conectar una cuenta propia."
      )
    ).toBeTruthy();
  });

  it("sends from the platform until an owner picks the connected own account", () => {
    const accounts = (ownConnected: boolean) => ({
      [accountsKey]: [
        {
          channel: "whatsapp",
          mode: "PLATFORM",
          ownConnected,
          updatedBy: null,
          updatedAt: null,
        },
      ],
    });
    const panel = (ownConnected: boolean) => (
      <SWRConfig
        value={{ provider: () => new Map(), fallback: accounts(ownConnected) }}
      >
        <ChannelPanel
          channel={channelType("whatsapp")!}
          d={d}
          settingsDict={es.pages.userSettings}
          orgSlug={null}
          platformScope={false}
          canConfigure
        />
      </SWRConfig>
    );
    const { rerender } = render(panel(false));
    const [platform, own] = screen.getAllByRole("radio");
    expect(platform.getAttribute("aria-checked")).toBe("true");
    expect((own as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Sin conectar")).toBeTruthy();

    rerender(panel(true));
    expect(
      (screen.getAllByRole("radio")[1] as HTMLButtonElement).disabled
    ).toBe(false);
    expect(screen.getByText("Conectada")).toBeTruthy();
  });

  it("in the platform scope sets up only the platform's account", () => {
    render(
      <ChannelPanel
        channel={channelType("email")!}
        d={d}
        settingsDict={es.pages.userSettings}
        orgSlug="_platform"
        platformScope
        canConfigure={false}
      />
    );
    expect(screen.queryByText("Incluida")).toBeNull();
    expect(screen.getByText(/La cuenta de la plataforma/)).toBeTruthy();
  });
});

describe("sections by scope", () => {
  it("offers the templates, the platform's rules and its accounts in the platform scope", () => {
    expect(sectionsFor(true)).toEqual([
      "templates",
      "meta",
      "rules",
      "activity",
      "channel:whatsapp",
      "channel:email",
    ]);
    expect(sectionOf(new URLSearchParams(), true)).toBe("templates");
    expect(sectionOf(new URLSearchParams("section=rules"), true)).toBe("rules");
    // Organizations read the templates; only the platform scope sees them on Meta.
    expect(sectionOf(new URLSearchParams("section=templates"))).toBe(
      "templates"
    );
    expect(sectionOf(new URLSearchParams("section=meta"))).toBe("rules");
  });
});
