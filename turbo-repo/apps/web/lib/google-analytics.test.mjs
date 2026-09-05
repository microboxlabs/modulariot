import assert from "node:assert/strict";
import test from "node:test";
import { parseGoogleAnalyticsId } from "./google-analytics.ts";

test("preserves a valid GA4 measurement ID", () => {
  assert.equal(parseGoogleAnalyticsId("G-PSW1MY7HB4"), "G-PSW1MY7HB4");
});

test("disables analytics when the measurement ID is absent or malformed", () => {
  for (const value of [
    undefined,
    "",
    " ",
    "G-",
    "UA-123456789-1",
    "GTM-PSW1MY7HB4",
    "invalid",
    "g-psw1my7hb4",
    " G-PSW1MY7HB4",
    "G-PSW1MY7HB4 ",
    "G-PSW1MY7HB4\n",
    "G-PSW1MY7HB4'",
    "G-PSW1MY7HB4&extra=value",
  ]) {
    assert.equal(parseGoogleAnalyticsId(value), undefined, String(value));
  }
});
