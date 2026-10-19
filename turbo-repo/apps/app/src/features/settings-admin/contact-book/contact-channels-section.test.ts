import { describe, expect, it } from "vitest";
import { emptyChannelValues, updateChannel } from "./contact-channels-section";

describe("updateChannel", () => {
  it("copies the phone into an empty WhatsApp", () => {
    const next = updateChannel(emptyChannelValues(), "phone", "+569");
    expect(next.whatsapp).toBe("+569");
  });

  it("keeps WhatsApp following the phone while they match", () => {
    const values = { ...emptyChannelValues(), phone: "+569", whatsapp: "+569" };
    expect(updateChannel(values, "phone", "+5691").whatsapp).toBe("+5691");
  });

  it("leaves a WhatsApp with its own number alone", () => {
    const values = { ...emptyChannelValues(), phone: "+569", whatsapp: "+568" };
    expect(updateChannel(values, "phone", "+5691").whatsapp).toBe("+568");
  });

  it("doesn't touch WhatsApp when other channels change", () => {
    const next = updateChannel(emptyChannelValues(), "meet", "a@b.cl");
    expect(next).toEqual({ ...emptyChannelValues(), meet: "a@b.cl" });
  });
});
