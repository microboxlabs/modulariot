"""Exercise the workflow's actual payload, image-resolution and dispatch scripts offline."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = yaml.safe_load((ROOT / ".github/workflows/app-nightly.yml").read_text())
JOBS = WORKFLOW["jobs"]
SHA = "a" * 40


def interpolate(script, context):
    return re.sub(r"\$\{\{\s*(.*?)\s*\}\}", lambda match: context[match[1]], script)


class WorkflowFixture:
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.cwd = Path(self.directory.name)
        self.bin = self.cwd / "bin"
        self.bin.mkdir()
        self.context = {
            "env.GHCR_REGISTRY": "ghcr.io",
            "env.IMAGE_OWNER": "test",
            "needs.metadata.outputs.head_sha": SHA,
            "needs.metadata.outputs.short_sha": SHA[:7],
            "needs.metadata.outputs.nightly_date": "20261029",
            "github.repository": "test/repo",
            "github.run_id": "123",
            "github.event_name": "push",
            "inputs.deployment_provider": "",
            "secrets.DEPLOY_DISPATCH_TOKEN": "",
            "secrets.DEPLOY_DISPATCH_REPO": "",
        }
        for component in ("app", "docs", "web", "modulith", "harness"):
            self.context[f"env.{component.upper()}_IMAGE_NAME"] = f"miot-{component}"
            self.context[f"needs.{'build-app' if component == 'app' else 'resolve-' + component}.outputs.image"] = f"ghcr.io/test/miot-{component}@sha256:{'b' * 64}"
            self.context[f"needs.resolve-{component}.outputs.source_tag"] = "sha-1234567"
            self.context[f"needs.resolve-{component}.outputs.image_tag"] = f"nightly-20261029-{SHA[:7]}"
        self.env = {
            **os.environ,
            "PATH": f"{self.bin}{os.pathsep}{os.environ['PATH']}",
            "GITHUB_STEP_SUMMARY": str(self.cwd / "summary"),
            "GITHUB_OUTPUT": str(self.cwd / "output"),
        }


    def command(self, name, source):
        path = self.bin / name
        path.write_text("#!/bin/bash\nset -eu\n" + source)
        path.chmod(0o755)


    def execute(self, step, env=None):
        values = {key: interpolate(value, self.context) for key, value in step.get("env", {}).items()}
        script = interpolate(step["run"], self.context)
        for name in ("resolve-nightly-image.sh", "dispatch-trunk.sh"):
            script = script.replace(f".github/scripts/{name}", str(ROOT / ".github/scripts" / name))
        return subprocess.run(["bash", "-e", "-o", "pipefail", "-c", script], cwd=self.cwd, env={**self.env, **values, **(env or {})}, text=True, capture_output=True)


    def generate(self, provider=None):
        self.context["github.event_name"] = "workflow_dispatch" if provider else "push"
        self.context["inputs.deployment_provider"] = provider or ""
        result = self.execute(JOBS["manifest"]["steps"][0])
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads((self.cwd / "nightly-dispatch-payload.json").read_text())



class StackWorkflowTest(WorkflowFixture, unittest.TestCase):
    def test_automatic_events_cannot_reach_dispatch_or_deployment_secrets(self):
        dispatch_jobs = {name for name, job in JOBS.items() if any(("/dispatches" in step.get("run", "") or "dispatch-trunk.sh" in step.get("run", "")) for step in job["steps"])}
        self.assertEqual(dispatch_jobs, {"deploy"})
        # This is the admission boundary for push, cron and workflow_run events.
        condition = JOBS["deploy"]["if"]
        self.assertIn("github.event_name == 'workflow_dispatch'", condition)
        self.assertIn("github.ref == 'refs/heads/trunk'", condition)
        self.assertIn("&&", condition)
        for name, job in JOBS.items():
            if name != "deploy":
                self.assertNotIn("DEPLOY_DISPATCH_TOKEN", json.dumps(job))
                self.assertNotIn("environment", job)


    def test_manifest_generation_needs_no_deployment_token_and_pins_the_selected_sha(self):
        payload = self.generate()
        self.assertEqual(payload["client_payload"]["git_sha"], SHA)
        self.assertEqual(payload["event_type"], "miot-stack-nightly")
        for component in payload["client_payload"]["components"].values():
            self.assertIn("@sha256:", component["image_ref"])
            self.assertIn(SHA[:7], component["image_tag"])
        artifact = JOBS["manifest"]["steps"][-1]["with"]["path"]
        self.assertIn("nightly-manifest.json", artifact)
        self.assertIn("nightly-dispatch-payload.json", artifact)


    def test_dispatch_submits_exactly_one_prepared_payload(self):
        payload = self.generate("azure")
        self.command("gh", 'printf "%s\\n" "$*" >> calls\ncp nightly-dispatch-payload.json sent.json\n')
        result = self.execute(JOBS["deploy"]["steps"][-1], {"GH_TOKEN": "test", "EXPECTED_SHA": SHA, "DEPLOY_DISPATCH_REPO": "test/deployments"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len((self.cwd / "calls").read_text().splitlines()), 1)
        self.assertIn("repos/test/deployments/dispatches", (self.cwd / "calls").read_text())
        self.assertEqual(json.loads((self.cwd / "sent.json").read_text()), payload)


    def test_mismatched_commit_or_missing_token_prevents_dispatch(self):
        self.generate("azure")
        self.command("gh", "touch dispatched\n")
        for env in (
            {"GH_TOKEN": "test", "EXPECTED_SHA": "c" * 40},
            {"GH_TOKEN": "", "EXPECTED_SHA": SHA},
            *({"GH_TOKEN": "test", "EXPECTED_SHA": SHA, "DEPLOYMENT_PROVIDER": provider} for provider in ("gke", "all", "")),
        ):
            with self.subTest(env=env):
                result = self.execute(JOBS["deploy"]["steps"][-1], {"DEPLOY_DISPATCH_REPO": "test/deployments", **env})
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.cwd / "dispatched").exists())


    def test_manual_image_resolution_never_falls_back_to_latest(self):
        self.command("docker", 'printf "%s\\n" "$*" >> docker-calls\n[[ "$*" == *:latest ]]\n')
        self.command("sleep", "exit 0\n")
        for name in ("docs", "web", "modulith", "harness"):
            with self.subTest(component=name):
                step = next(step for step in JOBS[f"resolve-{name}"]["steps"] if step.get("id") == "resolve")
                self.context[f"needs.sources.outputs.{name}_short_sha"] = "1234567"
                self.context[f"needs.sources.outputs.expect_{name}_sha"] = "true"
                result = self.execute(step)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn(":latest", (self.cwd / "docker-calls").read_text())



class ProviderWorkflowTest(WorkflowFixture, unittest.TestCase):
    def test_each_provider_is_carried_in_its_own_manual_request(self):
        self.command("gh", 'cat nightly-dispatch-payload.json > sent.json\n')
        for provider in ("azure", "gke"):
            with self.subTest(provider=provider):
                payload = self.generate(provider)
                result = self.execute(JOBS["deploy"]["steps"][-1], {"GH_TOKEN": "test", "EXPECTED_SHA": SHA})
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(payload["event_type"], "miot-stack-trunk")
                self.assertEqual(payload["client_payload"]["deploy_kind"], "trunk")
                self.assertEqual(json.loads((self.cwd / "sent.json").read_text())["client_payload"]["deployment_provider"], provider)


    def test_release_train_also_selects_exactly_one_provider(self):
        release = yaml.safe_load((ROOT / ".github/workflows/app-release-train.yml").read_text())
        step = release["jobs"]["deploy"]["steps"][0]
        for value in step["env"].values():
            for key in re.findall(r"\$\{\{\s*(.*?)\s*\}\}", value):
                if key not in self.context:
                    self.context[key] = "1.2.3" if "version" in key else "test"
        self.context["needs.tag.outputs.sha"] = SHA
        self.context["needs.tag.outputs.short_sha"] = SHA[:7]
        self.command("gh", 'cat > sent-release.json\n')
        for provider in ("azure", "gke"):
            with self.subTest(provider=provider):
                self.context["inputs.deployment_provider"] = provider
                result = self.execute(step, {"GH_TOKEN": "test", "DEPLOY_DISPATCH_REPO": "test/deployments"})
                self.assertEqual(result.returncode, 0, result.stderr)
                sent = json.loads((self.cwd / "sent-release.json").read_text())
                self.assertEqual(sent["event_type"], "miot-stack-release")
                self.assertEqual(sent["client_payload"]["deployment_provider"], provider)
                self.assertEqual(json.loads((self.cwd / "stack-manifest.json").read_text())["deployment_provider"], provider)



if __name__ == "__main__":
    unittest.main()
