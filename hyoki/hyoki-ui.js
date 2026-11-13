(function () {
  'use strict';
  var H = window.Hyoki;
  var MAX_ROWS = 500, MAX_CELLS = 20000, MAX_CHARS = 500000;
  var $ = function (id) { return document.getElementById(id); };
  var lastRows = null, lastResult = null, lastHeader = true;

  var SAMPLE = [
    '会社名\t担当\t電話\tメール\t郵便番号',
    'ﾐﾎﾝ商事（株）\t山田 太郎\t０３－１２３４－５６７８\tyamada＠example.com\t０１２－３４５６',
    '（株）サンプル工業 \t 佐藤 花子\t03-2345-6789\tsato@example.com\t012-3456',
    '見本物産㈱\tｽｽﾞｷ ｲﾁﾛｳ\t０６－９８７６－５４３２\tsuzuki@example.com\t530-0001',
    '有限会社ためし屋\t田中 次郎\t045-111-2222\ttanaka@example.com\t220-0011',
    '（株）サンプル工業 \t 佐藤 花子\t03-2345-6789\tsato@example.com\t012-3456'
  ].join('\n');

  function options() {
    return {
      ascii: $('o-ascii').checked, kana: $('o-kana').checked, trim: $('o-trim').checked,
      symbol: $('o-symbol').checked, header: $('o-header').checked, corp: $('o-corp').value,
      corpOther: $('o-corp-other').checked
    };
  }

  function el(tag, text, cls) { var e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function colList(a) { return a.map(function (c) { return (c + 1) + '列目'; }).join('・') + '（貼った範囲の左から数えて）'; }

  function render(rows, res, header, info) {
    var showBefore = $('o-before').checked;
    var tbl = $('tbl'); tbl.textContent = '';
    var changed = {};
    res.cells.forEach(function (c) { changed[c[0] + ',' + c[1]] = true; });
    var dup = {}; res.dups.forEach(function (r) { dup[r] = true; });
    res.rows.forEach(function (r, ri) {
      var tr = el('tr');
      if (dup[ri]) tr.className = 'dup';
      r.forEach(function (v, ci) {
        var td = el(header && ri === 0 ? 'th' : 'td');
        td.appendChild(el('span', v));
        if (changed[ri + ',' + ci]) {
          td.className = 'ch';
          if (showBefore) td.appendChild(el('span', '前：' + rows[ri][ci], 'before'));
        }
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    var sum = info || ('直したマス：' + res.changed + 'か所（' + res.rows.length + '行）');
    if (header && !info) sum += '。1行目は見出しとして変えていません';
    $('summary').textContent = sum;
    var w = $('warns'); w.textContent = '';
    var add = function (t) { w.appendChild(el('li', t)); };
    if (rows.warnQuote) add('引用符（"）が閉じていない所があったので、引用符も文字として読みました。マスの区切りが元の表と合っているか確かめてください。');
    if (res.ragged) add('行によってマスの数がちがいます。貼った範囲が途中で切れていないか確かめてください。');
    if (res.dups.length) add('同じ内容の行が ' + res.dups.length + ' 行あります（点線の行）。消してはいないので、確かめてください。');
    if (res.formulaCols.length) add(colList(res.formulaCols) + 'に「= + - @」で始まる値や「(1)」のような値があります。Excel に貼ると式やマイナスの数として読まれることがあります。先にその列を「文字列」にしてから貼ってください。');
    if (res.dateCols.length) add(colList(res.dateCols) + 'に「1-2」「1/2」「10:30」のような値があります。Excel に貼ると日付や時刻になることがあります。先にその列を「文字列」にしてから貼ってください。');
    if (res.zeroCols.length) add(colList(res.zeroCols) + 'に頭が0の番号や長い番号があります。Excel に貼ると0が消えたり数字が変わったりすることがあります。先にその列を「文字列」にしてから貼ってください。');
    $('result').hidden = false;
    $('copied').hidden = true; $('copyfail').hidden = true;
  }

  $('sample').addEventListener('click', function () { $('src').value = SAMPLE; });

  $('run').addEventListener('click', function () {
    var text = $('src').value;
    if (!text.trim()) { alert('表を貼ってください。'); return; }
    if (text.length > MAX_CHARS) { alert('文字が多すぎます。表を分けて貼ってください。'); return; }
    var rows = H.parseTSV(text);
    var warnQuote = rows.warnQuote;
    while (rows.length && rows[rows.length - 1].join('') === '') rows.pop();
    rows.warnQuote = warnQuote;
    var cellCount = rows.reduce(function (n, r) { return n + r.length; }, 0);
    if (rows.length > MAX_ROWS) { alert(MAX_ROWS + '行までです。分けて貼ってください。'); return; }
    if (cellCount > MAX_CELLS) { alert('マスが多すぎます（' + MAX_CELLS + 'マスまで）。分けて貼ってください。'); return; }
    var opt = options();
    lastRows = rows; lastHeader = opt.header;
    lastResult = H.fixTable(rows, opt);
    render(rows, lastResult, opt.header);
    $('result').scrollIntoView({ behavior: 'smooth' });
  });

  $('o-before').addEventListener('change', function () {
    if (lastResult) render(lastRows, lastResult, lastHeader, lastResult.reset ? '直す前に戻しました。' : null);
  });

  $('copy').addEventListener('click', function () {
    if (!lastResult) return;
    var tsv = H.toTSV(lastResult.rows);
    var ok = function () { $('copied').hidden = false; $('copyfail').hidden = true; };
    var ng = function () { if (fallback(tsv)) ok(); else { $('copyfail').hidden = false; $('copied').hidden = true; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(ok, ng);
    else ng();
  });

  function fallback(t) {
    var ta = el('textarea'); ta.value = t; document.body.appendChild(ta);
    ta.select(); var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  $('reset').addEventListener('click', function () {
    if (!lastRows) return;
    lastResult = H.fixTable(lastRows, { header: lastHeader });
    lastResult.reset = true;
    render(lastRows, lastResult, lastHeader, '直す前に戻しました。');
  });
})();
