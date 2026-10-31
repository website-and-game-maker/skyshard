// Fails the build if the shipped JS/CSS grows past budget (gzipped bytes).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET = Number(process.env.SKYSHARD_BUDGET_KB || 600) * 1024;

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.js', '.css', '.html'].includes(extname(p))) files.push(p);
  }
};
walk(DIST);

let total = 0;
for (const f of files) {
  const gz = gzipSync(readFileSync(f)).length;
  total += gz;
  console.log(`${(gz / 1024).toFixed(1).padStart(8)} KB  ${f}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(8)} KB  total gzipped (budget ${BUDGET / 1024} KB)`);
if (total > BUDGET) {
  console.error('Bundle is over budget.');
  process.exit(1);
}
