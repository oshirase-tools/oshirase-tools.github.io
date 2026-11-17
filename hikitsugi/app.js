(function (root) {
  'use strict';

  var SECTIONS = [
    { id: 'before', label: '始める前に', hint: '準備する物・開いておく画面・必要な権限' },
    { id: 'steps', label: '手順', hint: '1行に1つの操作' },
    { id: 'check', label: 'うまくいったか', hint: '終わったときに、何を見ればよいか' },
    { id: 'trouble', label: '困ったとき', hint: '元に戻す方法・だれに聞くか' }
  ];

  // 見出しの行（この行より下を、その枠に入れる）
  var HEADINGS = [
    { id: 'purpose', re: /^[【［\[■#\s]*(目的|この作業の目的|何のための作業か)[】］\]：:\s]*$/ },
    { id: 'before', re: /^[【［\[■#\s]*(始める前に|はじめる前に|準備|事前準備|用意する物|用意するもの)[】］\]：:\s]*$/ },
    { id: 'steps', re: /^[【［\[■#\s]*(手順|やり方|作業|流れ)[】］\]：:\s]*$/ },
    { id: 'check', re: /^[【［\[■#\s]*(うまくいったか|確認|完了の確認|終わったら|チェック)[】］\]：:\s]*$/ },
    { id: 'trouble', re: /^[【［\[■#\s]*(困ったとき|困ったら|トラブル|エラーのとき|うまくいかないとき)[】］\]：:\s]*$/ }
  ];

  // 見出しがないときに、言葉で枠を決める
  var GUESS = [
    { id: 'trouble', re: /(エラー[^。、]{0,8}(出|起き|なっ|表示され)(たら|たとき|た場合|るとき|る場合)|困ったら|困ったとき|うまくいかない|失敗したら|失敗したとき|間違えたら|まちがえたら|(分から|わから)ない(とき|場合|時)|迷ったら|止まったら|動かない(とき|場合)|元に戻す方法|合わない(とき|場合)|(担当|窓口|上司|総務|経理|管理者)(に|へ)(聞く|相談|連絡)|出なかったら|できなかったら)/ },
    { id: 'check', re: /(ていれば|ば完了|たら完了|ばOK|たらOK|表示されれば|完了です|で完了|確認できたら|一致すれば)/ },
    { id: 'before', re: /((^|[^名午つるす])前に|事前に|準備|用意|ておく|権限|あらかじめ)/ }
  ];

  // あいまいな言葉（見つけた言葉, 探し方）
  var VAGUE = [
    ['適宜', /適宜/], ['しばらく', /しばらく/], ['いい感じ', /いい感じ|いいかんじ/], ['なるべく', /なるべく/],
    ['いつもの', /いつもの/], ['適当に', /適当に/], ['ちゃんと', /ちゃんと/], ['よしなに', /よしなに/],
    ['うまく', /うまく(?!いか|いっ)/], ['それなりに', /それなりに/], ['例の', /(^|[^一-龥])例の/],
    ['あれ', /(^|[、。\s])あれ(を|で|が)/], ['さっきの', /さっきの/], ['たぶん', /たぶん|多分/],
    ['必要に応じて', /必要に応じて/], ['随時', /随時/]
  ];
  // 1行に2つ以上の操作が入っているかを見る（「〜して、」「〜してから」「。」で2文 など）
  var MULTI_SKIP = /(すべてから|全てから|ただし、|もし、|応じて、|として、|すべて、|まず、|次に、|なお、)/g;
  var MULTI = /(して、|し、|て、|んで、|開き、|押し、|選び、|入れ、|書き、|貼り、|(い|し|え|べ|け|め|れ|っ|じ|見)てから|んでから|したら|た後に|たあとに|た後、|たあと、|。(?=.))/;
  var MAX_LINES = 80;
  var MAX_LINE_LEN = 120;

  function cleanLine(s) {
    return String(s).replace(/\t/g, ' ').replace(/^\s*(?:[0-9０-９]+(?:[.．](?![0-9０-９])|[、)）])|[・\-*●○◯□■▶→]|[①-⑳])\s*/, '').trim();
  }

  function cut(s, max) { var a = Array.from(s); return a.length > max ? a.slice(0, max).join('') : s; }

  function parseMemo(text) {
    var out = { purpose: [], before: [], steps: [], check: [], trouble: [] };
    var notes = [];
    var lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n');
    var current = null;
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw.trim()) continue;
      var head = null;
      for (var h = 0; h < HEADINGS.length; h++) {
        if (HEADINGS[h].re.test(raw.trim())) { head = HEADINGS[h].id; break; }
      }
      if (head) { current = head; continue; }
      var line = cleanLine(raw);
      if (!line) continue;
      if (count >= MAX_LINES) { notes.push('メモが長いので、はじめの' + MAX_LINES + '行だけを使いました。'); break; }
      if (Array.from(line).length > MAX_LINE_LEN) {
        line = cut(line, MAX_LINE_LEN);
        if (notes.indexOf('長い行は' + MAX_LINE_LEN + '文字で切りました。') === -1) notes.push('長い行は' + MAX_LINE_LEN + '文字で切りました。');
      }
      var sec = current;
      var pm = line.match(/^目的[：:]\s*(.+)$/);
      if (pm) { out.purpose.push(pm[1]); count++; continue; }
      if (!sec) {
        sec = 'steps';
        for (var g = 0; g < GUESS.length; g++) {
          if (GUESS[g].id === 'before' && out.steps.length) continue; // 手順の途中の行は動かさない
          if (GUESS[g].re.test(line)) { sec = GUESS[g].id; break; }
        }
      }
      out[sec].push(line);
      count++;
    }
    return { sections: out, notes: notes };
  }

  // 赤ペン点検（決まったルールで探す。AI には送らない）
  function review(doc) {
    var items = [];
    doc.sections.steps.forEach(function (s, i) {
      if (MULTI.test(s.replace(MULTI_SKIP, ''))) {
        items.push({ kind: 'multi', where: '手順 ' + (i + 1), text: s, tip: '1行に2つ以上の操作が入っているかもしれません。「〜して、」「〜してから」などのつなぎの言葉の前と後で、行を2つに分けると迷いにくくなります。' });
      }
    });
    ['before', 'steps', 'check', 'trouble'].forEach(function (id) {
      doc.sections[id].forEach(function (s, i) {
        var hits = VAGUE.filter(function (v) { return v[1].test(s); }).map(function (v) { return v[0]; });
        if (hits.length) {
          var label = SECTIONS.filter(function (x) { return x.id === id; })[0].label;
          items.push({ kind: 'vague', where: label + ' ' + (i + 1), text: s, tip: '「' + hits.join('」「') + '」は人によって受け取り方がちがいます。「5分ほど」「〇〇の画面が出るまで」のように、時間や見た目で書くと迷いません。' });
        }
      });
    });
    if (doc.sections.steps.length === 0) items.push({ kind: 'missing', where: '手順', text: '', tip: '手順が1つもありません。メモを1行に1つずつ書いてください。' });
    if (doc.sections.before.length === 0) items.push({ kind: 'missing', where: '始める前に', text: '', tip: '準備する物や、開いておく画面が書かれていません。初めての人は、ここで止まりがちです。' });
    if (doc.sections.check.length === 0) items.push({ kind: 'missing', where: 'うまくいったか', text: '', tip: '終わったときに何を見ればよいかが書かれていません。「〇〇の表示が出れば完了」のように1行あると安心です。' });
    if (doc.sections.trouble.length === 0) items.push({ kind: 'missing', where: '困ったとき', text: '', tip: '困ったときの戻し方や、聞く相手が書かれていません。' });
    if (!doc.contact) items.push({ kind: 'missing', where: '連絡先', text: '', tip: '困ったときに聞く相手が空です。名前ではなく「経理の担当」のように役割で書くと、人が変わっても使えます。' });
    var left = [];
    Object.keys(SAMPLES).forEach(function (k) {
      var s = SAMPLES[k];
      if (doc.title && doc.title === s.title && left.indexOf('作業の名前') === -1) left.push('作業の名前');
      var sameMain = (doc.title === s.title) || (doc.memoRaw && doc.memoRaw.trim() === s.memo.trim());
      if (sameMain && doc.minutes && doc.minutes === s.minutes && left.indexOf('かかる時間') === -1) left.push('かかる時間');
      if (sameMain && doc.contact && doc.contact === s.contact && left.indexOf('聞く相手') === -1) left.push('聞く相手');
      if (doc.memoRaw && doc.memoRaw.trim() === s.memo.trim() && left.indexOf('メモ') === -1) left.push('メモ');
    });
    if (left.length) items.unshift({ kind: 'missing', where: '見本のまま', text: '', tip: '見本のままの欄があります（' + left.join('・') + '）。自分の作業に書きかえてから印刷してください。' });
    if (!doc.minutes) items.push({ kind: 'missing', where: '所要時間', text: '', tip: 'かかる時間の目安が空です。目安があると、途中で止まっているのか、まだ途中なのかが分かります。' });
    return items;
  }

  function build(input) {
    var inp = input || {};
    var parsed = parseMemo(inp.memo);
    var doc = {
      title: cut(String(inp.title || '').trim(), 60) || '（作業の名前）',
      contact: cut(String(inp.contact || '').trim(), 60),
      minutes: cut(String(inp.minutes || '').trim(), 20),
      owner: cut(String(inp.owner || '').trim(), 30),
      date: cut(String(inp.date || '').trim(), 20),
      memoRaw: String(inp.memo || ''),
      sections: parsed.sections,
      notes: parsed.notes
    };
    doc.review = review(doc);
    return doc;
  }

  function toText(doc, markdown) {
    var L = [];
    var h = function (s) { return markdown ? '## ' + s : '【' + s + '】'; };
    L.push(markdown ? '# ' + doc.title : '■ ' + doc.title);
    var meta = [];
    if (doc.date) meta.push('作成日：' + doc.date);
    if (doc.owner) meta.push('作成：' + doc.owner);
    meta.push('所要時間：' + (doc.minutes || '（未記入）'));
    L.push(meta.join('　'));
    if (doc.sections.purpose.length) L.push('目的：' + doc.sections.purpose.join(' '));
    L.push('');
    L.push(h('始める前に'));
    if (doc.sections.before.length) doc.sections.before.forEach(function (s) { L.push((markdown ? '- [ ] ' : '□ ') + s); });
    else L.push('（未記入）');
    L.push('');
    L.push(h('手順'));
    if (doc.sections.steps.length) doc.sections.steps.forEach(function (s, i) { L.push((i + 1) + '. ' + s); });
    else L.push('（未記入）');
    L.push('');
    L.push(h('うまくいったか'));
    if (doc.sections.check.length) doc.sections.check.forEach(function (s) { L.push((markdown ? '- [ ] ' : '□ ') + s); });
    else L.push('（未記入）');
    L.push('');
    L.push(h('困ったとき'));
    doc.sections.trouble.forEach(function (s) { L.push((markdown ? '- ' : '・') + s); });
    L.push((markdown ? '- ' : '・') + '聞く相手：' + (doc.contact || '（未記入）'));
    L.push('');
    L.push(h('引き継ぎチェック'));
    L.push((markdown ? '- [ ] ' : '□ ') + '前の担当が、手順を見せながら説明した');
    L.push((markdown ? '- [ ] ' : '□ ') + '新しい担当が、手順書だけを見て1人でできた');
    return L.join('\n');
  }

  var SAMPLES = {
    keiri: {
      title: '月末の請求書の発行（架空の会社）', owner: '総務', minutes: '30分ほど', contact: '経理の担当',
      memo: '請求ソフトにログインしておく\n今月の売上表を開く\nお客さまごとに金額を確かめて、請求書を作る\n適宜PDFで保存\nメールで送る\n送信済みの一覧に今月の分が全部出ていれば完了\n金額が合わないときは送らずに止めて、経理の担当に聞く'
    },
    shop: {
      title: 'ネットショップの発送作業（架空のお店）', owner: '店長', minutes: '1件5分ほど', contact: '',
      memo: '【始める前に】\n送り状のプリンターの電源を入れる\n【手順】\n注文一覧を開く\n未発送の注文を選び、送り状を印刷する\n商品を箱に入れる\n送り状を貼る\nしばらく待ってから発送済みにする\n【うまくいったか】\n注文が「発送済み」になっていれば完了'
    },
    daily: {
      title: '社内システムの日次入力（架空）', owner: '', minutes: '', contact: '情報システムの窓口',
      memo: '1. システムを開く\n2. 日付を選ぶ\n3. いつもの数字を入れる\n4. 保存を押す\n5. 一覧に今日の行が出ていれば完了\n6. エラーが出たら画面の写真をとって窓口に送る'
    }
  };

  // ---- 画面 ----
  function initBrowser() {
    if (typeof document === 'undefined') return;
    var $ = function (id) { return document.getElementById(id); };
    var ids = ['title', 'owner', 'date', 'minutes', 'contact', 'memo'];
    if (!$('memo')) return;

    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    function current() {
      var o = {};
      ids.forEach(function (k) { o[k] = $(k).value; });
      return build(o);
    }

    function render() {
      var doc = current();
      var pv = $('preview');
      clear(pv);
      var h2 = el('h2', 'doc-title');
      h2.appendChild(el('span', doc.title === '（作業の名前）' ? 'blank' : null, doc.title));
      pv.appendChild(h2);
      var meta = el('p', 'doc-meta');
      var parts = [];
      if (doc.date) parts.push('作成日：' + doc.date);
      if (doc.owner) parts.push('作成：' + doc.owner);
      parts.push('所要時間：');
      meta.textContent = parts.join('　');
      meta.appendChild(el('span', doc.minutes ? null : 'blank', doc.minutes || '（未記入）'));
      pv.appendChild(meta);
      if (doc.sections.purpose.length) pv.appendChild(el('p', 'doc-purpose', '目的：' + doc.sections.purpose.join(' ')));

      function listSection(label, items, kind) {
        var box = el('section', 'doc-sec');
        box.appendChild(el('h3', null, label));
        if (!items.length && kind !== 'trouble') { box.appendChild(el('p', 'empty blank', '（未記入）')); pv.appendChild(box); return; }
        if (kind === 'steps') {
          var tbl = el('table', 'steps');
          var thead = el('thead'); var tr = el('tr');
          ['', '操作', '説明済', '1人でできた'].forEach(function (t) { tr.appendChild(el('th', null, t)); });
          thead.appendChild(tr); tbl.appendChild(thead);
          var tb = el('tbody');
          items.forEach(function (s, i) {
            var r = el('tr');
            r.appendChild(el('td', 'num', String(i + 1)));
            r.appendChild(el('td', null, s));
            r.appendChild(el('td', 'box', '□'));
            r.appendChild(el('td', 'box', '□'));
            tb.appendChild(r);
          });
          tbl.appendChild(tb); box.appendChild(tbl);
        } else {
          var ul = el('ul', kind === 'trouble' ? 'dots' : 'checks');
          items.forEach(function (s) { ul.appendChild(el('li', null, (kind === 'trouble' ? '' : '□ ') + s)); });
          if (kind === 'trouble') {
            var who = el('li', null, '聞く相手：');
            who.appendChild(el('span', doc.contact ? null : 'blank', doc.contact || '（未記入）'));
            ul.appendChild(who);
          }
          box.appendChild(ul);
        }
        pv.appendChild(box);
      }
      listSection('始める前に', doc.sections.before, 'before');
      listSection('手順', doc.sections.steps, 'steps');
      listSection('うまくいったか', doc.sections.check, 'check');
      listSection('困ったとき', doc.sections.trouble, 'trouble');
      var hand = el('section', 'doc-sec');
      hand.appendChild(el('h3', null, '引き継ぎチェック'));
      var hl = el('ul', 'checks');
      hl.appendChild(el('li', null, '□ 前の担当が、手順を見せながら説明した'));
      hl.appendChild(el('li', null, '□ 新しい担当が、手順書だけを見て1人でできた'));
      hand.appendChild(hl);
      pv.appendChild(hand);

      var rv = $('review');
      clear(rv);
      var list = doc.review;
      $('review-count').textContent = list.length ? list.length + '件' : '0件';
      if (!list.length) {
        rv.appendChild(el('li', 'ok', '決まったルールで見た範囲では、気になる所は見つかりませんでした。'));
      }
      list.forEach(function (it) {
        var li = el('li', 'rv-' + it.kind);
        li.appendChild(el('strong', null, it.where + '：'));
        if (it.text) li.appendChild(el('span', 'rv-text', '「' + it.text + '」'));
        li.appendChild(el('span', 'rv-tip', it.tip));
        rv.appendChild(li);
      });
      var nt = $('notes');
      clear(nt);
      doc.notes.forEach(function (n) { nt.appendChild(el('li', null, n)); });
      $('notes-box').hidden = doc.notes.length === 0;
      $('status').textContent = '';
    }

    function copy(markdown) {
      var text = toText(current(), markdown);
      var done = function () { $('fallback').hidden = true; $('status').textContent = markdown ? 'Markdown の形でコピーしました。' : '文字の形でコピーしました。Word やチャットに貼れます。'; };
      var fail = function () {
        var ta = $('fallback'); ta.hidden = false; ta.value = text; ta.focus(); ta.select();
        $('status').textContent = 'コピーできませんでした。下の欄の文字を選んであるので、Ctrl+C（スマホは長押し→コピー）でコピーしてください。';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
      else fail();
    }

    var edited = false;
    function loadSample(name) {
      var s = SAMPLES[name];
      ids.forEach(function (k) { if (k !== 'date') $(k).value = s[k] || ''; });
      edited = false;
      render();
    }
    ids.forEach(function (k) { $(k).addEventListener('input', function () { edited = true; render(); }); });
    Object.keys(SAMPLES).forEach(function (name) {
      var b = $('sample-' + name);
      if (!b) return;
      b.addEventListener('click', function () {
        if (edited && $('memo').value.trim() && !window.confirm('いま入っている文字は消えます（保存していないので元に戻せません）。見本を入れてよいですか？')) return;
        loadSample(name);
        $('status').textContent = '見本（' + SAMPLES[name].title + '）を入れました。';
      });
    });
    $('btn-clear').addEventListener('click', function () {
      if (edited && $('memo').value.trim() && !window.confirm('いま入っている文字をすべて消します（元に戻せません）。よいですか？')) return;
      ids.forEach(function (k) { $(k).value = ''; });
      $('fallback').hidden = true;
      edited = false;
      render();
    });
    $('btn-copy-text').addEventListener('click', function () { copy(false); });
    $('btn-copy-md').addEventListener('click', function () { copy(true); });
    $('btn-print').addEventListener('click', function () { window.print(); });
    var pageTitle = document.title;
    window.addEventListener('beforeprint', function () { var t = current().title; document.title = t === '（作業の名前）' ? '手順書' : t; });
    window.addEventListener('afterprint', function () { document.title = pageTitle; });

    if (!$('memo').value.trim()) {
      loadSample('keiri');
      $('status').textContent = '見本が入っています。作業の名前・作った人・時間・聞く相手・メモを、すべて自分の作業に書きかえてください。';
    } else {
      edited = true;
      render();
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser);
    else initBrowser();
  }

  var api = { parseMemo: parseMemo, review: review, build: build, toText: toText, SAMPLES: SAMPLES, VAGUE: VAGUE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hikitsugi = api;
})(typeof window !== 'undefined' ? window : this);
