// Build: inline the engine, levels and Turkish content into the page, then ship the page's scripts as one
// content hashed immutable file so the HTML stays small and a reload reuses the cached script.
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read = (f) => readFile(f, 'utf8');
const [page0, game] = await Promise.all(['src/index.html', 'src/game.js'].map((f) => read(f).catch(() => '')));
if (!page0.includes('/*__CORE__*/')) { console.error('Build stopped: core placeholder missing'); process.exit(1); }
const page = page0.replace('/*__CORE__*/', () => game);
await rm('dist', { recursive: true, force: true }); await mkdir('dist', { recursive: true });
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
for (const code of scripts) { try { new Function(code); } catch (e) { console.error('Build stopped: a page script does not parse:', e.message); process.exit(1); } }
const js = scripts.join('\n;\n');
const name = `reactor-${createHash('sha256').update(js).digest('hex').slice(0, 10)}.js`;
const shipped = page.replace(/<script>[\s\S]*?<\/script>\s*/g, '').replace('</body>', `<script src="/${name}" defer></script>\n</body>`);
await writeFile('dist/index.html', shipped); await writeFile('dist/' + name, js); await copyFile('src/favicon.svg', 'dist/favicon.svg');
console.log(`built dist/index.html (${(shipped.length / 1024).toFixed(0)} KB) + ${name} (${(js.length / 1024).toFixed(0)} KB)`);
