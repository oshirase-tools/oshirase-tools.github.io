// 表記ゆれ・全角半角お直し（ブラウザの中だけで動く。外へ送らない）
// 直す処理は純粋な関数にして、Node のテストと Chrome 拡張からも使えるようにする。
(function (root) {
  'use strict';

  // 半角カナ → 全角カナ（濁点・半濁点は前の字とまとめる）
  var HK = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
  var ZK = 'ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン';
  var DAKU = { 'カ':'ガ','キ':'ギ','ク':'グ','ケ':'ゲ','コ':'ゴ','サ':'ザ','シ':'ジ','ス':'ズ','セ':'ゼ','ソ':'ゾ',
    'タ':'ダ','チ':'ヂ','ツ':'ヅ','テ':'デ','ト':'ド','ハ':'バ','ヒ':'ビ','フ':'ブ','ヘ':'ベ','ホ':'ボ','ウ':'ヴ','ワ':'ヷ','ヲ':'ヺ' };
  var HANDAKU = { 'ハ':'パ','ヒ':'ピ','フ':'プ','ヘ':'ペ','ホ':'ポ' };
  var HK_PUNCT = { '｡':'。','｢':'「','｣':'」','､':'、','･':'・' };

  function hankakuKanaToZenkaku(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      var idx = HK.indexOf(c);
      if (idx >= 0) {
        var z = ZK[idx];
        var next = s[i + 1];
        if (next === 'ﾞ' && DAKU[z]) { z = DAKU[z]; i++; }
        else if (next === 'ﾟ' && HANDAKU[z]) { z = HANDAKU[z]; i++; }
        out += z;
      } else if (HK_PUNCT[c]) {
        out += HK_PUNCT[c];
      } else if (c === 'ﾞ') { out += '゛'; }
      else if (c === 'ﾟ') { out += '゜'; }
      else { out += c; }
    }
    return out;
  }

  function toHalf(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }
  // マスの頭の「＝＋－＠」は、半角にすると Excel が式として読むので変えない
  function keepHead(s, fn) {
    var m = /^([＝＋－＠]+)/.exec(s);
    if (!m) return fn(s);
    return m[1] + fn(s.slice(m[1].length));
  }
  // 全角の英数字 → 半角。番号・メール・日時でよく使う「－．＠＿＋／：，」も半角にする
  function zenkakuAsciiToHankaku(s) {
    return keepHead(s, function (t) { return t.replace(/[０-９Ａ-Ｚａ-ｚ－．＠＿＋／：，]/g, toHalf); });
  }
  // そのほかの全角記号（かっこ・！・？・＆など）→ 半角。英数字と「～」は変えない
  function zenkakuSymbolToHankaku(s) {
    return keepHead(s, function (t) {
      return t.replace(/[！-｝]/g, function (c) { return /[０-９Ａ-Ｚａ-ｚ]/.test(c) ? c : toHalf(c); });
    });
  }

  // 前後の空白（半角・全角）を消す。間の空白（山田 太郎）はそのまま
  function trimSpaces(s) {
    return s.replace(/^[\s　]+|[\s　]+$/g, '');
  }

  // 会社の書き方をそろえる。mode: '' / 'long'（株式会社）/ 'short'（(株)）
  // 「（有）」「（同）」は「あり」「同上」の意味でも使うので、other=true のときだけ変える
  var KABU = { long: '株式会社', short: '(株)', re: /[(（]\s*株\s*[)）]|㈱/g };
  var OTHER = [
    { long: '有限会社', short: '(有)', re: /[(（]\s*有\s*[)）]|㈲/g },
    { long: '合同会社', short: '(同)', re: /[(（]\s*同\s*[)）]/g }
  ];
  function unifyCorp(s, mode, other) {
    if (!mode) return s;
    var list = other ? [KABU].concat(OTHER) : [KABU];
    list.forEach(function (c) {
      if (mode === 'long') s = s.replace(c.re, c.long);
      else s = s.split(c.long).join(c.short).replace(c.re, c.short);
    });
    return s;
  }

  function fixCell(v, opt) {
    var s = v;
    if (opt.trim) s = trimSpaces(s);
    if (opt.kana) s = hankakuKanaToZenkaku(s);
    if (opt.ascii) s = zenkakuAsciiToHankaku(s);
    if (opt.symbol) s = zenkakuSymbolToHankaku(s);
    if (opt.trim) s = trimSpaces(s);
    if (opt.corp) s = unifyCorp(s, opt.corp, opt.corpOther);
    return s;
  }

  // 引用符を使わず、タブと改行だけで分ける
  function splitPlain(text) {
    var lines = text.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.map(function (l) { return l.split('\t'); });
  }

  // タブ区切りの表（Excel から貼った物）を読む。マスの中の改行は「"…"」で囲まれている。
  // 引用符が閉じていない・閉じた後ろに字が続くときは、引用符を文字として読み直す（warnQuote）
  function parseTSV(text) {
    text = text.replace(/\r\n?/g, '\n');
    var rows = [], row = [], cell = '', q = false, i = 0, bad = false;
    while (i < text.length) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          q = false; i++;
          var n = text[i];
          if (n !== undefined && n !== '\t' && n !== '\n') { bad = true; break; }
          continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"' && cell === '') { q = true; i++; continue; }
      if (c === '\t') { row.push(cell); cell = ''; i++; continue; }
      if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += c; i++;
    }
    if (q) bad = true;
    if (bad) { var p = splitPlain(text); p.warnQuote = true; return p; }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function toTSV(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        return /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join('\t');
    }).join('\n');
  }

  // Excel に貼ったとき、式・日付・数字として読まれるおそれのある値
  function excelRisk(v) {
    if (/^[=+\-@]/.test(v) || /^\(\d+\)$/.test(v)) return 'formula';
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) return 'date';
    if (/^\d{1,4}[-\/]\d{1,2}([-\/]\d{1,4})?$/.test(v)) return 'date';
    if (/^0\d+$/.test(v) || /^\d{16,}$/.test(v)) return 'number';
    return '';
  }

  // 表全体を直す。header=true なら1行目は見出しとして変えない
  function fixTable(rows, opt) {
    var changed = 0, cells = [];
    var out = rows.map(function (r, ri) {
      return r.map(function (v, ci) {
        if (opt.header && ri === 0) return v;
        var n = fixCell(v, opt);
        if (n !== v) { changed++; cells.push([ri, ci]); }
        return n;
      });
    });
    // 同じ行・Excel で化けるおそれのある値は、直さずに知らせるだけ
    var risk = { formula: {}, date: {}, number: {} }, seen = {}, dups = [];
    out.forEach(function (r, ri) {
      if (opt.header && ri === 0) return;
      r.forEach(function (v, ci) { var k = excelRisk(v); if (k) risk[k][ci] = true; });
      var key = r.join('\t');
      if (key.replace(/\t/g, '') === '') return;
      if (seen[key] !== undefined) dups.push(ri); else seen[key] = ri;
    });
    var cols = function (o) { return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }); };
    var widths = {};
    rows.forEach(function (r) { widths[r.length] = true; });
    return { rows: out, changed: changed, cells: cells, dups: dups,
      zeroCols: cols(risk.number), formulaCols: cols(risk.formula), dateCols: cols(risk.date),
      ragged: Object.keys(widths).length > 1 };
  }

  var api = { hankakuKanaToZenkaku: hankakuKanaToZenkaku, zenkakuAsciiToHankaku: zenkakuAsciiToHankaku,
    zenkakuSymbolToHankaku: zenkakuSymbolToHankaku, trimSpaces: trimSpaces, unifyCorp: unifyCorp, fixCell: fixCell,
    parseTSV: parseTSV, toTSV: toTSV, fixTable: fixTable, excelRisk: excelRisk };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hyoki = api;
})(this);
