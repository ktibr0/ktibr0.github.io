#!/usr/bin/env node
'use strict';

// Rebuild the locally hosted ArcoMage HD distribution from the pinned saved
// output. This intentionally does not alter the upstream game logic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const GAME = path.join(REPO, 'arcomage-hd');
const INPUT = path.join(GAME, 'dist');
const BASE = '/arcomage-hd/';
const EXPECTED_INPUT_TREE_SHA256 = '0421223b617ddf5fed9ffe179ea6ad6244b8bba792312f41d1c182e13ae463dc';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function filesBelow(directory) {
  const result = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(absolute);
      else throw new Error(`Unsupported input entry: ${absolute}`);
    }
  }
  visit(directory);
  return result;
}

function relativeUnix(file, parent) {
  return path.relative(parent, file).split(path.sep).join('/');
}

function inputSnapshot() {
  if (!fs.statSync(INPUT).isDirectory()) throw new Error(`Missing source distribution: ${INPUT}`);
  const rows = filesBelow(INPUT).map((file) => {
    const relative = relativeUnix(file, INPUT);
    const hash = sha256(fs.readFileSync(file));
    return { path: relative, sha256: hash };
  });
  const treeHash = sha256(rows.map(({ path: file, sha256: hash }) => `${file}\0${hash}`).sort().join('\n'));
  if (treeHash !== EXPECTED_INPUT_TREE_SHA256) {
    throw new Error(`Saved distribution changed: expected ${EXPECTED_INPUT_TREE_SHA256}, got ${treeHash}`);
  }
  return { rows, treeHash };
}

function copyDistribution(rows) {
  for (const { path: relative } of rows) {
    const source = path.join(INPUT, ...relative.split('/'));
    const destination = path.join(GAME, ...relative.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function rewriteUtf8File(relative, transform) {
  const file = path.join(GAME, ...relative.split('/'));
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  fs.writeFileSync(file, after, 'utf8');
}

function rewriteTextAssets(rows) {
  const textExtensions = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);
  for (const { path: relative } of rows) {
    if (!textExtensions.has(path.extname(relative).toLowerCase())) continue;
    rewriteUtf8File(relative, (text) => text.replaceAll('/assets/', `${BASE}assets/`));
  }

  const index = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  const substitutions = [
    [/href="https:\/\/arcomage\.github\.io\/"/g, 'href="https://ktibr0.github.io/arcomage-hd/"'],
    [/href="https:\/\/arcomage\.github\.io\/favicon\.svg"/g, `href="${BASE}favicon.svg"`],
    [/href="https:\/\/arcomage\.github\.io\/favicon\.ico"/g, `href="${BASE}favicon.ico"`],
    [/content="https:\/\/arcomage\.github\.io\/"/g, 'content="https://ktibr0.github.io/arcomage-hd/"'],
    [/content="https:\/\/arcomage\.github\.io\/ogimage\.jpg"/g, 'content="https://ktibr0.github.io/arcomage-hd/ogimage.jpg"'],
    [/href="\/manifest\.webmanifest"/g, `href="${BASE}manifest.webmanifest"`],
    [/src="\/registerSW\.js"/g, `src="${BASE}registerSW.js"`],
  ];
  let updated = index;
  for (const [pattern, replacement] of substitutions) updated = updated.replace(pattern, replacement);
  if (updated === index || !updated.includes(`${BASE}assets/index-KFx7dIeg.js`)) {
    throw new Error('Expected HTML paths/metadata were not found; refusing to adapt an unknown build.');
  }
  if (updated.includes('https://arcomage.github.io/')) {
    throw new Error('An upstream origin remains in the HTML document metadata.');
  }
  fs.writeFileSync(path.join(GAME, 'index.html'), updated, 'utf8');

  const mainScript = 'assets/index-KFx7dIeg.js';
  rewriteUtf8File(mainScript, (text) => {
    const substitutions = [
      [
        'const _i=new(window.AudioContext||window.webkitAudioContext)',
        'const _i=(()=>{const Context=window.AudioContext||window.webkitAudioContext;try{return Context?new Context:null}catch{return null}})()',
        'Web Audio context creation',
      ],
      [
        'xi=()=>{"suspended"===_i.state?_i.resume().then(()=>{wi()}):wi()}',
        'xi=()=>{_i&&"suspended"===_i.state?_i.resume().then(()=>{wi()}):wi()}',
        'Web Audio gesture handler',
      ],
      [
        'const vi=_i.createGain();vi.gain.value=.5,vi.connect(_i.destination);',
        'const vi=_i?_i.createGain():{gain:{value:.5},connect(){}};vi.gain.value=.5,_i&&vi.connect(_i.destination);',
        'Web Audio gain node',
      ],
      [
        'Ai=async e=>{const t=await fetch(e),n=await t.arrayBuffer();return await _i.decodeAudioData(n)}',
        'Ai=async e=>{if(!_i)return null;const t=await fetch(e),n=await t.arrayBuffer();return await _i.decodeAudioData(n)}',
        'Web Audio decoder',
      ],
      [
        'Hi[r].then(e=>{if("suspended"===_i.state)_i.resume();else if("running"===_i.state){',
        'Hi[r].then(e=>{if(!_i||!e)return;if("suspended"===_i.state)_i.resume();else if("running"===_i.state){',
        'Web Audio playback callback',
      ],
    ];
    let updated = text;
    for (const [before, after, label] of substitutions) {
      const count = updated.split(before).length - 1;
      if (count !== 1) throw new Error(`Expected one ${label} pattern, found ${count}.`);
      updated = updated.replace(before, after);
    }

    const helper = 'return"/"+e';
    const count = updated.split(helper).length - 1;
    if (count !== 1) throw new Error(`Expected one Vite preload root helper, found ${count}.`);
    return updated.replace(helper, `return"${BASE}"+e`);
  });

  fs.writeFileSync(path.join(GAME, 'registerSW.js'),
    `if ('serviceWorker' in navigator) {\n` +
    `  window.addEventListener('load', () => {\n` +
      `    navigator.serviceWorker.register('${BASE}sw.js', { scope: '${BASE}' })\n` +
    `      .catch((error) => console.error('ArcoMage service worker registration failed:', error));\n` +
    `  });\n` +
    `}\n`, 'utf8');
}

function buildWorker(runtimeRows) {
  const precache = [...runtimeRows.map(({ path: relative }) => `${BASE}${relative}`), BASE];
  const runtimeContent = runtimeRows.map(({ path: relative }) => {
    const file = path.join(GAME, ...relative.split('/'));
    return `${relative}\0${sha256(fs.readFileSync(file))}`;
  });
  const template = `/* Generated by tools/arcomage-adapt.cjs. */
const BASE = '${BASE}';
const CACHE = 'gamecenter-arcomage-__CACHE_VERSION__';
const PRECACHE = ${JSON.stringify(precache)};
const INDEX = BASE + 'index.html';
const KNOWN = new Set(PRECACHE);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('gamecenter-arcomage-') && key !== CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const home = url.pathname === BASE || url.pathname === INDEX;
  if (!home && !KNOWN.has(url.pathname)) return;

  event.respondWith((async () => {
    const cacheKey = url.pathname === BASE ? INDEX : request;
    const cached = await caches.match(cacheKey, { cacheName: CACHE });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      return response;
    } catch (error) {
      if (request.mode === 'navigate' && home) {
        const fallback = await caches.match(INDEX, { cacheName: CACHE });
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
`;
  const version = sha256(Buffer.from(`${runtimeContent.join('\n')}\n${template}`)).slice(0, 20);
  fs.writeFileSync(path.join(GAME, 'sw.js'), template.replace('__CACHE_VERSION__', version), 'utf8');
  return { version, precache };
}

function writeManifest(input, worker, copiedRows) {
  const rowsWithCredit = [...copiedRows, { path: 'CREDIT.md' }];
  const outputs = rowsWithCredit.map(({ path: relative }) => ({
    path: relative,
    ...(() => {
      const content = fs.readFileSync(path.join(GAME, ...relative.split('/')));
      const textExtensions = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt', '.md']);
      const isText = textExtensions.has(path.extname(relative).toLowerCase());
      const published = isText ? Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : content;
      return { sha256: sha256(content), publishedSha256: sha256(published) };
    })(),
  }));
  const runtimeRows = outputs.filter(({ path: relative }) => relative !== 'sw.js');
  const outputTreeSha256 = sha256(outputs.map(({ path: file, sha256: hash }) => `${file}\0${hash}`).sort().join('\n'));
  const manifest = {
    format: 1,
    game: 'ArcoMage HD',
    gameVersion: '2.0.3',
    source: {
      repository: 'https://github.com/arcomage/arcomage-hd',
      originalGameCenterCommit: '9fbe12197e53734b43a5917c598e6aaf043beafa',
      upstreamTagCandidate: 'v2.0.3',
      upstreamTagObject: '604587133cc61c6af0f88314ad42bad930d070df',
      upstreamTagCommit: 'efa3ea4120ce2aef4625c50d492a733cf3afbbf7',
      exactBuildMatchVerified: false,
      inputDirectory: 'arcomage-hd/dist/',
      inputFileCount: input.rows.length,
      inputTreeSha256: input.treeHash,
      inputFiles: input.rows,
    },
    adaptation: {
      basePath: BASE,
      outputFileCount: outputs.length,
      outputTreeSha256,
      serviceWorkerCache: `gamecenter-arcomage-${worker.version}`,
      precacheEntryCount: worker.precache.length,
      outputFiles: outputs,
    },
    notices: {
      creditsFileExpected: 'CREDIT.md (provided separately from pinned upstream source)',
      licenseFile: 'LICENSES.txt',
      resourceTermsReviewed: true,
      resourceTermsSource: 'CREDIT.md',
      resourceTermsNotes: 'Upstream notices are preserved; the MIT code license does not change the terms of game media.',
    },
  };
  fs.writeFileSync(path.join(GAME, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { outputTreeSha256, runtimeCount: runtimeRows.length };
}

function main() {
  const input = inputSnapshot();
  copyDistribution(input.rows);
  rewriteTextAssets(input.rows);
  const workerRows = [...input.rows.filter(({ path: relative }) => relative !== 'sw.js'), { path: 'CREDIT.md' }];
  const worker = buildWorker(workerRows);
  const written = writeManifest(input, worker, input.rows);
  console.log(`Adapted ${input.rows.length} files from arcomage-hd/dist/`);
  console.log(`Input tree SHA-256: ${input.treeHash}`);
  console.log(`Output tree SHA-256: ${written.outputTreeSha256}`);
  console.log(`Service worker cache: gamecenter-arcomage-${worker.version} (${worker.precache.length} entries)`);
}

main();
