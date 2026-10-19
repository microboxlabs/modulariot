import { describe, expect, it } from "vitest";
import {
  firstExchange,
  firstMessageTitle,
  type TitleSourceMessage,
} from "./session-title";

const user = (text: string): TitleSourceMessage => ({
  role: "user",
  content: [{ type: "text", text }],
});

const assistant = (text: string, status = "complete"): TitleSourceMessage => ({
  role: "assistant",
  content: [
    { type: "reasoning", text: "thinking" },
    { type: "text", text },
  ],
  status: { type: status },
});

describe("firstMessageTitle", () => {
  it("is the first user message's text", () => {
    expect(
      firstMessageTitle([user("  trips by region "), assistant("12")])
    ).toBe("trips by region");
  });

  it("is null for an empty thread or a message with no text", () => {
    expect(firstMessageTitle([])).toBeNull();
    expect(
      firstMessageTitle([{ role: "user", content: [{ type: "image" }] }])
    ).toBeNull();
  });
});

describe("firstExchange", () => {
  it("pairs the first question with its completed answer, text parts only", () => {
    expect(firstExchange([user("trips?"), assistant("12 trips")])).toEqual({
      message: "trips?",
      answer: "12 trips",
    });
  });

  it("waits for the answer to complete", () => {
    expect(
      firstExchange([user("trips?"), assistant("12", "running")])
    ).toBeNull();
    expect(
      firstExchange([user("trips?"), assistant("", "incomplete")])
    ).toBeNull();
    expect(firstExchange([user("trips?")])).toBeNull();
  });

  it("ignores a thread past its first turn", () => {
    expect(
      firstExchange([user("a"), assistant("b"), user("c"), assistant("d")])
    ).toBeNull();
  });
});
