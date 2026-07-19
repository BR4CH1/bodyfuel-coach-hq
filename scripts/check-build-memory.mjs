import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const build = pkg.scripts?.build ?? '';

if (!build.includes('--max-old-space-size=4096')) {
  console.error('Build memory guard missing: expected --max-old-space-size=4096 in npm run build.');
  process.exit(1);
}

console.log('Build memory guard OK (4096 MB).');
