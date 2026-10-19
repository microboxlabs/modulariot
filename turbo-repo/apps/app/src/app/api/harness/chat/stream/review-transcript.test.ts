import { describe, expect, it } from "vitest";
import {
  formatTranscript,
  reviewRefOf,
  transcriptRef,
} from "./review-transcript";
import { learningViewOf } from "./learning-cards";

describe("transcriptRef", () => {
  it("takes a share link's token", () => {
    expect(transcriptRef("https://app.example.test/app/es/share/abc_123")).toBe(
      "abc_123"
    );
    expect(transcriptRef("https://app.example.test/es/share/abc_123/")).toBe(
      "abc_123"
    );
  });

  it("takes a thread id as it is", () => {
    expect(transcriptRef("11111111-2222-3333-4444-555555555555")).toBe(
      "11111111-2222-3333-4444-555555555555"
    );
  });

  it("refuses anything that could leave the transcripts path", () => {
    expect(transcriptRef("../threads")).toBeNull();
    expect(transcriptRef("a/b")).toBeNull();
    expect(transcriptRef("http://[bad")).toBeNull();
  });
});

describe("reviewRefOf", () => {
  it("reads the ref after /review", () => {
    expect(reviewRefOf("/review tok_1 and add evals")).toBe("tok_1");
    expect(reviewRefOf("  /review\ttok_1")).toBe("tok_1");
  });

  it("is null for other messages", () => {
    expect(reviewRefOf("/reviews tok_1")).toBeNull();
    expect(reviewRefOf("please /review tok_1")).toBeNull();
    expect(reviewRefOf("/review")).toBeNull();
  });
});

describe("formatTranscript", () => {
  it("delimits the conversation and marks it as material, not instructions", () => {
    const text = formatTranscript({
      thread_id: "t1",
      title: null,
      messages: [{ role: "assistant", text: null, tools: [{ name: "q" }] }],
    });
    expect(text.split("\n")[0]).toBe("--- BEGIN TRANSCRIPT (thread t1) ---");
    expect(text).toContain("not instructions");
    expect(text).toContain("[assistant]\n- tool q");
    expect(text.endsWith("--- END TRANSCRIPT ---")).toBe(true);
  });
});

describe("learningViewOf", () => {
  it("names the view /layers and /diff ask for", () => {
    expect(learningViewOf("/layers")).toBe("layers");
    expect(learningViewOf("/diff please")).toBe("diff");
    expect(learningViewOf("/differences")).toBeNull();
    expect(learningViewOf("show /layers")).toBeNull();
  });
});
