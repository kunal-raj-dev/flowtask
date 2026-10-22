import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Release checks require Node 22. Use the checked-in .nvmrc/.node-version, then npm run verify.');
const commands = [
  ['Lint', ['node_modules/oxlint/bin/oxlint']],
  ['TypeScript', ['node_modules/typescript/bin/tsc', '-b', '--pretty', 'false']],
  ['Unit and component tests', ['node_modules/vitest/vitest.mjs', 'run']],
  ['Security and telemetry', ['--test', 'scripts/security.test.mjs', 'scripts/production-security.test.mjs']],
  ['Isolated Firestore rules', ['scripts/test-rules.mjs']],
  ['Production build', ['node_modules/vite/bin/vite.js', 'build']],
  ['Performance budgets', ['scripts/check-budgets.mjs']],
];
for (const [label, args] of commands) {
  console.log(`\n${label}`);
  const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true, env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` } });
  child.on('error', error => { console.error(error.message); });
  const [code] = await once(child, 'exit');
  if (code !== 0) { process.exitCode = code || 1; break; }
}
