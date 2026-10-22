/**
 * build.js
 * esbuild script: bundles widget/src/index.js → widget/dist/widget.js
 * Includes socket.io-client in the bundle. No external CSS or assets.
 *
 * Usage:
 *   node build.js           → production build (minified)
 *   node build.js --watch   → watch mode (development)
 */

import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [join(__dirname, 'src', 'index.js')],
  bundle: true,
  outfile: join(__dirname, 'dist', 'widget.js'),
  format: 'iife',
  globalName: 'HelpdeskWidget',
  platform: 'browser',
  target: ['es2019', 'chrome70', 'firefox70', 'safari12'],
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[esbuild] Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('[esbuild] Build complete → dist/widget.js');
}
