#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

/** Recursively list .js files under dir */
function listJs(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listJs(p));
    else if (/\.(js|mjs)$/i.test(name)) out.push(p);
  }
  return out;
}

/** Extract exported symbol names (named exports only) */
function extractExports(content) {
  const names = new Set();
  const reFn = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  const reConst = /export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/g;
  const reClass = /export\s+class\s+([A-Za-z0-9_]+)/g;
  const reNamed = /export\s*\{\s*([^}]+)\s*\}/g; // export { a, b as c }

  let m;
  while ((m = reFn.exec(content))) names.add(m[1]);
  while ((m = reConst.exec(content))) names.add(m[1]);
  while ((m = reClass.exec(content))) names.add(m[1]);
  while ((m = reNamed.exec(content))) {
    const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const asIdx = p.toLowerCase().lastIndexOf(' as ');
      const name = asIdx >= 0 ? p.slice(asIdx + 4).trim() : p;
      if (name !== 'default') names.add(name);
    }
  }
  return Array.from(names);
}

/** Extract imported symbol names (named imports only) */
function extractImports(content) {
  const names = new Set();
  const reNamed = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"][^'"]+['"]/g;
  let m;
  while ((m = reNamed.exec(content))) {
    const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const asIdx = p.toLowerCase().lastIndexOf(' as ');
      const name = asIdx >= 0 ? p.slice(0, asIdx).trim() : p;
      if (name !== 'default') names.add(name);
    }
  }
  return Array.from(names);
}

if (!fs.existsSync(SRC_DIR)) {
  console.log('No src/ directory – nothing to scan.');
  process.exit(0);
}

const files = listJs(SRC_DIR).filter(f => {
  // Ignore highlights feature and tests and feature flags (dynamic/runtime usage)
  if (f.includes(path.sep + 'highlights' + path.sep)) return false;
  if (f.includes(path.sep + '__tests__' + path.sep)) return false;
  if (f.endsWith(path.sep + 'config' + path.sep + 'features.js')) return false;
  return true;
});
const exported = new Map(); // name -> [files]
const importedNames = new Set();

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  for (const name of extractExports(c)) {
    if (name === 'default') continue;
    if (!exported.has(name)) exported.set(name, []);
    exported.get(name).push(path.relative(process.cwd(), f));
  }
  for (const name of extractImports(c)) importedNames.add(name);
}

let dead = 0;
for (const [name, locs] of exported.entries()) {
  if (!importedNames.has(name)) {
    for (const loc of locs) {
      console.log(`DEAD ${name} @ ${loc}`);
      dead++;
    }
  }
}

if (dead === 0) {
  // Be quiet if nothing dead
}

