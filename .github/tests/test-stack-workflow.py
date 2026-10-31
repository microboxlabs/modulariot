"""Exercise the public availability protocol without contacting a deployment system."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = yaml.safe_load((ROOT / '.github/workflows/app-nightly.yml').read_text())
JOBS = WORKFLOW['jobs']
SHA = 'a' * 40


def interpolate(value, context):
    return re.sub(r'\$\{\{\s*(.*?)\s*\}\}', lambda match: context[match[1]], value)


class WorkflowFixture:
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.cwd = Path(directory.name)
        self.bin = self.cwd / 'bin'
        self.bin.mkdir()
        self.context = {
            'env.GHCR_REGISTRY': 'ghcr.io', 'env.IMAGE_OWNER': 'test',
            'needs.metadata.outputs.head_sha': SHA, 'needs.metadata.outputs.short_sha': SHA[:7],
            'needs.metadata.outputs.nightly_date': '20261029',
            'github.repository': 'test/repo', 'github.run_id': '123',
            'secrets.DEPLOY_DISPATCH_TOKEN': '', 'secrets.DEPLOY_DISPATCH_REPO': '',
        }
        for component in ('app', 'docs', 'web', 'modulith', 'harness'):
            self.context[f'env.{component.upper()}_IMAGE_NAME'] = f'miot-{component}'
            job = 'build-app' if component == 'app' else 'resolve-' + component
            self.context[f'needs.{job}.outputs.image'] = f'ghcr.io/test/miot-{component}@sha256:{"b" * 64}'
            self.context[f'needs.resolve-{component}.outputs.source_tag'] = 'sha-1234567'
            self.context[f'needs.resolve-{component}.outputs.image_tag'] = f'nightly-20261029-{SHA[:7]}'
        self.env = {**os.environ, 'PATH': f'{self.bin}{os.pathsep}{os.environ["PATH"]}',
                    'GITHUB_STEP_SUMMARY': str(self.cwd / 'summary'), 'GITHUB_OUTPUT': str(self.cwd / 'output')}

    def command(self, name, source):
        path = self.bin / name
        path.write_text('#!/bin/bash\nset -eu\n' + source)
        path.chmod(0o755)

    def execute(self, step, env=None):
        values = {key: interpolate(value, self.context) for key, value in step.get('env', {}).items()}
        script = interpolate(step['run'], self.context)
        for name in ('resolve-nightly-image.sh', 'notify-stack.sh', 'prepare-release-notes.js', 'write-release-notes.js'):
            script = script.replace(f'.github/scripts/{name}', str(ROOT / '.github/scripts' / name))
        return subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], cwd=self.cwd,
                              env={**self.env, **values, **(env or {})}, text=True, capture_output=True)

    def generate(self):
        result = self.execute(JOBS['manifest']['steps'][0])
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads((self.cwd / 'stack-available-payload.json').read_text())


class PublicationTest(WorkflowFixture, unittest.TestCase):
    def test_publication_contains_source_and_images_without_target_controls(self):
        payload = self.generate()
        self.assertEqual(payload['event_type'], 'miot-stack-available')
        manifest = payload['client_payload']
        self.assertEqual(manifest['git_sha'], SHA)
        self.assertEqual(manifest['release_version'], f'nightly-20261029-{SHA[:7]}-123')
        allowed = {'release_version', 'channel', 'git_sha', 'short_sha', 'built_at',
                   'workflow_run_url', 'manifest_version', 'components'}
        self.assertEqual(set(manifest), allowed)
        for component in manifest['components'].values():
            self.assertIn('@sha256:', component['image_ref'])

    def test_public_workflows_have_no_target_selector(self):
        for filename in ('app-nightly.yml', 'app-release-train.yml'):
            workflow = yaml.safe_load((ROOT / '.github/workflows' / filename).read_text())
            events = workflow.get('on', workflow.get(True))
            inputs = (events.get('workflow_dispatch') or {}).get('inputs', {})
            self.assertLessEqual(set(inputs), {'release_version', 'release_notes_version'})
            publication = 'notify' if filename == 'app-nightly.yml' else 'publish'
            self.assertIs(workflow['jobs'][publication]['environment']['deployment'], False)
        self.assertNotIn('deploy', JOBS)

    def test_notification_submits_one_neutral_availability_event(self):
        payload = self.generate()
        self.command('gh', 'printf "%s\\n" "$*" >> calls\ncp stack-available-payload.json sent.json\n')
        result = self.execute(JOBS['notify']['steps'][-1], {'GH_TOKEN': 'test', 'EXPECTED_SHA': SHA})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len((self.cwd / 'calls').read_text().splitlines()), 1)
        self.assertEqual(json.loads((self.cwd / 'sent.json').read_text()), payload)

    def test_invalid_notifications_do_not_contact_the_receiver(self):
        original = self.generate()
        self.command('gh', 'touch sent\n')
        cases = [({'GH_TOKEN': '', 'EXPECTED_SHA': SHA}, original),
                 ({'GH_TOKEN': 'test', 'EXPECTED_SHA': 'c' * 40}, original)]
        extra = json.loads(json.dumps(original))
        extra['client_payload']['target_environment'] = 'private-target'
        cases.append(({'GH_TOKEN': 'test', 'EXPECTED_SHA': SHA}, extra))
        for env, payload in cases:
            (self.cwd / 'stack-available-payload.json').write_text(json.dumps(payload))
            self.assertNotEqual(self.execute(JOBS['notify']['steps'][-1], env).returncode, 0)
            self.assertFalse((self.cwd / 'sent').exists())

    def test_all_published_components_require_commit_pinned_images(self):
        self.command('docker', 'printf "%s\\n" "$*" >> calls\nexit 1\n')
        self.command('sleep', 'exit 0\n')
        for name in ('docs', 'web', 'modulith', 'harness'):
            step = next(step for step in JOBS[f'resolve-{name}']['steps'] if step.get('id') == 'resolve')
            self.context[f'needs.sources.outputs.{name}_short_sha'] = '1234567'
            self.assertNotEqual(self.execute(step).returncode, 0)
        self.assertNotIn(':latest', (self.cwd / 'calls').read_text())


class ReleasePublicationTest(WorkflowFixture, unittest.TestCase):
    def test_workflow_prepares_two_valid_prompts_with_isolated_milestones(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/app-release-train.yml').read_text())
        step = next(step for step in workflow['jobs']['prepare']['steps'] if step.get('name') == 'Build release notes prompts')
        metadata = step['env']['RELEASE_NOTES_METADATA']
        for key in re.findall(r'\$\{\{\s*(.*?)\s*\}\}', metadata):
            self.context.setdefault(key, 'test')
        self.context.update({'steps.version.outputs.release_version': '0.6.0',
                             'steps.version.outputs.release_notes_version': '1.32.0',
                             'steps.version.outputs.private_milestone': 'Release 1.32.0',
                             'steps.version.outputs.oss_milestone': 'MIOT-0.6.0'})
        prompt_path = Path('.github/prompts/app-release-notes.prompt.yml')
        (self.cwd / prompt_path.parent).mkdir(parents=True)
        (self.cwd / prompt_path).write_text((ROOT / prompt_path).read_text())
        (self.cwd / 'release-issues.json').write_text(json.dumps([
            {'source': 'release', 'milestone': 'Release 1.32.0', 'title': 'Client feature'},
            {'source': 'oss', 'milestone': 'MIOT-0.6.0', 'title': 'Platform feature'},
        ]))
        result = self.execute(step)
        self.assertEqual(result.returncode, 0, result.stderr)
        for audience, version in [('platform', '0.6.0'), ('coordinator', '1.32.0')]:
            prompt = yaml.safe_load((self.cwd / f'release-notes-{audience}.prompt.yml').read_text())
            content = prompt['messages'][1]['content']
            self.assertIn(f'Release version: {version}', content)
            self.assertIn('Platform feature', content)
            if audience == 'platform':
                self.assertNotIn('Client feature', content)
                self.assertNotIn('1.32.0', content)
            else:
                self.assertIn('Client feature', content)

    def test_note_files_are_written_in_separate_versioned_catalogs(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/app-release-train.yml').read_text())
        step = next(step for step in workflow['jobs']['prepare']['steps'] if step.get('name') == 'Write release notes')
        self.context['steps.version.outputs.release_version'] = '0.6.0'
        self.context['steps.version.outputs.release_notes_version'] = '1.32.0'
        for audience, version in [('platform', '0.6.0'), ('coordinator', '1.32.0')]:
            (self.cwd / f'release-notes-{audience}.response.mdx').write_text(
                f'```mdx\n# 🔔 Release Notes v{version} — ModularIoT\n\n{audience}\n```\n')
        result = self.execute(step)
        self.assertEqual(result.returncode, 0, result.stderr)
        for archive, app, version in [('releases/platform', 'src/releases/platform', '0.6.0'),
                                      ('releases/notes', 'src/releases', '1.32.0')]:
            content = (self.cwd / archive / f'v{version}.mdx').read_text()
            packaged = self.cwd / 'turbo-repo/apps/app' / app / f'v{version}.mdx'
            self.assertEqual(content, packaged.read_text())
            self.assertTrue(content.startswith(f'# 🔔 Release Notes v{version} —'))
        self.context.update({'github.token': 'test', 'needs.prepare.outputs.release_version': '0.6.0',
                             'needs.prepare.outputs.stack_tag': 'miot-stack@v0.6.0'})
        for component in ('app', 'docs', 'web', 'modulith', 'harness'):
            self.context[f'needs.prepare.outputs.{component}_changed'] = 'false'
            self.context[f'needs.prepare.outputs.{component}_tag'] = 'unused'
        release_step = next(step for step in workflow['jobs']['tag']['steps'] if step.get('name') == 'Create GitHub releases')
        self.command('gh', 'while [[ $# -gt 0 ]]; do\n  if [[ "$1" == "--notes-file" ]]; then cp "$2" published-notes.mdx; fi\n  shift\ndone\n')
        self.assertEqual(self.execute(release_step).returncode, 0)
        self.assertIn('Release Notes v0.6.0', (self.cwd / 'published-notes.mdx').read_text())
        self.assertNotIn('coordinator', (self.cwd / 'published-notes.mdx').read_text())
        (self.cwd / 'release-notes-platform.response.mdx').write_text(
            '# 🔔 Release Notes v1.32.0 — wrong audience/version\n')
        self.assertNotEqual(self.execute(step).returncode, 0)

    def test_release_train_also_publishes_only_availability(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/app-release-train.yml').read_text())
        job = workflow['jobs']['publish']
        step = next(step for step in job['steps'] if step.get('id') == 'payload')
        for value in step['env'].values():
            for key in re.findall(r'\$\{\{\s*(.*?)\s*\}\}', value):
                self.context.setdefault(key, '1.2.3' if 'version' in key else 'test')
        self.context['needs.tag.outputs.sha'] = SHA
        self.context['needs.tag.outputs.short_sha'] = SHA[:7]
        result = self.execute(step)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.command('gh', 'cp stack-available-payload.json sent.json\n')
        result = self.execute(job['steps'][-1], {'GH_TOKEN': 'test'})
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads((self.cwd / 'sent.json').read_text())
        self.assertEqual(payload['event_type'], 'miot-stack-available')
        self.assertEqual(payload['client_payload']['channel'], 'release')
        self.assertNotIn('target_environment', payload['client_payload'])


if __name__ == '__main__':
    unittest.main()
