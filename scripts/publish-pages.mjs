import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Use normal Git credentials; never put tokens in URLs, files or command output.
const artifact = resolve('dist-pages');
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
if (remote !== 'https://github.com/hearyaldy/PastorPro-React.git') {
  throw new Error('Check the origin remote before publishing this repository.');
}
const checkout = mkdtempSync(join(tmpdir(), 'pastorpro-pages-'));
const git = (...args) => execFileSync('git', args, { cwd: checkout, stdio: 'inherit' });
try {
  git('clone', '--depth=1', '--single-branch', '--branch=gh-pages', remote, '.');
  // Replace only the generated app; retain other published files on the branch.
  rmSync(join(checkout, 'app'), { recursive: true, force: true });
  for (const name of readdirSync(artifact)) cpSync(join(artifact, name), join(checkout, name), { recursive: true });
  git('add', '--all');
  const changed = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: checkout, encoding: 'utf8' }).trim();
  if (changed) {
    git('commit', '-m', 'Deploy PastorPro landing page and WebApp to GitHub Pages');
    git('push', 'origin', 'gh-pages');
  } else console.log('Published files already match this build.');
} finally {
  rmSync(checkout, { recursive: true, force: true });
}
