import { readdir, readFile, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pages = [
  { file: 'index.html', id: 'home', title: 'Saker Energy · 让每一座场站，运行有数', description: '连接充电、储能与供配电的运维线索。探索 Saker Energy 的多设备关联诊断、人工检修闭环和交互式三维场站。' },
  { file: 'platform.html', id: 'platform', title: '平台能力 · Saker Energy', description: '从统一场站视图，到证据支持的候选根因，再到人工检修和复测闭环。了解 Saker Energy 的产品设计。' },
  { file: 'solutions.html', id: 'solutions', title: '应用场景 · Saker Energy', description: '面向充电站、储能站和充储一体场站，以三类典型异常理解跨设备协同运维。' },
  { file: 'technology.html', id: 'technology', title: '技术与可靠性 · Saker Energy', description: '只读接入、可恢复任务、可追溯证据和人工决策。了解 Saker Energy 的技术架构与验证路径。' },
  { file: 'experience.html', id: 'experience', title: '探索数字场站 · Saker Energy', description: '在可旋转的三维仿真场站中，体验异常发现、证据关联、候选诊断、人工反馈和复测归档。' },
  { file: 'evidence-demo.html', id: 'evidence-demo', title: '证据诊断演示 · Saker Energy', description: '回放万智平台专属员工「充储场站证据诊断助手」的真实 API 调用：证据不足不妄断、只读补证、转人工核验。' },
  { file: 'contact.html', id: 'contact', title: '规划场站试点 · Saker Energy', description: '明确站点、数据和试点目标，测算运营价值并生成一份可带走的试点需求清单。' },
  { file: 'privacy.html', id: 'privacy', title: '隐私与使用说明 · Saker Energy', description: '了解本网站的数据处理、仿真内容、下载文件以及产品阶段。' },
  { file: '404.html', id: '404', title: '页面未找到 · Saker Energy', description: '返回 Saker Energy，继续探索充储场站智能运维。' },
];
const nav = [ ['platform.html', 'platform', '平台能力'], ['solutions.html', 'solutions', '应用场景'], ['technology.html', 'technology', '技术与可靠性'], ['evidence-demo.html', 'evidence-demo', '证据诊断演示'] ];

export async function build() {
  const out = path.join(root, 'dist');
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'assets'), { recursive: true });
  const shell = await readFile(path.join(root, 'web/layout.html'), 'utf8');
  const assetDir = path.join(root, 'web/assets');
  const assetNames = (await readdir(assetDir)).filter(f => !f.startsWith('.'));
  const assets = new Map();
  for (const name of assetNames) {
    const source = await readFile(path.join(assetDir, name));
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 10);
    assets.set(name, { source, output: name.replace(/(\.[^.]+)$/, `.${hash}$1`) });
  }
  const rewrite = text => {
    for (const [name, entry] of assets) text = text.replaceAll(`assets/${name}`, `assets/${entry.output}`).replaceAll(`'./${name}'`, `'./${entry.output}'`).replaceAll(`"./${name}"`, `"./${entry.output}"`);
    return text;
  };
  for (const [name, entry] of assets) {
    const output = /\.(js|css|svg)$/.test(name) ? rewrite(entry.source.toString()) : entry.source;
    await writeFile(path.join(out, 'assets', entry.output), output);
  }
  const siteURL = (process.env.SITE_URL || 'https://saker-energy.onrender.com').replace(/\/$/, '');
  for (const page of pages) {
    const content = await readFile(path.join(root, 'web/pages', page.file), 'utf8');
    const tokens = {
      title: page.title, description: page.description, page: page.id,
      content, canonical: `${siteURL}/${page.file === 'index.html' ? '' : page.file}`,
      nav: nav.map(([href, id, label]) => `<a href="/${href}"${id === page.id ? ' aria-current="page"' : ''}>${label}</a>`).join(''),
    };
    const html = shell.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? '');
    await writeFile(path.join(out, page.file), rewrite(html));
  }
  await copyFile(path.join(root, 'web/favicon.svg'), path.join(out, 'favicon.svg'));
  await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteURL}/sitemap.xml\n`);
  await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter(p => p.id !== '404').map(p => `<url><loc>${siteURL}/${p.file === 'index.html' ? '' : p.file}</loc></url>`).join('')}</urlset>\n`);
  await writeFile(path.join(out, 'version.json'), JSON.stringify({ version: '1.0.0', commit: process.env.RENDER_GIT_COMMIT || 'local', build: new Date().toISOString() }) + '\n');
  return { pages: pages.length, assets: assets.size };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log('Built', await build());
