// Reactor page: home, Daily Block (refereed by the server), Sprint and Atlas (played locally with the bank).
// The rules module is inlined above this file by the build, so permFor, publicView, isCorrect, points
// and friends are in scope.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('rx.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('rx.' + k, JSON.stringify(v)); } catch {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
  const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  let lang = LS.get('lang', (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');

  // ---------- strings ----------
  const T = {
    en: {
      'home.title': 'Twelve questions. One block a day.',
      'home.sub': "Every question comes from Rialo's own posts and docs. Stake your points, call the source, filter the noise.",
      'mode.daily': 'Daily Block', 'mode.sprint': 'Sprint', 'mode.atlas': 'Atlas',
      'daily.new': 'Block #{n}. Same twelve questions for everyone, one run per name.',
      'daily.progress': 'Block #{n} in progress, question {i} of {total}.',
      'daily.done': 'Block #{n} finalized: {score} points, {ok} of {total} right.',
      'daily.noname': 'Block #{n}. Save a player name to start, the board needs it.',
      'daily.play': 'Play', 'daily.resume': 'Resume', 'daily.see': 'Result',
      'sprint.sub': 'Ninety seconds, as many questions as you can. Best so far: {best}.', 'sprint.sub0': 'Ninety seconds, as many questions as you can. No name needed.',
      'atlas.sub.home': 'Study by topic, no clock, every answer with its source. {n} of {total} questions mastered.',
      'board.title': 'Leaderboard', 'board.today': 'Today', 'board.week': 'This week', 'board.all': 'All time',
      'board.empty.today': 'Nobody has finalized today\'s block yet. Be the first.', 'board.empty.week': 'The week board fills as blocks are finalized.', 'board.empty.all': 'No scores yet.',
      'board.err': 'The board is not reachable right now.',
      'rank.line': 'You are a <b>{rank}</b> with {total} points.', 'rank.next': ' {left} more to {next}.',
      'name.title': 'Pick your player name', 'name.sub': 'The Daily Block is one run per name per day, so the board needs to know who you are. Your name is kept on this device, no login.',
      'name.save': 'Save name', 'cancel': 'Cancel', 'name.saving': 'Saving…', 'name.err.net': 'Could not reach the server. Try again.',
      'name.set': 'Set a name',
      'kind.mcq': 'Pick one', 'kind.fill': 'Fill the blank', 'kind.noise': 'Signal or noise?', 'kind.order': 'Put these in order', 'kind.source': 'Which post says this?',
      'signal': 'Signal', 'noise': 'Noise', 'order.submit': 'Lock this order', 'order.hint': 'Tap the steps in the order they happen. Tap again to undo.',
      'life.webcall': 'Webcall', 'life.filter': 'Filter', 'life.handover': 'Handover',
      'life.webcall.hint': 'The source line is on screen. This question pays half.', 'life.filter.hint': 'Two wrong options filtered out.', 'life.filter.no': 'The filter only works on questions with options.',
      'stake.hint': 'Stake 2x doubles the points and costs 100 if wrong. 3x triples and costs 300.',
      'next': 'Next', 'finish': 'Finalize block', 'v.ok': 'Landed', 'v.x': 'Noise', 'v.timeout': 'Out of time', 'v.skip': 'Handed over', 'v.correctwas': 'Correct answer: ',
      'play.daily': 'Daily Block #{n}', 'play.sprint': 'Sprint', 'play.atlas': 'Atlas: {topic}', 'q.of': '{i} of {n}',
      'res.daily.title': 'Block #{n} finalized', 'res.daily.sub': '{ok} of {n} landed. Your score is on the board.', 'res.daily.sub.nr': '{ok} of {n} landed.',
      'res.sprint.title': 'Sprint over', 'res.sprint.sub': '{answered} questions in 90 seconds, {ok} right.', 'res.sprint.best': 'New best!',
      'res.atlas.title': 'Topic round done', 'res.atlas.sub': '{ok} of {n} right. Mastery in {topic}: {pct}%.',
      'st.score': 'points', 'st.streak': 'best streak', 'st.time': 'answer time', 'st.rank': 'rank today', 'st.answered': 'answered', 'st.correct': 'right',
      'share.x': 'Share on X', 'share.copy': 'Copy result', 'copied': 'Copied', 'home': 'Home', 'again': 'Play again', 'atlas.more': 'Another topic',
      'review': 'Review', 'source': 'Source', 'rank.today': 'Rank today: <b>#{rank}</b>. Total {total} points, you are a <b>{title}</b>.',
      'atlas.title': 'Atlas', 'atlas.sub': 'Pick a topic. Ten questions, no clock, every answer explained with its source. Mastery counts the questions you have answered right at least once.',
      'topic.count': '{m} of {n}',
      'err.generic': 'Something went wrong. Reload and try again.', 'err.step': 'Out of step with the server. Reloading…', 'bank.loading': 'Loading questions…',
      'how': 'How to play', 'foot': 'A fan made game by <a href="https://x.com/ekinoks_26" target="_blank" rel="noopener">ecamli</a>, not affiliated with Rialo or Subzero Labs. Every question is tied to a line in a <a href="https://www.rialo.io/blog" target="_blank" rel="noopener">rialo.io</a> post, <a href="https://learn.rialo.io" target="_blank" rel="noopener">Rialo Learn</a>, the <a href="https://playground.rialo.io" target="_blank" rel="noopener">Playground</a> or the rialo-cdk docs. <a href="https://github.com/erkancamli/reactor" target="_blank" rel="noopener">Source on GitHub</a>.',
      'sprint.time': '{s}s left', 'sprint.go': 'Go', 'sprint.intro': 'Ninety seconds on the clock. Right answers pay by difficulty and speed, a wrong one costs 50 and your streak. Tap to start.',
      'share.text': 'Reactor Daily Block #{n}\n{line}\n{ok}/{total} landed, {score} points\n{url}',
      'share.sprint': 'Reactor Sprint: {score} points, {ok}/{answered} right in 90 seconds\n{url}',
    },
    tr: {
      'home.title': 'On iki soru. Günde bir blok.',
      'home.sub': "Her soru Rialo'nun kendi yazılarından ve dokümanlarından geliyor. Puanını stake et, kaynağı çağır, gürültüyü filtrele.",
      'mode.daily': 'Günün Bloğu', 'mode.sprint': 'Sprint', 'mode.atlas': 'Atlas',
      'daily.new': 'Blok #{n}. Herkese aynı on iki soru, her isme bir hak.',
      'daily.progress': 'Blok #{n} devam ediyor, {total} sorudan {i}. sırada.',
      'daily.done': 'Blok #{n} tamamlandı: {score} puan, {total} sorudan {ok} doğru.',
      'daily.noname': 'Blok #{n}. Başlamak için bir oyuncu adı kaydet, tablo buna ihtiyaç duyuyor.',
      'daily.play': 'Oyna', 'daily.resume': 'Devam et', 'daily.see': 'Sonuç',
      'sprint.sub': 'Doksan saniyede yetiştiğin kadar soru. En iyin: {best}.', 'sprint.sub0': 'Doksan saniyede yetiştiğin kadar soru. İsim gerekmez.',
      'atlas.sub.home': 'Konu konu çalış, süre yok, her cevabın kaynağı var. {total} sorudan {n} tanesini öğrendin.',
      'board.title': 'Liderlik tablosu', 'board.today': 'Bugün', 'board.week': 'Bu hafta', 'board.all': 'Tüm zamanlar',
      'board.empty.today': 'Bugünün bloğunu henüz kimse tamamlamadı. İlk sen ol.', 'board.empty.week': 'Haftalık tablo bloklar tamamlandıkça dolar.', 'board.empty.all': 'Henüz skor yok.',
      'board.err': 'Tabloya şu an ulaşılamıyor.',
      'rank.line': '<b>{rank}</b> seviyesindesin, {total} puan.', 'rank.next': ' {next} için {left} puan kaldı.',
      'name.title': 'Oyuncu adını seç', 'name.sub': 'Günün Bloğu her isme günde bir hak, tablo seni tanımalı. Adın bu cihazda saklanır, giriş yapmak gerekmez.',
      'name.save': 'Adı kaydet', 'cancel': 'Vazgeç', 'name.saving': 'Kaydediliyor…', 'name.err.net': 'Sunucuya ulaşılamadı. Tekrar dene.',
      'name.set': 'İsim seç',
      'kind.mcq': 'Birini seç', 'kind.fill': 'Boşluğu doldur', 'kind.noise': 'Sinyal mi gürültü mü?', 'kind.order': 'Sıraya koy', 'kind.source': 'Bu cümle hangi yazıdan?',
      'signal': 'Sinyal', 'noise': 'Gürültü', 'order.submit': 'Sırayı onayla', 'order.hint': 'Adımlara olma sırasıyla dokun. Geri almak için tekrar dokun.',
      'life.webcall': 'Webcall', 'life.filter': 'Filtre', 'life.handover': 'Devir',
      'life.webcall.hint': 'Kaynak cümle ekranda. Bu soru yarım puan verir.', 'life.filter.hint': 'İki yanlış şık elendi.', 'life.filter.no': 'Filtre sadece şıklı sorularda çalışır.',
      'stake.hint': '2x puanı ikiye katlar, yanlışta 100 götürür. 3x üçe katlar, yanlışta 300 götürür.',
      'next': 'Sonraki', 'finish': 'Bloğu tamamla', 'v.ok': 'Yerine ulaştı', 'v.x': 'Gürültü', 'v.timeout': 'Süre bitti', 'v.skip': 'Devredildi', 'v.correctwas': 'Doğru cevap: ',
      'play.daily': 'Günün Bloğu #{n}', 'play.sprint': 'Sprint', 'play.atlas': 'Atlas: {topic}', 'q.of': '{i} / {n}',
      'res.daily.title': 'Blok #{n} tamamlandı', 'res.daily.sub': '{n} sorudan {ok} tanesi yerine ulaştı. Skorun tabloda.', 'res.daily.sub.nr': '{n} sorudan {ok} tanesi yerine ulaştı.',
      'res.sprint.title': 'Sprint bitti', 'res.sprint.sub': '90 saniyede {answered} soru, {ok} doğru.', 'res.sprint.best': 'Yeni rekor!',
      'res.atlas.title': 'Konu turu bitti', 'res.atlas.sub': '{n} sorudan {ok} doğru. {topic} ustalığı: %{pct}.',
      'st.score': 'puan', 'st.streak': 'en iyi seri', 'st.time': 'cevap süresi', 'st.rank': 'bugünkü sıra', 'st.answered': 'cevaplanan', 'st.correct': 'doğru',
      'share.x': "X'te paylaş", 'share.copy': 'Sonucu kopyala', 'copied': 'Kopyalandı', 'home': 'Ana sayfa', 'again': 'Tekrar oyna', 'atlas.more': 'Başka konu',
      'review': 'Gözden geçir', 'source': 'Kaynak', 'rank.today': 'Bugünkü sıran: <b>#{rank}</b>. Toplam {total} puan, seviyen <b>{title}</b>.',
      'atlas.title': 'Atlas', 'atlas.sub': 'Bir konu seç. On soru, süre yok, her cevap kaynağıyla açıklanır. Ustalık, en az bir kez doğru cevapladığın soruları sayar.',
      'topic.count': '{n} sorudan {m}',
      'err.generic': 'Bir şeyler ters gitti. Sayfayı yenileyip tekrar dene.', 'err.step': 'Sunucuyla senkron kaçtı. Yenileniyor…', 'bank.loading': 'Sorular yükleniyor…',
      'how': 'Nasıl oynanır', 'foot': '<a href="https://x.com/ekinoks_26" target="_blank" rel="noopener">ecamli</a> tarafından yapılan bir hayran oyunu, Rialo veya Subzero Labs ile bağı yoktur. Her soru bir <a href="https://www.rialo.io/blog" target="_blank" rel="noopener">rialo.io</a> yazısına, <a href="https://learn.rialo.io" target="_blank" rel="noopener">Rialo Learn</a>\'e, <a href="https://playground.rialo.io" target="_blank" rel="noopener">Playground</a>\'a veya rialo-cdk dokümanlarına bağlıdır. <a href="https://github.com/erkancamli/reactor" target="_blank" rel="noopener">Kaynak kodu GitHub\'da</a>.',
      'sprint.time': '{s}s kaldı', 'sprint.go': 'Başla', 'sprint.intro': 'Doksan saniyen var. Doğru cevap zorluğa ve hıza göre puan verir, yanlış 50 puan ve serini götürür. Başlamak için dokun.',
      'share.text': 'Reactor Günün Bloğu #{n}\n{line}\n{total} sorudan {ok} doğru, {score} puan\n{url}',
      'share.sprint': 'Reactor Sprint: {score} puan, 90 saniyede {answered} sorudan {ok} doğru\n{url}',
    },
  };
  const t = (k, vars) => { let s = (T[lang] && T[lang][k]) || T.en[k] || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; };
  const TOPICS = {
    company: ['Rialo and Subzero Labs', 'Rialo ve Subzero Labs'], reactive: ['Reactive transactions', 'Reaktif işlemler'], edge: ['Edge and webcalls', 'Edge ve web çağrıları'],
    stream: ['Stream and Project 1337', 'Stream ve Project 1337'], stake: ['Stake for Service', 'Stake for Service'], agents: ['Agent economy', 'Ajan ekonomisi'], scale: ['SCALE', 'SCALE'],
    rwa: ['Real world assets', 'Gerçek dünya varlıkları'], privacy: ['Privacy and REX', 'Gizlilik ve REX'], markets: ['Prediction markets', 'Tahmin piyasaları'], economics: ['Economics', 'Ekonomi'],
    gauss: ['Gauss upgrades', 'Gauss yükseltmeleri'], systems: ['Distributed systems', 'Dağıtık sistemler'], devs: ['Developers and the CDK', 'Geliştiriciler ve CDK'], playground: ['Playground', 'Playground'],
  };
  const topicName = (k) => (TOPICS[k] ? TOPICS[k][lang === 'tr' ? 1 : 0] : k);
  const HOW = {
    en: `<h2>How to play</h2>
<p>Reactor is a knowledge game about Rialo. Every question is lifted from a Rialo post, a Rialo Learn page, the Playground or the rialo-cdk docs, and every answer comes back with the exact line that proves it.</p>
<ul>
<li><b>Daily Block.</b> Twelve questions, the same for everyone, once a day per name. Right answers fill your block with transactions, wrong ones leave noise. The clock runs on the server, so the board is honest.</li>
<li><b>Stake.</b> Before answering, stake 1x, 2x or 3x. Sure of it? 3x triples the points but costs 300 if you are wrong. Rialo's Stake for Service turns stake into a payment stream; here your stake is your confidence.</li>
<li><b>Webcall.</b> Once per block, pull the source line onto the screen, the way Rialo pulls web data into a transaction. That question pays half.</li>
<li><b>Filter.</b> Once per block, drop two wrong options. Rialo's Stream filters noise out of market data; you filter noise out of the choices.</li>
<li><b>Handover.</b> Once per block, skip a question with no penalty and keep your streak, like a transaction carried across a Gauss handover.</li>
<li><b>Streak.</b> Each consecutive right answer adds 10% to the next one, up to 50%. Fast answers earn up to 50% extra.</li>
<li><b>Sprint</b> is ninety seconds of rapid questions, played on this device. <b>Atlas</b> is topic study with no clock.</li>
</ul>
<p>Ranks grow with your total: Observer, Node Runner at 2,000, Validator at 8,000, Core at 20,000.</p>`,
    tr: `<h2>Nasıl oynanır</h2>
<p>Reactor, Rialo hakkında bir bilgi oyunu. Her soru bir Rialo yazısından, Rialo Learn sayfasından, Playground'dan veya rialo-cdk dokümanlarından alındı; her cevapla birlikte onu kanıtlayan cümle ekrana gelir.</p>
<ul>
<li><b>Günün Bloğu.</b> On iki soru, herkese aynı, her isme günde bir hak. Doğru cevaplar bloğunu işlemlerle doldurur, yanlışlar gürültü olarak kalır. Süre sunucuda tutulur, tablo bu yüzden dürüsttür.</li>
<li><b>Stake.</b> Cevaplamadan önce 1x, 2x veya 3x stake seç. Eminsen 3x puanı üçe katlar ama yanlışta 300 götürür. Rialo'da Stake for Service stake'i bir ödeme akışına çevirir; burada stake'in özgüvenin.</li>
<li><b>Webcall.</b> Blok başına bir kez kaynak cümleyi ekrana çek, Rialo'nun web verisini işleme çekmesi gibi. O soru yarım puan verir.</li>
<li><b>Filtre.</b> Blok başına bir kez iki yanlış şıkkı ele. Rialo'nun Stream'i piyasa verisindeki gürültüyü filtreler, sen şıklardaki gürültüyü.</li>
<li><b>Devir.</b> Blok başına bir kez bir soruyu cezasız geç, serin bozulmaz; Gauss devrinde taşınan bir işlem gibi.</li>
<li><b>Seri.</b> Art arda her doğru cevap sonrakine %10 ekler, en fazla %50. Hızlı cevap %50'ye kadar ek puan getirir.</li>
<li><b>Sprint</b> doksan saniyelik hızlı soru turu, bu cihazda oynanır. <b>Atlas</b> süresiz konu çalışması.</li>
</ul>
<p>Seviyeler toplam puanla yükselir: Observer, 2.000'de Node Runner, 8.000'de Validator, 20.000'de Core.</p>`,
  };

  // ---------- state ----------
  let me = LS.get('me', null);
  let bank = null;
  let board = { which: 'today', cache: {} };
  let session = null;      // the run in progress (daily, sprint or atlas)
  let timer = null;
  let toastT = null;
  const api = async (path, body) => {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error((j && j.error) || 'HTTP ' + r.status); e.status = r.status; e.body = j; throw e; }
    return j;
  };
  function toast(msg) { let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); } el.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 1800); }
  function loadBank() {
    if (bank) return Promise.resolve(bank);
    if (window.RXBANK) return Promise.resolve((bank = window.RXBANK));
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = '__BANK_URL__'; s.onload = () => res((bank = window.RXBANK)); s.onerror = () => rej(new Error('bank')); document.head.appendChild(s); });
  }
  const screens = ['home', 'play', 'result', 'atlas'];
  function show(id) { for (const s of screens) $(s).hidden = s !== id; window.scrollTo(0, 0); }
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    $('foot').innerHTML = t('foot') + ' <a href="#" id="how-link">' + t('how') + '</a>';
    $('how-link').onclick = (e) => { e.preventDefault(); $('how-body').innerHTML = HOW[lang] + '<button class="btn solid" id="how-close">' + (lang === 'tr' ? 'Tamam' : 'Got it') + '</button>'; $('dlg-how').hidden = false; $('how-close').onclick = () => { $('dlg-how').hidden = true; }; };
    $('name-text').textContent = me ? me.handle : t('name.set');
    if (session && !$('play').hidden) renderQuestion(session.question, { keepTimer: true });
  }
  document.querySelectorAll('.lang button').forEach((b) => (b.onclick = () => { lang = b.dataset.lang; LS.set('lang', lang); applyLang(); if (!$('home').hidden) renderHome(); if (!$('atlas').hidden) renderAtlas(); }));

  // ---------- block strips ----------
  function drawBlock(el, cells, n, nowIndex) {
    el.innerHTML = '';
    for (let i = 0; i < n; i++) { const c = document.createElement('i'); c.className = 'cell' + (cells[i] ? ' ' + cells[i] : '') + (i === nowIndex ? ' now' : ''); el.appendChild(c); }
  }
  function landCell(el, i, state) { const c = el.children[i]; if (!c) return; c.className = 'cell ' + state + ' fill'; if (el.children[i + 1]) el.children[i + 1].classList.add('now'); }

  // ---------- home ----------
  async function renderHome() {
    show('home');
    const today = dayKeyOf(Date.now()), n = dailyNumber(today);
    $('daily-go').textContent = t('daily.play');
    drawBlock($('home-block'), [], DAILY_N, -1);
    if (!me) { $('daily-sub').textContent = t('daily.noname', { n }); $('rankline').hidden = true; }
    else {
      $('daily-sub').textContent = t('daily.new', { n });
      api('/api/me?handle=' + encodeURIComponent(me.handle)).then((m) => {
        if (m.today && m.today.done) { $('daily-sub').textContent = t('daily.done', { n, score: fmt(m.today.score), ok: m.today.cells.filter((c) => c === 'ok').length, total: DAILY_N }); $('daily-go').textContent = t('daily.see'); drawBlock($('home-block'), m.today.cells, DAILY_N, -1); }
        else if (m.today) { $('daily-sub').textContent = t('daily.progress', { n, i: m.today.i + 1, total: DAILY_N }); $('daily-go').textContent = t('daily.resume'); drawBlock($('home-block'), m.today.cells, DAILY_N, m.today.i); }
        $('rankline').hidden = false;
        $('rankline').innerHTML = t('rank.line', { rank: m.rank, total: fmt(m.total) }) + (m.next ? t('rank.next', { left: fmt(m.next.left), next: m.next.name }) : '');
      }).catch(() => {});
    }
    const best = LS.get('sprintBest', 0);
    $('sprint-sub').textContent = best ? t('sprint.sub', { best: fmt(best) }) : t('sprint.sub0');
    loadBank().then((b) => {
      const mastered = LS.get('mastered', {}); const m = b.questions.filter((q) => mastered[q.id]).length;
      $('atlas-sub').textContent = t('atlas.sub.home', { n: m, total: b.questions.length }); $('atlas-go').textContent = Math.round((100 * m) / b.questions.length) + '%';
    }).catch(() => { $('atlas-sub').textContent = t('bank.loading'); });
    renderBoard();
  }
  async function renderBoard() {
    document.querySelectorAll('#board-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.which === board.which));
    const el = $('board');
    try {
      const data = board.cache[board.which] || (board.cache[board.which] = await api('/api/board?which=' + board.which));
      if (!data.rows.length) { el.innerHTML = `<p class="empty">${t('board.empty.' + board.which)}</p>`; return; }
      const mine = me ? me.handle.toLowerCase() : null;
      el.innerHTML = '<table class="board">' + data.rows.map((r, i) => `<tr class="${mine && r.handle.toLowerCase() === mine ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.handle)}${board.which === 'today' ? ` <span class="mute">${r.correct}/${DAILY_N}</span>` : board.which === 'all' ? ` <span class="mute">${esc(r.rank || '')}</span>` : ` <span class="mute">${r.days || 1}${lang === 'tr' ? ' gün' : 'd'}</span>`}</td><td>${fmt(r.score)}</td></tr>`).join('') + '</table>';
    } catch { el.innerHTML = `<p class="empty">${t('board.err')}</p>`; }
  }
  document.querySelectorAll('#board-tabs button').forEach((b) => (b.onclick = () => { board.which = b.dataset.which; renderBoard(); }));
  $('home-link').onclick = (e) => { e.preventDefault(); stopTimer(); session = null; renderHome(); };

  // ---------- name ----------
  function openName() { $('name-err').textContent = ''; $('name-input').value = me ? me.handle : ''; $('dlg-name').hidden = false; setTimeout(() => $('name-input').focus(), 50); return new Promise((res) => { nameResolve = res; }); }
  let nameResolve = null;
  $('name-chip').onclick = () => openName();
  $('name-cancel').onclick = () => { $('dlg-name').hidden = true; if (nameResolve) nameResolve(false); };
  $('name-save').onclick = async () => {
    const h = $('name-input').value.trim();
    $('name-save').disabled = true; $('name-save').textContent = t('name.saving');
    try {
      const r = await api('/api/register', { handle: h });
      me = { handle: r.handle, key: r.key }; LS.set('me', me); $('name-text').textContent = me.handle; $('dlg-name').hidden = true; board.cache = {};
      if (nameResolve) nameResolve(true);
    } catch (e) { $('name-err').textContent = e.status ? e.message : t('name.err.net'); }
    $('name-save').disabled = false; $('name-save').textContent = t('name.save');
  };
  $('name-input').onkeydown = (e) => { if (e.key === 'Enter') $('name-save').click(); };

  // ---------- timer ----------
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function startTimer(totalMs, remainingMs, onEnd) {
    stopTimer();
    const end = Date.now() + remainingMs, bar = $('timer'), fill = bar.querySelector('i');
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      fill.style.transform = `scaleX(${left / totalMs})`; bar.classList.toggle('low', left / totalMs < 0.25);
      if (session && session.mode === 'sprint') $('play-label').textContent = t('play.sprint') + ' · ' + t('sprint.time', { s: Math.ceil(left / 1000) });
      if (left <= 0) { stopTimer(); onEnd(); }
    };
    tick(); timer = setInterval(tick, 100);
  }

  // ---------- question rendering (shared by all modes) ----------
  let picked = []; // order type: shown indices in the player's order
  function renderQuestion(q, opts = {}) {
    const daily = session.mode === 'daily';
    $('q-kind').textContent = t('kind.' + q.type);
    $('q-dots').innerHTML = [1, 2, 3].map((d) => `<i class="${d <= q.diff ? 'on' : ''}"></i>`).join('');
    $('q-topic').textContent = topicName(q.topic);
    const L = lang;
    const text = q.type === 'noise' ? q.s[L] : q.q[L];
    $('q-text').innerHTML = q.type === 'fill' ? esc(text).replace('____', '<span class="blank"></span>') : esc(text);
    $('q-quote').hidden = true; $('q-quote').innerHTML = '';
    $('feedback').hidden = true; $('submit-order').hidden = true; $('q-hint').hidden = true;
    const A = $('q-answers'); A.innerHTML = ''; A.className = ''; picked = [];
    if (q.type === 'noise') {
      A.className = 'tf';
      A.innerHTML = `<button class="ans" data-ans="true">${t('signal')}</button><button class="ans" data-ans="false">${t('noise')}</button>`;
      A.querySelectorAll('button').forEach((b) => (b.onclick = () => answer(b.dataset.ans === 'true')));
    } else if (q.type === 'order') {
      A.className = 'steps';
      A.innerHTML = q.steps[L].map((s, i) => `<button class="step" data-i="${i}"><span class="n">·</span><span>${esc(s)}</span></button>`).join('');
      $('q-hint').textContent = t('order.hint'); $('q-hint').hidden = false;
      $('submit-order').hidden = false; $('submit-order').disabled = true;
      A.querySelectorAll('button').forEach((b) => (b.onclick = () => {
        const i = Number(b.dataset.i), at = picked.indexOf(i);
        if (at >= 0) picked.splice(at, 1); else picked.push(i);
        A.querySelectorAll('button').forEach((x) => { const k = picked.indexOf(Number(x.dataset.i)); x.classList.toggle('picked', k >= 0); x.querySelector('.n').textContent = k >= 0 ? k + 1 : '·'; });
        $('submit-order').disabled = picked.length !== q.steps[L].length;
      }));
      $('submit-order').onclick = () => answer(picked.slice());
    } else {
      A.className = 'answers';
      A.innerHTML = q.a[L].map((a, i) => `<button class="ans" data-i="${i}"><span class="n">${i + 1}</span><span>${esc(a)}</span></button>`).join('');
      A.querySelectorAll('button').forEach((b) => (b.onclick = () => answer(Number(b.dataset.i))));
    }
    // tools: stake and lifelines only in the daily
    $('tools').hidden = !daily;
    if (daily) {
      session.stake = 1; document.querySelectorAll('#stake button').forEach((b) => b.classList.toggle('on', b.dataset.stake === '1'));
      const used = session.lifelines || {};
      $('life-webcall').disabled = used.webcall !== undefined || q.type === 'source'; $('life-filter').disabled = used.filter !== undefined || q.type === 'noise' || q.type === 'order'; $('life-handover').disabled = used.handover !== undefined;
      if (used.webcall === session.i && session.webcallText) showQuote(session.webcallText);
    }
    $('play-score').textContent = fmt(session.score);
    $('play-streak').textContent = session.streak >= 2 ? `×${(1 + Math.min(STREAK_MAX, STREAK_STEP * session.streak)).toFixed(1)} ` : '';
    if (daily) $('play-label').textContent = t('play.daily', { n: session.number }) + ' · ' + t('q.of', { i: session.i + 1, n: session.n });
    else if (session.mode === 'atlas') $('play-label').textContent = t('play.atlas', { topic: topicName(session.topic) }) + ' · ' + t('q.of', { i: session.i + 1, n: session.n });
    drawBlock($('play-block'), session.cells, session.n, session.i);
    session.question = q; session.shownAt = Date.now();
    if (!opts.keepTimer) {
      if (daily) startTimer(q.limit * 1000, opts.remainingMs ?? q.limit * 1000, () => answer(null, true));
      else if (session.mode === 'atlas') { stopTimer(); $('timer').querySelector('i').style.transform = 'scaleX(0)'; }
    }
  }
  function showQuote(x) { $('q-quote').hidden = false; $('q-quote').innerHTML = `<blockquote class="quote">${esc(x.ev)}<small>${esc(x.title)}</small></blockquote>`; }
  function lockAnswers() { $('q-answers').querySelectorAll('button').forEach((b) => (b.disabled = true)); $('submit-order').hidden = true; $('tools').hidden = true; }
  // paint the verdict on the options and show the explanation
  function showFeedback(q, given, rev, res) {
    const L = lang, A = $('q-answers');
    if (q.type === 'noise') A.querySelectorAll('button').forEach((b) => { const v = b.dataset.ans === 'true'; if (v === rev.correct) b.classList.add('ok'); else if (given === v) b.classList.add('x'); });
    else if (q.type === 'order') {
      const order = rev.correct; // order[orig] = shown index
      const btns = [...A.querySelectorAll('button')];
      btns.forEach((b, shown) => { const pos = order.indexOf(shown); b.querySelector('.n').textContent = pos + 1; const mine = Array.isArray(given) ? given.indexOf(shown) : -1; b.classList.remove('picked'); b.classList.add(mine === pos ? 'ok' : 'x'); b.style.order = pos; });
      A.style.display = 'flex';
    } else A.querySelectorAll('button').forEach((b) => { const i = Number(b.dataset.i); if (i === rev.correct) b.classList.add('ok'); else if (given === i) b.classList.add('x'); b.classList.remove('gone'); });
    if (q.type === 'fill' && rev.correct >= 0) { const blank = $('q-text').querySelector('.blank'); if (blank) { blank.textContent = q.a[L][rev.correct]; blank.style.minWidth = '0'; } }
    const v = $('verdict'); v.className = 'verdict ' + (res.skipped ? '' : res.correct ? 'ok' : 'x');
    $('verdict-text').textContent = res.skipped ? t('v.skip') : res.timeout ? t('v.timeout') : res.correct ? t('v.ok') : t('v.x');
    $('verdict-pts').textContent = res.skipped ? '' : res.gain ? '+' + fmt(res.gain) : res.penalty ? '−' + fmt(res.penalty) : '0';
    let why = rev.why[L];
    if (!res.correct && !res.skipped && q.type !== 'order' && q.type !== 'noise') why = t('v.correctwas') + q.a[L][rev.correct] + '. ' + why;
    if (!res.correct && !res.skipped && q.type === 'noise') why = t('v.correctwas') + (rev.correct ? t('signal') : t('noise')) + '. ' + why;
    $('fb-why').textContent = why;
    $('fb-quote').innerHTML = `${esc(rev.ev)}<small>${t('source')}: <a href="${esc(rev.url)}" target="_blank" rel="noopener">${esc(rev.title)}</a></small>`;
    $('feedback').hidden = false; $('q-hint').hidden = true;
    $('next-btn').textContent = session.i + 1 >= session.n ? t('finish') : t('next');
    if (!res.correct && !res.skipped) $('q-text').classList.add('shake'); else $('play-block').classList.add('flash');
    setTimeout(() => { $('q-text').classList.remove('shake'); $('play-block').classList.remove('flash'); }, 400);
    $('play-score').textContent = fmt(session.score);
    $('play-streak').textContent = session.streak >= 2 ? `×${(1 + Math.min(STREAK_MAX, STREAK_STEP * session.streak)).toFixed(1)} ` : '';
    if (session.mode !== 'sprint') $('feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- answering ----------
  async function answer(given, timeout = false) {
    if (!session || session.busy) return;
    session.busy = true; stopTimer(); lockAnswers();
    const q = session.question;
    try {
      if (session.mode === 'daily') {
        const r = await api('/api/daily/answer', { run: session.run, key: me.key, i: session.i, answer: given, stake: session.stake });
        session.score = r.score; session.streak = r.streak;
        const state = r.skipped ? 'skip' : r.correct ? 'ok' : 'x'; session.cells[session.i] = state; landCell($('play-block'), session.i, state);
        showFeedback(q, given, r.reveal, r);
        session.pending = r;
      } else {
        const elapsedMs = Date.now() - session.shownAt;
        const correct = isCorrect(q.raw, given, q.perm);
        const p = points({ type: q.type, diff: q.diff, correct, stake: 1, streak: session.streak, elapsedMs, timeout });
        let gain = p.gain, penalty = 0;
        if (session.mode === 'sprint' && !correct) penalty = 50;
        if (session.mode === 'atlas') gain = correct ? p.base : 0;
        session.score = Math.max(0, session.score + gain - penalty);
        session.streak = correct ? session.streak + 1 : 0; session.bestStreak = Math.max(session.bestStreak, session.streak);
        const rev = reveal(q.raw, q.tr, q.perm, bank);
        session.cells[session.i] = correct ? 'ok' : 'x'; landCell($('play-block'), session.i, correct ? 'ok' : 'x');
        if (correct) { const m = LS.get('mastered', {}); m[q.id] = true; LS.set('mastered', m); }
        session.answers.push({ id: q.id, type: q.type, topic: q.topic, diff: q.diff, correct, gain, penalty, elapsedMs, reveal: rev, view: q, answer: given });
        showFeedback(q, given, rev, { correct, gain, penalty, timeout });
        if (session.mode === 'sprint') { session.autoNext = setTimeout(() => next(), correct ? 1500 : 3200); }
      }
    } catch (e) {
      if (e.status === 409 && e.body && e.body.done) { await openResultFromServer(); }
      else if (e.status === 409 || e.status === 404) { toast(t('err.step')); setTimeout(() => startDaily(), 900); }
      else toast(e.message || t('err.generic'));
    }
    session.busy = false;
  }
  $('next-btn').onclick = () => next();
  async function next() {
    if (!session) return;
    clearTimeout(session.autoNext);
    if (session.mode === 'daily') {
      const r = session.pending; session.pending = null; if (!r) return;
      if (r.done) { showDailyResult(r.result); return; }
      session.i = r.i; session.lifelines = session.lifelines || {};
      renderQuestion(r.question, { remainingMs: r.remainingMs });
      return;
    }
    session.i += 1;
    if (session.mode === 'sprint') {
      if (session.ended || session.i >= session.queue.length) { endSprint(); return; }
      renderQuestion(session.queue[session.i], { keepTimer: true });
      return;
    }
    if (session.i >= session.n) { showAtlasResult(); return; }
    renderQuestion(session.queue[session.i]);
  }

  // ---------- daily ----------
  document.querySelectorAll('#stake button').forEach((b) => (b.onclick = () => { if (!session || session.mode !== 'daily') return; session.stake = Number(b.dataset.stake); document.querySelectorAll('#stake button').forEach((x) => x.classList.toggle('on', x === b)); $('q-hint').textContent = t('stake.hint'); $('q-hint').hidden = session.stake === 1; }));
  async function lifeline(kind) {
    if (!session || session.mode !== 'daily' || session.busy) return;
    session.busy = true;
    try {
      const r = await api('/api/daily/lifeline', { run: session.run, key: me.key, i: session.i, lifeline: kind });
      session.lifelines = r.lifelines || session.lifelines;
      if (kind === 'webcall') { session.webcallText = r; showQuote(r); $('life-webcall').disabled = true; $('q-hint').textContent = t('life.webcall.hint'); $('q-hint').hidden = false; }
      else if (kind === 'filter') { r.remove.forEach((i) => { const b = $('q-answers').querySelector(`button[data-i="${i}"]`); if (b) { b.classList.add('gone'); b.disabled = true; } }); $('life-filter').disabled = true; $('q-hint').textContent = t('life.filter.hint'); $('q-hint').hidden = false; }
      else {
        stopTimer(); lockAnswers(); session.cells[session.i] = 'skip'; landCell($('play-block'), session.i, 'skip');
        if (r.done) { session.pending = { done: true, result: r.result }; }
        else { session.pending = { i: r.i, question: r.question, remainingMs: r.remainingMs }; }
        showFeedback(session.question, null, r.settled.reveal, { skipped: true });
        session.webcallText = null;
      }
    } catch (e) { toast(e.message || t('err.generic')); }
    session.busy = false;
  }
  $('life-webcall').onclick = () => lifeline('webcall'); $('life-filter').onclick = () => lifeline('filter'); $('life-handover').onclick = () => lifeline('handover');
  async function startDaily() {
    if (!me) { const ok = await openName(); if (!ok) return; }
    try {
      const r = await api('/api/daily/start', { handle: me.handle, key: me.key });
      if (r.done) { showDailyResult(r.result); return; }
      session = { mode: 'daily', run: r.run, number: r.number, n: r.n, i: r.i, score: r.score, streak: r.streak, lifelines: r.lifelines || {}, cells: r.cells || [], stake: 1, webcallText: null };
      show('play'); $('sprint-bar').hidden = true;
      if (r.settled) toast(t('v.timeout'));
      renderQuestion(r.question, { remainingMs: r.remainingMs });
    } catch (e) {
      if (e.body && (e.body.code === 'noname' || e.body.code === 'badkey')) { me = null; LS.set('me', null); $('name-text').textContent = t('name.set'); const ok = await openName(); if (ok) startDaily(); return; }
      toast(e.message || t('err.generic'));
    }
  }
  async function openResultFromServer() {
    try { const r = await api('/api/daily/start', { handle: me.handle, key: me.key }); if (r.done) showDailyResult(r.result); } catch (e) { toast(e.message); }
  }
  $('go-daily').onclick = () => startDaily();

  function showDailyResult(res) {
    stopTimer(); session = null; board.cache = {};
    show('result');
    drawBlock($('result-block'), res.cells, res.n, -1);
    $('result-title').textContent = t('res.daily.title', { n: res.number });
    $('result-sub').textContent = t(res.rank ? 'res.daily.sub' : 'res.daily.sub.nr', { ok: res.correct, n: res.n });
    $('result-stats').innerHTML = stat(fmt(res.score), t('st.score')) + stat(res.bestStreak, t('st.streak')) + stat(mmss(res.timeMs), t('st.time'));
    $('result-rank').innerHTML = res.rank ? t('rank.today', { rank: res.rank, total: fmt(res.total || 0), title: rankFor(res.total || 0) }) : '';
    const text = t('share.text', { n: res.number, line: res.line, ok: res.correct, total: res.n, score: fmt(res.score), url: location.origin });
    $('result-actions').innerHTML = `<a class="btn solid" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}">${t('share.x')}</a><button class="btn quiet" id="copy-btn">${t('share.copy')}</button><button class="btn quiet" id="home-btn">${t('home')}</button>`;
    $('copy-btn').onclick = () => navigator.clipboard.writeText(text).then(() => toast(t('copied')));
    $('home-btn').onclick = () => renderHome();
    renderReview(res.answers);
  }
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  function renderReview(answers) {
    const L = lang;
    $('review').innerHTML = `<h2 class="section" style="font-size:15px;color:var(--mute);font-weight:500;margin-top:6px">${t('review')}</h2>` + answers.map((a) => {
      const v = a.view, rev = a.reveal; if (!v || !rev) return '';
      const qtext = v.type === 'noise' ? v.s[L] : v.q[L];
      let ans = '';
      if (v.type === 'noise') ans = rev.correct ? t('signal') : t('noise');
      else if (v.type === 'order') ans = rev.correct.map((shown) => v.steps[L][shown]).join(' → ');
      else ans = v.a[L][rev.correct];
      const cls = a.skipped ? 'skip' : a.correct ? 'ok' : 'x';
      return `<div class="rv ${cls}"><i></i><div><div class="q">${esc(qtext)}</div><div class="a"><b>${esc(ans)}</b>${a.gain ? ` <span class="mono">+${fmt(a.gain)}</span>` : a.penalty ? ` <span class="mono">−${fmt(a.penalty)}</span>` : ''}</div><a href="${esc(rev.url)}" target="_blank" rel="noopener">${esc(rev.title)}</a></div></div>`;
    }).join('');
  }

  // ---------- local questions (sprint, atlas) ----------
  function localView(q) {
    const perm = permFor('local' + Math.random(), q.id, optionCount(q));
    const qtr = bank.tr.find((x) => x.id === q.id);
    const v = publicView(q, qtr, perm, 'local'); v.raw = q; v.tr = qtr; v.perm = perm; return v;
  }
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // ---------- sprint ----------
  $('go-sprint').onclick = async () => {
    try { await loadBank(); } catch { toast(t('err.generic')); return; }
    const pool = shuffle(bank.questions.filter((q) => q.type === 'mcq' || q.type === 'fill' || q.type === 'noise'));
    session = { mode: 'sprint', n: 12, i: 0, score: 0, streak: 0, bestStreak: 0, cells: [], answers: [], queue: pool.slice(0, 60).map(localView), ended: false };
    show('play'); $('tools').hidden = true; $('feedback').hidden = true; $('submit-order').hidden = true;
    $('play-label').textContent = t('play.sprint'); $('play-score').textContent = '0'; $('play-streak').textContent = '';
    drawBlock($('play-block'), [], 12, -1);
    $('q-kind').textContent = ''; $('q-dots').innerHTML = ''; $('q-topic').textContent = '';
    $('q-text').textContent = t('sprint.intro'); $('q-quote').hidden = true; $('q-hint').hidden = true;
    $('q-answers').className = 'answers'; $('q-answers').innerHTML = `<button class="ans" id="sprint-start" style="justify-content:center;font-weight:600">${t('sprint.go')}</button>`;
    $('sprint-start').onclick = () => {
      session.startedAt = Date.now();
      startTimer(SPRINT_SECONDS * 1000, SPRINT_SECONDS * 1000, () => { session.ended = true; if ($('feedback').hidden) { stopTimer(); endSprint(); } else { clearTimeout(session.autoNext); setTimeout(endSprint, 800); } });
      renderQuestion(session.queue[0], { keepTimer: true });
    };
  };
  function endSprint() {
    if (!session || session.mode !== 'sprint') return;
    stopTimer(); clearTimeout(session.autoNext);
    const s = session; session = null;
    const ok = s.answers.filter((a) => a.correct).length, best = LS.get('sprintBest', 0), isBest = s.score > best;
    if (isBest) LS.set('sprintBest', s.score);
    show('result');
    drawBlock($('result-block'), s.answers.map((a) => (a.correct ? 'ok' : 'x')), Math.max(12, s.answers.length), -1);
    $('result-title').textContent = t('res.sprint.title') + (isBest && s.score > 0 ? ' · ' + t('res.sprint.best') : '');
    $('result-sub').textContent = t('res.sprint.sub', { answered: s.answers.length, ok });
    $('result-stats').innerHTML = stat(fmt(s.score), t('st.score')) + stat(s.bestStreak, t('st.streak')) + stat(fmt(Math.max(best, s.score)), lang === 'tr' ? 'en iyi' : 'best');
    $('result-rank').innerHTML = '';
    const text = t('share.sprint', { score: fmt(s.score), ok, answered: s.answers.length, url: location.origin });
    $('result-actions').innerHTML = `<button class="btn solid" id="again-btn">${t('again')}</button><a class="btn quiet" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}">${t('share.x')}</a><button class="btn quiet" id="home-btn">${t('home')}</button>`;
    $('again-btn').onclick = () => $('go-sprint').click(); $('home-btn').onclick = () => renderHome();
    renderReview(s.answers.filter((a) => !a.correct));
  }

  // ---------- atlas ----------
  $('go-atlas').onclick = async () => { try { await loadBank(); } catch { toast(t('err.generic')); return; } renderAtlas(); };
  function renderAtlas() {
    show('atlas');
    const mastered = LS.get('mastered', {});
    const by = {}; for (const q of bank.questions) { (by[q.topic] = by[q.topic] || { n: 0, m: 0 }); by[q.topic].n++; if (mastered[q.id]) by[q.topic].m++; }
    $('topics').innerHTML = Object.keys(TOPICS).filter((k) => by[k]).map((k) => `<button class="topic" data-topic="${k}"><h3>${esc(topicName(k))}</h3><span class="pct">${t('topic.count', { m: by[k].m, n: by[k].n })}</span><span class="bar"><i style="width:${(100 * by[k].m) / by[k].n}%"></i></span></button>`).join('');
    $('topics').querySelectorAll('button').forEach((b) => (b.onclick = () => startAtlas(b.dataset.topic)));
  }
  function startAtlas(topic) {
    const mastered = LS.get('mastered', {});
    const all = bank.questions.filter((q) => q.topic === topic);
    const fresh = shuffle(all.filter((q) => !mastered[q.id])), rest = shuffle(all.filter((q) => mastered[q.id]));
    const queue = fresh.concat(rest).slice(0, 10).map(localView);
    session = { mode: 'atlas', topic, n: queue.length, i: 0, score: 0, streak: 0, bestStreak: 0, cells: [], answers: [], queue };
    show('play'); $('tools').hidden = true;
    renderQuestion(queue[0]);
  }
  function showAtlasResult() {
    const s = session; session = null; stopTimer();
    const mastered = LS.get('mastered', {});
    const all = bank.questions.filter((q) => q.topic === s.topic), m = all.filter((q) => mastered[q.id]).length;
    const ok = s.answers.filter((a) => a.correct).length;
    show('result');
    drawBlock($('result-block'), s.cells, s.n, -1);
    $('result-title').textContent = t('res.atlas.title');
    $('result-sub').textContent = t('res.atlas.sub', { ok, n: s.n, topic: topicName(s.topic), pct: Math.round((100 * m) / all.length) });
    $('result-stats').innerHTML = stat(ok + '/' + s.n, t('st.correct')) + stat(m + '/' + all.length, lang === 'tr' ? 'öğrenilen' : 'mastered') + stat(s.bestStreak, t('st.streak'));
    $('result-rank').innerHTML = '';
    $('result-actions').innerHTML = `<button class="btn solid" id="again-btn">${t('atlas.more')}</button><button class="btn quiet" id="home-btn">${t('home')}</button>`;
    $('again-btn').onclick = () => renderAtlas(); $('home-btn').onclick = () => renderHome();
    renderReview(s.answers);
  }

  // ---------- boot ----------
  applyLang();
  renderHome();
  window.__rx = { get session() { return session; }, api, startDaily, loadBank, LS };
})();
