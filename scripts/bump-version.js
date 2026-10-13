import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'manifest.json');
const publicManifestPath = path.join(rootDir, 'public', 'manifest.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function incrementVersion(version) {
  const parts = (version || '1.0.0').split('.');
  while (parts.length < 3) {
    parts.push('0');
  }
  const lastIndex = parts.length - 1;
  const num = parseInt(parts[lastIndex], 10);
  parts[lastIndex] = String(isNaN(num) ? 1 : num + 1);
  return parts.join('.');
}

const newVersion = process.argv[2] || incrementVersion(pkg.version);

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

function updateManifest(filePath) {
  if (fs.existsSync(filePath)) {
    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    manifest.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
  }
}

updateManifest(manifestPath);
updateManifest(publicManifestPath);

console.log(`Version increased to ${newVersion}`);
