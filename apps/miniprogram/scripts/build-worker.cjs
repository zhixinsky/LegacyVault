const esbuild = require('esbuild');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');

esbuild.buildSync({
  entryPoints: [resolve(root, 'src/workers/derive-master-key.ts')],
  outfile: resolve(root, 'src/static/workers/derive-master-key.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
});
