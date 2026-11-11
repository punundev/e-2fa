import { build } from 'vite';
import fs from 'fs';
import path from 'path';

async function buildApi() {
  await build({
    configFile: false,
    build: {
      ssr: 'server/src/serverless.ts',
      outDir: 'api',
      emptyOutDir: false,
      copyPublicDir: false,
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

  // Ensure no conflicting or extra files in api/
  const apiDir = path.resolve(process.cwd(), 'api');
  for (const item of fs.readdirSync(apiDir)) {
    if (item !== 'index.js') {
      fs.rmSync(path.join(apiDir, item), { recursive: true, force: true });
    }
  }
}

buildApi().catch((err) => {
  console.error(err);
  process.exit(1);
});


