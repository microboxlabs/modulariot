import { describe, expect, it } from "vitest";
import { channelLink, phoneDigits } from "./channel-link";

describe("channelLink", () => {
  it("opens WhatsApp with the message typed, and the dialer for a call", () => {
    expect(channelLink("whatsapp", "+56 9 1234 5678", "Hola, ¿dónde va?")).toBe(
      "https://wa.me/56912345678?text=Hola%2C%20%C2%BFd%C3%B3nde%20va%3F"
    );
    expect(channelLink("whatsapp", "+56912345678", "  ")).toBe(
      "https://wa.me/56912345678"
    );
    expect(channelLink("phone", "+56 9 1234 5678", "x")).toBe(
      "tel:+56912345678"
    );
  });

  it("opens nothing without a usable number, or for Meet and Teams", () => {
    expect(channelLink("whatsapp", "", "x")).toBeNull();
    expect(channelLink("phone", "123", "x")).toBeNull();
    expect(channelLink("meet", "+56912345678", "x")).toBeNull();
    expect(phoneDigits(undefined)).toBeNull();
  });
});
