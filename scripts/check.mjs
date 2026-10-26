import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const issues = [];
const report = message => issues.push(message);
const relative = file => path.relative(root, file).split(path.sep).join('/');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push(file);
    else report(`${relative(file)}: unexpected symbolic link or non-regular file`);
  }
  return files;
}

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[lower] ?? match;
  });
}

function tagsIn(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [];
  const tagPattern = /<([a-z][a-z0-9:-]*)(\s+(?:"[^"]*"|'[^']*'|[^'">])*)?\s*\/?>/gi;
  for (const match of clean.matchAll(tagPattern)) {
    const attrs = new Map();
    const attrPattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const attr of (match[2] || '').matchAll(attrPattern)) {
      attrs.set(attr[1].toLowerCase(), decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? ''));
    }
    tags.push({ name: match[1].toLowerCase(), attrs });
  }
  return tags;
}

async function existingFile(file) {
  try { return (await stat(file)).isFile(); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

function insideDist(file) {
  const rel = path.relative(dist, file);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function check() {
  const sourceFiles = [
    ...await walk(path.join(root, 'scripts')),
    ...await walk(path.join(root, 'web/assets')),
  ].filter(file => /\.(m?js)$/.test(file));
  for (const file of sourceFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      report(`${relative(file)}: JavaScript syntax failed\n${result.error?.message || result.stderr || result.stdout}`);
    }
  }
  if (issues.length) return;

  // Load only after syntax checks, then verify the actual deployable output.
  const { build, pages } = await import('./build.mjs');
  const built = await build();
  const expectedPages = new Set([
    'index.html', 'platform.html', 'solutions.html', 'technology.html',
    'experience.html', 'contact.html', 'privacy.html', '404.html',
  ]);
  if (pages.length !== expectedPages.size || new Set(pages.map(page => page.file)).size !== expectedPages.size || pages.some(page => !expectedPages.has(page.file))) {
    report('The website must build the eight expected HTML pages exactly once.');
  }
  const allFiles = await walk(dist);
  const htmlFiles = allFiles.filter(file => file.endsWith('.html'));
  if (htmlFiles.length !== expectedPages.size) report(`Expected eight built HTML pages; found ${htmlFiles.length}.`);

  const documents = new Map();
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const tags = tagsIn(html);
    const ids = new Set();
    for (const { attrs } of tags) {
      if (!attrs.has('id')) continue;
      const id = attrs.get('id');
      if (!id) report(`${relative(file)}: empty id attribute`);
      else if (ids.has(id)) report(`${relative(file)}: duplicate id "${id}"`);
      ids.add(id);
    }
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    if (!title) report(`${relative(file)}: missing or empty title`);
    const description = tags.find(tag => tag.name === 'meta' && tag.attrs.get('name')?.toLowerCase() === 'description');
    if (!description?.attrs.get('content')?.trim()) report(`${relative(file)}: missing or empty meta description`);
    if (/\{\{[\s\S]*?\}\}/.test(html)) report(`${relative(file)}: unresolved template token`);
    for (const { attrs } of tags) {
      if (!attrs.has('aria-controls')) continue;
      const controls = attrs.get('aria-controls').trim().split(/\s+/).filter(Boolean);
      if (!controls.length) report(`${relative(file)}: empty aria-controls`);
      for (const id of controls) if (!ids.has(id)) report(`${relative(file)}: aria-controls target "${id}" does not exist`);
    }
    documents.set(file, { html, tags, ids });
  }

  let checkedLinks = 0;
  for (const [file, document] of documents) {
    const pagePath = '/' + path.relative(dist, file).split(path.sep).join('/');
    for (const { attrs } of document.tags) {
      for (const attr of ['href', 'src']) {
        if (!attrs.has(attr)) continue;
        const value = attrs.get(attr).trim();
        if (!value) { report(`${relative(file)}: empty ${attr}`); continue; }
        if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) continue;
        let parsed;
        let pathname;
        let fragment;
        try {
          parsed = new URL(value, `https://static.invalid${pagePath}`);
          pathname = decodeURIComponent(parsed.pathname);
          fragment = decodeURIComponent(parsed.hash.slice(1));
        } catch {
          report(`${relative(file)}: invalid local ${attr} "${value}"`);
          continue;
        }
        if (pathname.endsWith('/')) pathname += 'index.html';
        const target = path.resolve(dist, `.${pathname}`);
        if (!insideDist(target)) { report(`${relative(file)}: local URL escapes dist: ${value}`); continue; }
        checkedLinks++;
        if (!await existingFile(target)) {
          report(`${relative(file)}: missing local ${attr} target "${value}"`);
          continue;
        }
        if (fragment && /\.html$/i.test(target)) {
          const targetDoc = documents.get(target);
          if (!targetDoc?.ids.has(fragment)) report(`${relative(file)}: missing anchor "${value}"`);
        }
      }
    }
  }

  const allowedRootFiles = new Set([...expectedPages, 'favicon.svg', 'robots.txt', 'sitemap.xml', 'version.json']);
  for (const file of allFiles) {
    const name = path.relative(dist, file).split(path.sep).join('/');
    if (!name.startsWith('assets/') && !allowedRootFiles.has(name)) report(`Unexpected deploy file: ${name}`);
    if (name.split('/').some(part => /^(docs?|source|src|scripts|tests?|data|web|node_modules|\.git)$/i.test(part))) {
      report(`Internal source or data directory leaked into dist: ${name}`);
    }
    if (/(^|\/)[.]|\.(md|csv|ya?ml|toml|env|log|map)$/i.test(name)) report(`Internal or source artifact leaked into dist: ${name}`);
  }

  let checkedImports = 0;
  for (const file of allFiles.filter(item => /\.(m?js)$/.test(item) && path.relative(dist, item).startsWith(`assets${path.sep}`))) {
    const source = await readFile(file, 'utf8');
    // Browser modules use literal static imports; include re-exports and literal
    // dynamic imports so a new dependency cannot silently ship with a broken URL.
    const specifiers = new Set();
    const patterns = [
      /\b(?:import|export)\s+(?:[\w*$\s{},]+)\s+from\s*['"]([^'"]+)['"]/g,
      /\bimport\s*['"]([^'"]+)['"]/g,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const target = path.resolve(path.dirname(file), specifier.split(/[?#]/)[0]);
      checkedImports++;
      if (!insideDist(target) || !await existingFile(target)) report(`${relative(file)}: unresolved relative module import "${specifier}"`);
    }
  }
  if (!issues.length) {
    console.log(`Website checks passed: ${sourceFiles.length} JavaScript files, ${built.pages} HTML pages, ${built.assets} assets, ${checkedLinks} local references, ${checkedImports} module imports.`);
  }
}

try { await check(); }
catch (error) { report(error.stack || String(error)); }
if (issues.length) {
  console.error(`Website checks failed (${issues.length}):\n${issues.map(issue => `- ${issue}`).join('\n')}`);
  process.exitCode = 1;
}
