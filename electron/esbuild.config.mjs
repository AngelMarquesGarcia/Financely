import esbuild from 'esbuild';

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: [
    'electron',
    'better-sqlite3',
  ],
  alias: {
    '@shared': '../shared',
  },
};

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  const mainCtx    = await esbuild.context({ ...sharedOptions, entryPoints: ['main.ts'],    outfile: '../dist/main/main.js'    });
  const preloadCtx = await esbuild.context({ ...sharedOptions, entryPoints: ['preload.ts'], outfile: '../dist/main/preload.js' });
  await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
  console.log('Watching electron sources...');
} else {
  await esbuild.build({ ...sharedOptions, entryPoints: ['main.ts'],    outfile: '../dist/main/main.js'    });
  await esbuild.build({ ...sharedOptions, entryPoints: ['preload.ts'], outfile: '../dist/main/preload.js' });
}
