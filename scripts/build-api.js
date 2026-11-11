import { build } from 'vite';

async function buildApi() {
  await build({
    configFile: false,
    build: {
      ssr: 'api/index.ts',
      outDir: 'api',
      emptyOutDir: false,
      rollupOptions: {
        external: [
          '@neondatabase/serverless',
          'pg',
          'bcryptjs',
          'cors',
          'express',
          'jsonwebtoken',
          'zod',
          'dotenv',
        ],
        output: {
          format: 'esm',
          entryFileNames: 'index.js',
        },
      },
    },
  });
}

buildApi().catch((err) => {
  console.error(err);
  process.exit(1);
});

