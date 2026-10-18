/**
 * Builds the Funk extension: bundles src/extension.ts -> dist/extension.js
 * with esbuild, type-checks with tsc. Run via `npm run compile`.
 */
const esbuild = require('esbuild');
const { spawnSync } = require('child_process');
const path = require('path');

const prod = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: [path.join(__dirname, 'src', 'extension.ts')],
  bundle: true,
  outfile: path.join(__dirname, 'dist', 'extension.js'),
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  minify: prod,
  sourcemap: !prod,
  logLevel: 'info',
};

const tscCheck = () => {
  const res = spawnSync(
    process.execPath,
    [path.join(__dirname, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'],
    { stdio: 'inherit', cwd: __dirname },
  );
  if (res.error) {
    console.error('tsc failed to start:', res.error);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
};

tscCheck();

if (watch) {
  esbuild.context(opts).then((ctx) => ctx.watch());
} else {
  esbuild.build(opts).catch((err) => {
    console.error('esbuild failed:', err);
    process.exit(1);
  });
}
