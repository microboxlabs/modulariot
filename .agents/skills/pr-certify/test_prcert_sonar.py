"""Which SonarCloud projects a PR must be clean on when it has no Sonar check.

Run: python3 .agents/skills/pr-certify/test_prcert_sonar.py
"""
import importlib.machinery
import importlib.util
import os
import tempfile
import unittest
from unittest.mock import patch

HERE = os.path.dirname(os.path.abspath(__file__))
_loader = importlib.machinery.SourceFileLoader("prcert", os.path.join(HERE, "bin", "prcert"))
_spec = importlib.util.spec_from_loader("prcert", _loader)
prcert = importlib.util.module_from_spec(_spec)
_loader.exec_module(prcert)


def pr(paths, more=False):
    return {"files": {"pageInfo": {"hasNextPage": more}, "nodes": [{"path": p} for p in paths]}}


def write(root, rel, text):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(text)


class SonarScopeTest(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = self.root = self.tmp.name
        write(root, "web/apps/app/sonar-project.properties", "sonar.projectKey=org_app\nsonar.sources=src\n")
        write(root, "web/sonar-project.properties",
              "sonar.projectKey=org_dash\nsonar.sources=packages/dash/src,packages/ui/src\n")
        write(root, "py/sonar-project.properties", "sonar.projectKey=org_py\n")
        write(root, ".github/workflows/java.yml", "\n".join([
            "jobs:",
            "  sonar:",
            "    steps:",
            "      - name: Compile",
            "        run: ./mvnw compile",
            "      - name: SonarCloud Scan",
            "        run: >",
            "          ./mvnw sonar",
            "          -Dsonar.projectKey=org_java",
            "        working-directory: srv",
            "",
        ]))

    def tearDown(self):
        self.tmp.cleanup()

    def keys(self, paths, more=False):
        return sorted(prcert.sonar_keys(pr(paths, more), self.root))

    def test_declares_properties_and_workflow_projects_with_their_roots(self):
        found = dict(prcert.declared_sonar_projects(self.root))
        self.assertEqual(found["org_app"], ["web/apps/app/src"])
        self.assertEqual(found["org_dash"], ["web/packages/dash/src", "web/packages/ui/src"])
        self.assertEqual(found["org_py"], ["py"])
        self.assertEqual(found["org_java"], ["srv"])

    def test_keeps_only_the_projects_whose_sources_the_pr_touches(self):
        self.assertEqual(self.keys(["srv/core/src/main/java/A.java"]), ["org_java"])
        self.assertEqual(self.keys(["web/apps/app/src/page.tsx"]), ["org_app"])
        self.assertEqual(self.keys(["web/packages/ui/src/a.ts", "py/x.py"]), ["org_dash", "org_py"])
        self.assertEqual(self.keys(["web/apps/app/src-other/page.tsx"]), [])

    def test_a_pr_outside_every_project_needs_none(self):
        self.assertEqual(self.keys(["docs/readme.md", "web/apps/app/README.md"]), [])

    def test_test_only_changes_keep_the_project(self):
        write(self.root, "py/sonar-project.properties",
              "sonar.projectKey=org_py\nsonar.sources=src\nsonar.tests=tests,integration\n")
        self.assertEqual(self.keys(["py/tests/test_app.py"]), ["org_py"])
        self.assertEqual(self.keys(["py/integration/test_api.py"]), ["org_py"])
        self.assertEqual(self.keys(["py/README.md"]), [])

    def test_tests_do_not_replace_the_default_source_root(self):
        write(self.root, "py/sonar-project.properties",
              "sonar.projectKey=org_py\nsonar.tests=tests\n")
        self.assertEqual(self.keys(["py/app.py"]), ["org_py"])

    def test_project_base_applies_to_sources_and_tests(self):
        write(self.root, "py/sonar-project.properties",
              "sonar.projectKey=org_py\nsonar.projectBaseDir=service\nsonar.sources=src\nsonar.tests=tests\n")
        self.assertEqual(self.keys(["py/service/src/app.py"]), ["org_py"])
        self.assertEqual(self.keys(["py/service/tests/test_app.py"]), ["org_py"])
        self.assertEqual(self.keys(["py/src/app.py"]), [])

    def test_workflow_scope_does_not_leak_into_the_next_job(self):
        write(self.root, ".github/workflows/java.yml", "\n".join([
            "jobs:", "  scan:", "    steps:",
            "      - run: ./mvnw sonar -Dsonar.projectKey=org_java",
            "  later:", "    defaults:", "      run:",
            "        working-directory: elsewhere", "    steps:",
            "      - run: echo done",
        ]))
        self.assertEqual(self.keys(["srv/A.java"]), ["org_java"])

    def test_commented_workflow_keys_do_not_declare_projects(self):
        write(self.root, ".github/workflows/disabled.yml",
              "# -Dsonar.projectKey=org_disabled\n  # -Dsonar.projectKey=org_old\n")
        self.assertEqual(self.keys(["docs/readme.md"]), [])

    def test_workflow_roots_are_normalized(self):
        path = os.path.join(self.root, ".github/workflows/java.yml")
        with open(path) as fh:
            workflow = fh.read()
        for root in ["./srv", "'./srv/'", '"./srv/../srv"']:
            with self.subTest(root=root):
                write(self.root, ".github/workflows/java.yml",
                      workflow.replace("working-directory: srv", "working-directory: " + root))
                self.assertEqual(self.keys(["srv/A.java"]), ["org_java"])
        write(self.root, ".github/workflows/java.yml",
              workflow.replace("working-directory: srv", "working-directory: ."))
        self.assertEqual(self.keys(["docs/readme.md"]), ["org_java"])

    def test_no_matching_project_is_clean_without_querying_sonar(self):
        with patch.object(prcert, "sonar_get") as request:
            state = prcert.sonar_state(pr(["docs/readme.md"]), {}, self.root)
        self.assertTrue(state["available"])
        self.assertEqual(state["verdict"], "clean")
        self.assertEqual(state["projects"], [])
        request.assert_not_called()

    def test_missing_configuration_does_not_report_clean(self):
        with tempfile.TemporaryDirectory() as root:
            state = prcert.sonar_state(pr(["docs/readme.md"]), {}, root)
        self.assertFalse(state["available"])
        self.assertIsNone(state["verdict"])

    def test_missing_file_list_still_requires_analysis(self):
        with patch.dict(os.environ, {"SONAR_TOKEN": ""}):
            state = prcert.sonar_state(pr([]), {"sonarTokenEnv": "SONAR_TOKEN"}, self.root)
        self.assertFalse(state["available"])
        self.assertEqual(sorted(state["projects"]), ["org_app", "org_dash", "org_java", "org_py"])

    def test_an_incomplete_file_list_keeps_every_project(self):
        self.assertEqual(self.keys(["docs/readme.md"], more=True), ["org_app", "org_dash", "org_java", "org_py"])

    def test_a_sonar_check_on_the_pr_wins_over_the_declared_projects(self):
        with_check = pr(["docs/readme.md"])
        with_check["statusCheckRollup"] = None
        original = prcert.check_contexts
        prcert.check_contexts = lambda _pr: [
            {"name": "SonarCloud Code Analysis", "url": "https://sonarcloud.io/dashboard?id=org_java&pullRequest=1"}]
        try:
            self.assertEqual(prcert.sonar_keys(with_check, self.root), ["org_java"])
        finally:
            prcert.check_contexts = original


if __name__ == "__main__":
    unittest.main()
