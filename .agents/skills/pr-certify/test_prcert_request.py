"""`prcert request` must not ping a reviewer that is off, and never escalates on its own.

Run: python3 .agents/skills/pr-certify/test_prcert_request.py
"""
import contextlib
import importlib.machinery
import importlib.util
import io
import json
import os
import types
import unittest
from unittest.mock import patch

HERE = os.path.dirname(os.path.abspath(__file__))
_loader = importlib.machinery.SourceFileLoader("prcert", os.path.join(HERE, "bin", "prcert"))
_spec = importlib.util.spec_from_loader("prcert", _loader)
prcert = importlib.util.module_from_spec(_spec)
_loader.exec_module(prcert)

HEAD = "b" * 40
OLD = "a" * 40
PUSHED = "2026-11-09T23:40:00Z"

RATE_LIMITED = ("> [!WARNING]\n> ## Review rate limited\n> Next included review available in "
                "12 minutes. A review may still proceed through usage-based billing.")
DECLINED = "> [!NOTE]\n> Action not completed. Already reviewed the last commit."


def comment(login, body, at, updated=None):
    return {"databaseId": 1, "author": {"login": login}, "body": body,
            "createdAt": at, "updatedAt": updated or at}


def review(login, sha, at, body="**Actionable comments posted: 0**"):
    return {"author": {"login": login}, "state": "COMMENTED", "submittedAt": at,
            "body": body, "commit": {"oid": sha}}


def make_pr(comments=(), reviews=(), base="trunk"):
    return {
        "id": "PR_1", "number": 7, "title": "t", "url": "u", "state": "OPEN",
        "isDraft": False, "mergeable": "MERGEABLE",
        "baseRefName": base, "headRefName": "x", "headRefOid": HEAD, "_defaultBranch": "trunk",
        "additions": 1, "deletions": 0, "changedFiles": 1, "author": {"login": "dev"},
        "labels": {"nodes": []},
        "files": {"pageInfo": {"hasNextPage": False}, "nodes": [{"path": "docs/a.md"}]},
        "commits": {"nodes": [{"commit": {"oid": HEAD, "pushedDate": None,
                                          "committedDate": PUSHED, "statusCheckRollup": None}}]},
        "reviews": {"nodes": list(reviews)},
        "reviewThreads": {"nodes": []},
        "reviewRequests": {"nodes": []},
        "comments": {"nodes": list(comments)},
    }


def request(pr, settings=None, copilot=False, coderabbit=True, full=False):
    """Run cmd_request against a fake gh; return (posted gh calls, printed result)."""
    calls = []

    def fake_gh(args, check=True, stdin=None, retries=0):
        calls.append(args)
        out = json.dumps({"data": {"requestReviews": {"pullRequest": {"reviewRequests": {
            "nodes": [{"requestedReviewer": {"login": prcert.COPILOT_BOT}}]}}}}})
        return out, 0, ""

    ctx = {"pr": pr, "owner": "o", "name": "r",
           "settings": dict(prcert.DEFAULTS, **(settings or {}))}
    args = types.SimpleNamespace(copilot=copilot, coderabbit=coderabbit, codex=False, full=full)
    buf = io.StringIO()
    with patch.object(prcert, "gh", fake_gh), contextlib.redirect_stdout(buf):
        prcert.cmd_request(args, ctx)
    return calls, {r["provider"]: r for r in json.loads(buf.getvalue())["requested"]}


def bodies(calls):
    return [a[-1] for a in calls if "-X" in a and "POST" in a]


class CodeRabbitRequestTest(unittest.TestCase):

    def test_first_request_posts_an_incremental_review(self):
        calls, out = request(make_pr())
        self.assertEqual(bodies(calls), ["body=@coderabbitai review"])
        self.assertTrue(out["coderabbit"]["ok"])

    def test_rate_limited_means_no_ping(self):
        pr = make_pr([comment("coderabbitai", RATE_LIMITED, "2026-11-09T23:41:00Z")])
        calls, out = request(pr)
        self.assertEqual(calls, [])
        self.assertTrue(out["coderabbit"]["skipped"])
        self.assertIn("rate limited", out["coderabbit"]["reason"])

    def test_rate_limit_edited_into_the_summary_comment_counts(self):
        pr = make_pr([comment("coderabbitai", RATE_LIMITED, "2026-11-01T10:00:00Z",
                              updated="2026-11-09T23:41:00Z")],
                     [review("coderabbitai", OLD, "2026-11-02T10:00:00Z")])
        calls, out = request(pr)
        self.assertEqual(calls, [])
        self.assertTrue(out["coderabbit"]["skipped"])

    def test_rate_limited_blocks_even_full(self):
        pr = make_pr([comment("coderabbitai", RATE_LIMITED, "2026-11-09T23:41:00Z")])
        calls, _ = request(pr, full=True)
        self.assertEqual(calls, [])

    def test_disabled_for_the_base_branch_means_no_ping(self):
        skipped = ("> [!IMPORTANT]\n> ## Review skipped\n> Auto reviews are disabled on base/target "
                   "branches other than the default branch.")
        pr = make_pr([comment("coderabbitai", skipped, "2026-11-09T23:41:00Z")], base="feature")
        calls, out = request(pr)
        self.assertEqual(calls, [])
        self.assertTrue(out["coderabbit"]["skipped"])

    def test_declined_means_no_full_review(self):
        pr = make_pr([comment("dev", "@coderabbitai review", "2026-11-09T23:30:00Z"),
                      comment("coderabbitai", DECLINED, "2026-11-09T23:31:00Z")],
                     [review("coderabbitai", OLD, "2026-11-09T23:00:00Z")])
        calls, out = request(pr)
        self.assertEqual(calls, [])
        self.assertTrue(out["coderabbit"]["skipped"])
        self.assertNotIn("full review", out["coderabbit"]["reason"])

    def test_explicit_full_is_the_only_way_to_a_full_review(self):
        pr = make_pr([comment("coderabbitai", DECLINED, "2026-11-09T23:31:00Z")],
                     [review("coderabbitai", OLD, "2026-11-09T23:00:00Z")])
        calls, _ = request(pr, full=True)
        self.assertEqual(bodies(calls), ["body=@coderabbitai full review"])

    def test_a_second_request_on_the_same_head_posts_nothing(self):
        pr = make_pr([comment("dev", "@coderabbitai review", "2026-11-09T23:45:00Z")])
        calls, out = request(pr)
        self.assertEqual(calls, [])
        self.assertIn("already asked", out["coderabbit"]["reason"])

    def test_a_ping_on_an_older_head_does_not_block_the_new_one(self):
        pr = make_pr([comment("dev", "@coderabbitai review", "2026-11-09T20:00:00Z")],
                     [review("coderabbitai", OLD, "2026-11-09T20:10:00Z")])
        calls, _ = request(pr)
        self.assertEqual(bodies(calls), ["body=@coderabbitai review"])

    def test_coderabbit_tips_quoting_the_command_are_not_a_ping(self):
        tips = "Tips: type `@coderabbitai review` to trigger a review."
        pr = make_pr([comment("coderabbitai", tips, "2026-11-09T23:50:00Z")])
        calls, _ = request(pr)
        self.assertEqual(bodies(calls), ["body=@coderabbitai review"])

    def test_already_reviewed_head_posts_nothing(self):
        pr = make_pr(reviews=[review("coderabbitai", HEAD, "2026-11-09T23:50:00Z")])
        calls, out = request(pr)
        self.assertEqual(calls, [])
        self.assertTrue(out["coderabbit"]["skipped"])

    def test_request_coderabbit_false_posts_nothing(self):
        calls, out = request(make_pr(), settings={"requestCodeRabbit": False})
        self.assertEqual(calls, [])
        self.assertIn("requestCodeRabbit", out["coderabbit"]["reason"])


class CopilotRequestTest(unittest.TestCase):

    def test_max_copilot_rounds_zero_means_no_copilot_request(self):
        calls, out = request(make_pr(), settings={"maxCopilotRounds": 0},
                             copilot=True, coderabbit=False)
        self.assertEqual(calls, [])
        self.assertTrue(out["copilot"]["skipped"])
        self.assertIn("codex-review-pr", out["copilot"]["reason"])

    def test_one_round_allowed_requests_copilot_once(self):
        calls, out = request(make_pr(), settings={"maxCopilotRounds": 1},
                             copilot=True, coderabbit=False)
        self.assertEqual(len(calls), 1)
        self.assertTrue(out["copilot"]["ok"])


class StatusTest(unittest.TestCase):

    def assess(self, pr, **settings):
        base = dict(prcert.DEFAULTS, requireCopilot=False, requireSonar=False)
        base.update(settings)
        return prcert.assess(pr, base, None, skip_sonar=True)

    def test_rate_limited_comment_is_a_warning_not_a_blocker(self):
        pr = make_pr([comment("coderabbitai", RATE_LIMITED, "2026-11-09T23:41:00Z")],
                     [review("coderabbitai", OLD, "2026-11-09T20:00:00Z")])
        st = self.assess(pr, requireCodeRabbit=True)
        self.assertFalse(st["providers"]["coderabbit"]["available"])
        self.assertFalse([b for b in st["blockers"] if "coderabbit" in b])
        self.assertTrue([w for w in st["warnings"] if "coderabbit" in w])

    def test_declined_with_no_review_is_a_warning_not_a_blocker(self):
        pr = make_pr([comment("dev", "@coderabbitai review", "2026-11-09T23:45:00Z"),
                      comment("coderabbitai", DECLINED, "2026-11-09T23:46:00Z")])
        st = self.assess(pr, requireCodeRabbit=True)
        self.assertFalse(st["providers"]["coderabbit"]["available"])
        self.assertFalse([b for b in st["blockers"] if "coderabbit" in b])


def codex_comment(sha, at, login="korutx", association="MEMBER", text="- media: a.py:3 ..."):
    c = comment(login, "%s\n\nHead `%s`\n\n%s\n\n<!-- codex-review head=%s -->"
                % (prcert.CODEX_TITLE, sha[:9], text, sha), at)
    c["authorAssociation"] = association
    c["url"] = "https://github.com/o/r/pull/7#issuecomment-1"
    return c


COPILOT_OFF = {"maxCopilotRounds": 0}


class IndependentRoundsTest(unittest.TestCase):
    """Where Copilot is off, codex-review-pr gets maxIndependentRounds (one) per PR."""

    def assess(self, pr, **settings):
        base = dict(prcert.DEFAULTS, requireCopilot=False, requireSonar=False,
                    requireCodeRabbit=False, **COPILOT_OFF)
        base.update(settings)
        return prcert.assess(pr, base, None, skip_sonar=True)

    def run_request(self, pr, settings=None):
        ran = []

        def fake_run(cmd, **kw):
            ran.append(cmd)
            return types.SimpleNamespace(returncode=0, stdout="review", stderr="")

        ctx = {"pr": pr, "owner": "o", "name": "r",
               "settings": dict(prcert.DEFAULTS, **dict(COPILOT_OFF, **(settings or {})))}
        args = types.SimpleNamespace(copilot=False, coderabbit=False, codex=True, full=False)
        buf = io.StringIO()
        with patch.object(prcert.subprocess, "run", fake_run), \
                contextlib.redirect_stdout(buf):
            prcert.cmd_request(args, ctx)
        return ran, {r["provider"]: r for r in json.loads(buf.getvalue())["requested"]}

    def test_defaults(self):
        self.assertEqual(prcert.DEFAULTS["maxRounds"], 2)
        self.assertEqual(prcert.DEFAULTS["maxIndependentRounds"], 1)

    def test_codex_reviews_are_counted_per_head(self):
        pr = make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z"),
                      codex_comment(OLD, "2026-11-09T20:05:00Z"),
                      codex_comment(HEAD, "2026-11-09T23:50:00Z")])
        self.assertEqual(prcert.codex_rounds(pr), 2)

    def test_untrusted_or_broken_comments_are_not_reviews(self):
        pr = make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z", login="stranger",
                                    association="NONE"),
                      codex_comment(HEAD, "2026-11-09T23:50:00Z",
                                    text="failed to initialize sandbox")])
        self.assertEqual(prcert.codex_rounds(pr), 0)

    def test_cot_app_comment_counts(self):
        pr = make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z", login="cot-bot",
                                    association="NONE")])
        self.assertEqual(prcert.codex_rounds(pr), 1)

    def test_first_round_runs_codex_review(self):
        ran, out = self.run_request(make_pr())
        self.assertEqual(ran, [["codex-review-pr", "o/r#7"]])
        self.assertTrue(out["codex"]["ok"])

    def test_after_one_round_request_skips_codex(self):
        ran, out = self.run_request(make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z")]))
        self.assertEqual(ran, [])
        self.assertTrue(out["codex"]["skipped"])
        self.assertIn("round cap spent (1 of 1)", out["codex"]["reason"])

    def test_raised_cap_allows_a_second_round(self):
        ran, _ = self.run_request(make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z")]),
                                  {"maxIndependentRounds": 2})
        self.assertEqual(len(ran), 1)

    def test_copilot_on_means_no_codex_request(self):
        ran, out = self.run_request(make_pr(), {"maxCopilotRounds": 1})
        self.assertEqual(ran, [])
        self.assertTrue(out["codex"]["skipped"])

    def test_stale_review_after_the_cap_is_a_warning_naming_the_commits(self):
        st = self.assess(make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z")]))
        self.assertFalse([b for b in st["blockers"] if "codex" in b])
        warn = [w for w in st["warnings"] if w.startswith("codex reviewed")]
        self.assertEqual(len(warn), 1)
        self.assertIn("%s..%s" % (OLD[:8], HEAD[:8]), warn[0])
        self.assertEqual(st["providers"]["codex"]["rounds"], 1)

    def test_no_review_yet_is_a_warning(self):
        pr = make_pr()
        pr["url"] = "https://github.com/o/r/pull/7"
        st = self.assess(pr)
        self.assertTrue([w for w in st["warnings"] if "run codex-review-pr o/r#7" in w])

    def test_over_the_cap_is_reported(self):
        st = self.assess(make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z"),
                                  codex_comment(HEAD, "2026-11-09T23:50:00Z")]))
        self.assertTrue([w for w in st["warnings"] if "over the cap" in w])

    def test_open_copilot_threads_still_block_after_the_cap(self):
        pr = make_pr(reviews=[review(prcert.COPILOT_BOT, OLD, "2026-11-09T20:00:00Z",
                                     body="### \U0001F7E1 Changes recommended")])
        pr["reviewThreads"] = {"nodes": [{"id": "T1", "isResolved": False, "isOutdated": False,
                                          "path": "a.py", "line": 3, "comments": {"nodes": [{
                                              "databaseId": 2,
                                              "author": {"login": prcert.COPILOT_BOT},
                                              "body": "bug", "url": "u"}]}}]}
        st = self.assess(pr, requireCopilot=True, maxCopilotRounds=1)
        self.assertTrue([w for w in st["warnings"] if "round cap is spent" in w])
        self.assertIn("1 unresolved bot review thread(s)", st["blockers"])

    def test_fresh_codex_review_is_a_finding(self):
        pr = make_pr([codex_comment(HEAD, "2026-11-09T23:50:00Z")])
        settings = dict(prcert.DEFAULTS, **COPILOT_OFF)
        args = types.SimpleNamespace(include_outdated=False, limit=10)
        with patch.object(prcert, "sonar_findings", lambda *a: []):
            items = prcert.collect_findings(pr, settings, None, args)
        self.assertEqual([i["source"] for i in items], ["codex"])

    def test_stamp_lists_codex_rounds(self):
        st = self.assess(make_pr([codex_comment(OLD, "2026-11-09T20:00:00Z")]))
        body = prcert.render_stamp(st, 2, "")
        self.assertIn("| codex | reviewed (stale head) | rounds 1 of 1 |", body)


if __name__ == "__main__":
    unittest.main()
