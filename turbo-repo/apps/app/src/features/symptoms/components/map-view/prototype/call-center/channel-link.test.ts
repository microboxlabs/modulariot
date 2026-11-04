import { describe, expect, it } from "vitest";
import { channelLink, phoneDigits } from "./channel-link";

describe("channelLink", () => {
  it("opens WhatsApp with the message typed, and the dialer for a call", () => {
    expect(channelLink("whatsapp", "+1 202 555 0101", "Hola, ¿dónde va?")).toBe(
      "https://wa.me/12025550101?text=Hola%2C%20%C2%BFd%C3%B3nde%20va%3F"
    );
    expect(channelLink("whatsapp", "+12025550101", "  ")).toBe(
      "https://wa.me/12025550101"
    );
    expect(channelLink("phone", "+1 202 555 0101", "x")).toBe(
      "tel:+12025550101"
    );
  });

  it("opens nothing without a usable number, or for Meet and Teams", () => {
    expect(channelLink("whatsapp", "", "x")).toBeNull();
    expect(channelLink("phone", "123", "x")).toBeNull();
    expect(channelLink("meet", "+12025550101", "x")).toBeNull();
    expect(phoneDigits(undefined)).toBeNull();
  });
});
