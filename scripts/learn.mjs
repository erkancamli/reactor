// Crawlable study guide built from the question bank: one page per Atlas topic, in English and Turkish, plus an
// index, sitemap.xml and robots.txt. Each page lists the facts behind the questions (the explanation shown after
// an answer, and the exact line from Rialo's own post or doc that proves it), grouped by source with a link.
// It does not print the questions with their options, so the ranked Daily Block and Sprint stay a test of
// knowledge, not a lookup. Nothing here is invented: every line comes from data/questions.*.jsonl and data/sources.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export const TOPICS = {
  company: ['Rialo and Subzero Labs', 'Rialo ve Subzero Labs'], reactive: ['Reactive transactions', 'Reaktif işlemler'], edge: ['Edge and webcalls', 'Edge ve web çağrıları'],
  stream: ['Stream and Project 1337', 'Stream ve Project 1337'], stake: ['Stake for Service', 'Stake for Service'], agents: ['Agent economy', 'Ajan ekonomisi'], scale: ['SCALE', 'SCALE'],
  rwa: ['Real world assets', 'Gerçek dünya varlıkları'], privacy: ['Privacy and REX', 'Gizlilik ve REX'], markets: ['Prediction markets', 'Tahmin piyasaları'], economics: ['Economics', 'Ekonomi'],
  gauss: ['Gauss upgrades', 'Gauss yükseltmeleri'], systems: ['Distributed systems', 'Dağıtık sistemler'], devs: ['Developers and the CDK', 'Geliştiriciler ve CDK'], playground: ['Playground', 'Playground'],
};

export async function buildLearn({ site, outDir = 'dist', en, tr, sources }) {
  const today = new Date().toISOString().slice(0, 10);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const abs = (p) => site + p;
  const TR = Object.fromEntries(tr.map((q) => [q.id, q]));
  const topics = Object.keys(TOPICS).filter((k) => en.some((q) => q.topic === k));
  const urlOf = (lang, key) => (lang === 'tr' ? '/tr/learn/' : '/learn/') + (key ? key + '/' : '');
  // facts per topic, grouped by source file in bank order, one per distinct proof line
  const factsOf = (topic, lang) => {
    const groups = new Map(), seen = new Set();
    for (const q of en.filter((x) => x.topic === topic)) {
      const key = q.ev.trim().toLowerCase(); if (seen.has(key)) continue; seen.add(key);
      if (!groups.has(q.file)) groups.set(q.file, []);
      groups.get(q.file).push({ id: q.id, why: lang === 'tr' && TR[q.id] && TR[q.id].why ? TR[q.id].why : q.why, ev: q.ev });
    }
    return [...groups].map(([file, facts]) => ({ src: sources[file], facts }));
  };
  const L = {
    en: {
      other: 'tr', langName: 'Türkçe', name: (k) => TOPICS[k][0],
      idxTitle: 'Learn Rialo: the Reactor study guide',
      idxDesc: `What Rialo's own posts and docs say about reactive transactions, Stake for Service, REX privacy, real world assets, the CDK and more. ${topics.length} topics, every fact with the exact source line and a link.`,
      idxH1: 'Learn Rialo, topic by topic',
      idxLede: (n, s) => `Every Reactor question is lifted from a Rialo post, a Rialo Learn page, the Playground or the rialo-cdk docs. This guide collects the ${n} facts behind them, each with the line that proves it and a link to the source, across ${s} sources. Read a topic, then test yourself in Atlas.`,
      tTitle: (k, n) => `${TOPICS[k][0]} on Rialo: ${n} facts from Rialo's own posts`,
      tDesc: (k, n, f) => `${n} sourced facts about ${TOPICS[k][0].toLowerCase()} on Rialo, quoted from ${f}. From the Reactor study guide.`,
      tLede: (k, n, s) => `${n} facts about ${TOPICS[k][0].toLowerCase()} from ${s} Rialo ${s === 1 ? 'source' : 'sources'}. Each one is the explanation Reactor shows after a question, followed by the exact line it rests on.`,
      count: (n) => `${n} facts`, play: 'Test yourself on this topic in Atlas', playShort: 'Play Reactor', read: 'Read the source', more: 'Other topics', srcH: 'Sources',
      crumbs: ['Reactor', 'Learn Rialo'],
      fine: 'A fan made game by ecamli (@ekinoks_26), not affiliated with Rialo or Subzero Labs. Quotes belong to their sources; check the linked posts for the latest details.',
    },
    tr: {
      other: 'en', langName: 'English', name: (k) => TOPICS[k][1],
      idxTitle: "Rialo'yu öğren: Reactor çalışma rehberi",
      idxDesc: `Rialo'nun kendi yazıları ve dokümanları reaktif işlemler, Stake for Service, REX gizliliği, gerçek dünya varlıkları, CDK ve daha fazlası hakkında ne diyor. ${topics.length} konu, her bilgi kaynak cümlesi ve bağlantısıyla.`,
      idxH1: "Rialo'yu konu konu öğren",
      idxLede: (n, s) => `Reactor'daki her soru bir Rialo yazısından, Rialo Learn sayfasından, Playground'dan veya rialo-cdk dokümanlarından alındı. Bu rehber arkalarındaki ${n} bilgiyi ${s} kaynaktan topluyor; her biri onu kanıtlayan cümle ve kaynağın bağlantısıyla. Bir konuyu oku, sonra Atlas'ta kendini dene.`,
      tTitle: (k, n) => `Rialo'da ${TOPICS[k][1]}: Rialo'nun kendi yazılarından ${n} bilgi`,
      tDesc: (k, n, f) => `Rialo'da ${TOPICS[k][1]} hakkında kaynaklı ${n} bilgi, ${f} kaynaklarından alıntılarla. Reactor çalışma rehberinden.`,
      tLede: (k, n, s) => `${s} Rialo kaynağından ${TOPICS[k][1]} hakkında ${n} bilgi. Her biri Reactor'un bir sorudan sonra gösterdiği açıklama; altında dayandığı orijinal cümle (İngilizce) var.`,
      count: (n) => `${n} bilgi`, play: "Bu konuda Atlas'ta kendini dene", playShort: "Reactor'u oyna", read: 'Kaynağı oku', more: 'Diğer konular', srcH: 'Kaynaklar',
      crumbs: ['Reactor', "Rialo'yu öğren"],
      fine: "ecamli (@ekinoks_26) tarafından yapılan bir hayran oyunu, Rialo veya Subzero Labs ile bağı yoktur. Alıntılar kaynaklarına aittir; en güncel ayrıntılar için bağlantılı yazılara bak.",
    },
  };

  const css = `.wrap{max-width:720px;margin:0 auto;padding:16px 16px 48px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;font-weight:600}header a{color:var(--paper);text-decoration:none}
.brand{font-family:var(--mono);letter-spacing:.04em}nav.crumbs{font-size:13px;color:var(--mute);margin:22px 0 8px}nav.crumbs a{color:var(--mute)}
h1{font-size:clamp(26px,6vw,38px);line-height:1.12;margin:4px 0 14px}h2{font-size:19px;line-height:1.3;margin:0 0 10px}
.lede{color:var(--mute);font-size:17px;line-height:1.55}.meta{font-family:var(--mono);font-size:12px;color:var(--mute);letter-spacing:.03em;text-transform:uppercase}
.cta{display:inline-block;margin:18px 0 26px;padding:12px 18px;border-radius:var(--r);background:var(--paper);color:var(--ink);font-weight:600;text-decoration:none}
.src{background:var(--slab);border:1px solid var(--rail);border-radius:var(--r);padding:16px 18px;margin:14px 0}
.src h2 a{color:var(--paper);text-decoration-color:var(--faint);text-underline-offset:3px}
.fact{border-top:1px solid var(--rail);padding:12px 0 2px}.fact:first-of-type{border-top:0;padding-top:4px}.fact p{margin:0 0 8px;line-height:1.55}
blockquote{margin:0 0 10px;padding:2px 0 2px 12px;border-left:2px solid var(--glacier);color:var(--mute);font-size:15px;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;padding:0;margin:0;list-style:none}
.grid a{display:block;height:100%;background:var(--slab);border:1px solid var(--rail);border-radius:var(--r);padding:14px 16px;color:var(--paper);text-decoration:none}
.grid a:hover{border-color:var(--glacier)}.grid h2{font-size:17px;margin:6px 0 0}
.list{padding-left:18px;line-height:1.7}.list a{color:var(--paper)}h3{font-size:15px;margin:26px 0 6px;color:var(--mute)}
footer{color:var(--mute);font-size:13px;line-height:1.55;border-top:1px solid var(--rail);margin-top:34px;padding-top:18px}footer a{color:var(--mute)}`;

  const page = ({ lang, path, alt, title, desc, body, jsonld }) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
<link rel="alternate" hreflang="${lang}" href="${abs(path)}">
<link rel="alternate" hreflang="${L[lang].other}" href="${abs(alt)}">
<link rel="alternate" hreflang="x-default" href="${abs(lang === 'en' ? path : alt)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Reactor">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${abs('/og.png')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${abs('/og.png')}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script src="/theme.js"></script>
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/learn.css">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<div class="wrap">
<header><a class="brand" href="/">REACTOR</a><a href="${alt}" hreflang="${L[lang].other}">${L[lang].langName}</a></header>
<main>
${body}
</main>
<footer>${esc(L[lang].fine)} <a href="${urlOf(lang)}">${esc(L[lang].crumbs[1])}</a> · <a href="${play(lang)}">${esc(L[lang].playShort)}</a> · <a href="https://www.rialo.io" rel="noopener">rialo.io</a></footer>
</div>
</body>
</html>
`;
  const crumbLd = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })) });
  const play = (lang, key) => { const p = [lang === 'tr' && 'lang=tr', key && 'atlas=' + key].filter(Boolean); return '/' + (p.length ? '?' + p.join('&amp;') : ''); };

  // the shared stylesheet: the game's own colour tokens (both themes) plus the guide layout
  const index = await readFile('src/index.html', 'utf8');
  const tokens = index.match(/:root\{[\s\S]*?\n\}\n:root\[data-theme="light"\]\{[\s\S]*?\n\}/);
  if (!tokens) throw new Error('learn: colour tokens not found in src/index.html');
  await writeFile(outDir + '/learn.css', `${tokens[0]}\n*{box-sizing:border-box}html{background:var(--ink);color:var(--paper);font-family:var(--sans);-webkit-text-size-adjust:100%}body{margin:0;background:var(--ink)}a{color:var(--glacier)}\n${css}\n`);

  const sitemap = []; let factTotal = 0;
  for (const lang of ['en', 'tr']) {
    const T = L[lang];
    const all = topics.map((k) => ({ k, groups: factsOf(k, lang) }));
    const nFacts = (g) => g.reduce((a, x) => a + x.facts.length, 0);
    const total = all.reduce((a, x) => a + nFacts(x.groups), 0); factTotal = total;
    const usedSrc = [...new Set(en.map((q) => q.file))].map((f) => sources[f]);
    // index
    const cards = all.map(({ k, groups }) => `<li><a href="${urlOf(lang, k)}"><span class="meta">${esc(T.count(nFacts(groups)))}</span><h2>${esc(T.name(k))}</h2></a></li>`).join('\n');
    const srcList = usedSrc.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></li>`).join('');
    const idxPath = urlOf(lang), idxAlt = urlOf(T.other);
    await mkdir(outDir + idxPath, { recursive: true });
    await writeFile(outDir + idxPath + 'index.html', page({
      lang, path: idxPath, alt: idxAlt, title: T.idxTitle, desc: T.idxDesc,
      body: `<nav class="crumbs"><a href="/">${esc(T.crumbs[0])}</a> › ${esc(T.crumbs[1])}</nav>\n<h1>${esc(T.idxH1)}</h1>\n<p class="lede">${esc(T.idxLede(total, usedSrc.length))}</p>\n<a class="cta" href="${play(lang)}">${esc(T.playShort)}</a>\n<ul class="grid">${cards}</ul>\n<h3>${esc(T.srcH)}</h3><ul class="list">${srcList}</ul>`,
      jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: T.idxTitle, description: T.idxDesc, url: abs(idxPath), inLanguage: lang, isPartOf: { '@type': 'WebSite', name: 'Reactor', url: abs('/') }, about: { '@type': 'Thing', name: 'Rialo', url: 'https://www.rialo.io' }, hasPart: all.map(({ k }) => ({ '@type': 'WebPage', name: T.name(k), url: abs(urlOf(lang, k)) })) }, crumbLd([[T.crumbs[0], '/'], [T.crumbs[1], idxPath]])] },
    }));
    if (lang === 'en') sitemap.push({ en: urlOf('en'), tr: urlOf('tr'), pri: '0.8' });
    // one page per topic
    for (const { k, groups } of all) {
      const path = urlOf(lang, k), alt = urlOf(T.other, k), n = nFacts(groups);
      const blocks = groups.map(({ src, facts }) => `<section class="src"><h2><a href="${esc(src.url)}" rel="noopener">${esc(src.title)}</a></h2>\n${facts.map((f) => `<div class="fact" id="${esc(f.id)}"><p>${esc(f.why)}</p><blockquote lang="en">“${esc(f.ev)}”</blockquote></div>`).join('\n')}</section>`).join('\n');
      const others = topics.filter((x) => x !== k).map((x) => `<li><a href="${urlOf(lang, x)}">${esc(T.name(x))}</a></li>`).join('');
      const firstSrc = groups.map((g) => g.src.title).slice(0, 2).join('; ');
      await mkdir(outDir + path, { recursive: true });
      await writeFile(outDir + path + 'index.html', page({
        lang, path, alt, title: T.tTitle(k, n) + ' | Reactor', desc: T.tDesc(k, n, firstSrc).slice(0, 300),
        body: `<nav class="crumbs"><a href="/">${esc(T.crumbs[0])}</a> › <a href="${urlOf(lang)}">${esc(T.crumbs[1])}</a> › ${esc(T.name(k))}</nav>\n<p class="meta">${esc(T.count(n))}</p>\n<h1>${esc(T.name(k))}</h1>\n<p class="lede">${esc(T.tLede(k, n, groups.length))}</p>\n<a class="cta" href="${play(lang, k)}">${esc(T.play)}</a>\n${blocks}\n<h3>${esc(T.more)}</h3><ul class="list">${others}</ul>`,
        jsonld: { '@context': 'https://schema.org', '@graph': [
          { '@type': 'Article', headline: T.tTitle(k, n), url: abs(path), inLanguage: lang, dateModified: today, author: { '@type': 'Person', name: 'ecamli', url: 'https://x.com/ekinoks_26' }, about: { '@type': 'Thing', name: TOPICS[k][0] }, isPartOf: { '@type': 'WebSite', name: 'Reactor', url: abs('/') }, citation: groups.map((g) => ({ '@type': 'CreativeWork', name: g.src.title, url: g.src.url })) },
          crumbLd([[T.crumbs[0], '/'], [T.crumbs[1], urlOf(lang)], [T.name(k), path]]),
        ] },
      }));
      if (lang === 'en') sitemap.push({ en: urlOf('en', k), tr: urlOf('tr', k), pri: '0.7' });
    }
  }
  const urlXml = (loc, alts, pri) => `<url><loc>${abs(loc)}</loc><lastmod>${today}</lastmod><priority>${pri}</priority>${alts.map(([l, p]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(p)}"/>`).join('')}</url>`;
  const entries = [urlXml('/', [], '1.0')];
  for (const e of sitemap) for (const lang of ['en', 'tr']) entries.push(urlXml(e[lang], [['en', e.en], ['tr', e.tr], ['x-default', e.en]], e.pri));
  await writeFile(outDir + '/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);
  await writeFile(outDir + '/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${abs('/sitemap.xml')}\n`);
  return { pages: 2 + topics.length * 2, urls: entries.length, facts: factTotal };
}
