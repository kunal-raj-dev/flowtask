import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const graph = (keys, dynamic = false, visited = new Set()) => {
  for (const key of keys) {
    if (visited.has(key)) continue;
    visited.add(key);
    const chunk = manifest[key];
    if (chunk) graph([...(chunk.imports || []), ...(dynamic ? chunk.dynamicImports || [] : [])], dynamic, visited);
  }
  return visited;
};
const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
assert(entry, 'Build entry is missing.');
const landing = graph([entry, 'src/components/views/WelcomePage.tsx']);
const planner = graph([entry, 'src/App.tsx']);
const size = async keys => {
  let total = 0;
  for (const key of keys) if (manifest[key]?.file.endsWith('.js')) total += gzipSync(await readFile(`dist/${manifest[key].file}`)).length;
  return total;
};
const landingBytes = await size(landing), plannerBytes = await size(planner);
const cssSize = async keys => {
  const files = new Set([...keys].flatMap(key => manifest[key]?.css || []));
  assert(files.size, 'Initial CSS is missing.');
  let bytes = 0;
  for (const file of files) bytes += gzipSync(await readFile(`dist/${file}`)).length;
  return bytes;
};
const landingCssBytes = await cssSize(landing), plannerCssBytes = await cssSize(planner);
console.log(JSON.stringify({ landingJsGzip: landingBytes, plannerJsGzip: plannerBytes, landingCssGzip: landingCssBytes, plannerCssGzip: plannerCssBytes }, null, 2));
assert(landingBytes <= 180 * 1024, 'Landing JS exceeds 180 KiB gzip.');
assert(plannerBytes <= 400 * 1024, 'Planner JS exceeds 400 KiB gzip.');
assert(landingCssBytes <= 35 * 1024, 'Landing initial CSS exceeds 35 KiB gzip.');
assert(plannerCssBytes <= 35 * 1024, 'Planner initial CSS exceeds 35 KiB gzip.');
const worker = await readFile('dist/sw.js', 'utf8');
const urls = [...worker.matchAll(/url:"([^"]+)"/g)].map(match => match[1]).filter(url => !/^https?:/.test(url));
// A direct planner installation must be able to open both initial routes
// offline. Runtime caching cannot catch requests made before SW activation.
const precached = new Set(urls);
for (const key of new Set([...landing, ...planner])) {
  const chunk = manifest[key];
  if (!chunk) continue;
  for (const file of [chunk.file, ...(chunk.css || [])]) {
    assert(precached.has(file), `Initial route dependency is absent from the core precache: ${file}`);
  }
}
let precacheBytes = 0;
for (const url of urls) precacheBytes += (await readFile(`dist/${url}`)).length;
console.log(`Core precache: ${precacheBytes} bytes (${urls.length} entries).`);
assert(precacheBytes <= 1.5 * 1024 * 1024, 'Core precache exceeds 1.5 MiB.');
