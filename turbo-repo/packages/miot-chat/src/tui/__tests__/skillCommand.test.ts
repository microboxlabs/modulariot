import { describe, expect, it } from "vitest";
import { matchSkillRun } from "../slash/skillCommand.js";

const SKILLS = new Set(["skill-creator", "delivery-compliance-story"]);

describe("matchSkillRun", () => {
  it("routes /<skill-id> <args> to a skill run with the args as message", () => {
    expect(matchSkillRun("/skill-creator make a jira-sync", SKILLS)).toEqual({
      skillId: "skill-creator",
      message: "make a jira-sync",
    });
  });

  it("uses a kickoff message when the skill is called with no args", () => {
    expect(matchSkillRun("/skill-creator", SKILLS)).toEqual({
      skillId: "skill-creator",
      message: "Let's get started.",
    });
  });

  it("returns null for unknown tokens (falls through to slash dispatch)", () => {
    expect(matchSkillRun("/help", SKILLS)).toBeNull();
    expect(matchSkillRun("/skills", SKILLS)).toBeNull();
    expect(matchSkillRun("/nope do it", SKILLS)).toBeNull();
  });

  it("returns null for plain (non-slash) text", () => {
    expect(matchSkillRun("just chatting", SKILLS)).toBeNull();
  });
});
