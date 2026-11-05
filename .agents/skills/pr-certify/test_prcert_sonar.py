"""Which SonarCloud projects a PR must be clean on when it has no Sonar check.

Run: python3 .agents/skills/pr-certify/test_prcert_sonar.py
"""
import importlib.machinery
import importlib.util
import os
import tempfile
import unittest

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

    def test_a_pr_outside_every_project_needs_none(self):
        self.assertEqual(self.keys(["docs/readme.md", "web/apps/app/README.md"]), [])

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
