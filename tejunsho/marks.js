// 印のデータを扱う（置く・動かす・消す・番号の振り直し・当たり判定・元に戻す）。純粋な関数
(function (root) {
  'use strict';
  var MAX_STAMPS = 20, MAX_TEXT = 30, MAX_HISTORY = 50;
  var MIN_BOX = 8, MIN_ARROW = 16;

  function makeId() {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function len(s) { return Array.from(s || '').length; }

  // 大きさ（4-2）。L＝写真の長い辺
  function sizes(w, h) {
    var L = Math.max(w, h);
    var line = Math.max(3, Math.round(L / 300));
    var stamp = Math.max(28, Math.round(L / 25));
    return { line: line, stamp: stamp, head: line * 4, font: Math.max(16, Math.round(L / 45)), cell: Math.max(16, Math.round(L / 100)) };
  }

  // 見えている所で押した位置 → 写真の画素の位置
  function toImage(px, py, shownW, shownH, imgW, imgH) {
    return { x: Math.round(px * imgW / shownW), y: Math.round(py * imgH / shownH) };
  }

  // なぞった2点 → 写真の中に切りそろえた四角。小さすぎれば null
  function normBox(x1, y1, x2, y2, imgW, imgH) {
    var a = clamp(Math.min(x1, x2), 0, imgW), b = clamp(Math.min(y1, y2), 0, imgH);
    var c = clamp(Math.max(x1, x2), 0, imgW), d = clamp(Math.max(y1, y2), 0, imgH);
    if (c - a < MIN_BOX || d - b < MIN_BOX) return null;
    return { x: Math.round(a), y: Math.round(b), w: Math.round(c - a), h: Math.round(d - b) };
  }

  // 文字を整える。置けなければ null
  function cleanText(t) {
    var s = String(t == null ? '' : t).replace(/[\r\n\t]+/g, ' ').trim();
    if (!s || len(s) > MAX_TEXT) return null;
    return s;
  }

  // 番号を置いた順に 1 から振り直す
  function renumber(marks) {
    var n = 0;
    return marks.map(function (m) { if (m.type !== 'stamp') return m; n++; return Object.assign({}, m, { no: n }); });
  }
  function stampCount(marks) { return marks.filter(function (m) { return m.type === 'stamp'; }).length; }

  /**
   * 印を作る。置けなければ { error }
   * @param {string} type stamp|rect|arrow|mosaic|text
   * @param {object} p  stamp/text:{x,y,text}  rect/mosaic/arrow:{x1,y1,x2,y2}
   */
  function create(marks, type, p, imgW, imgH) {
    var id = makeId();
    if (type === 'stamp') {
      if (stampCount(marks) >= MAX_STAMPS) return { error: '番号は1枚の写真に' + MAX_STAMPS + '個までです' };
      var rad = Math.ceil(sizes(imgW, imgH).stamp / 2);
      return { mark: { id: id, type: 'stamp', x: clamp(Math.round(p.x), rad, Math.max(rad, imgW - rad)), y: clamp(Math.round(p.y), rad, Math.max(rad, imgH - rad)), no: 0 } };
    }
    if (type === 'rect' || type === 'mosaic') {
      var b = normBox(p.x1, p.y1, p.x2, p.y2, imgW, imgH);
      if (!b) return { error: 'small' };
      return { mark: { id: id, type: type, x: b.x, y: b.y, w: b.w, h: b.h } };
    }
    if (type === 'arrow') {
      var x1 = clamp(Math.round(p.x1), 0, imgW), y1 = clamp(Math.round(p.y1), 0, imgH);
      var x2 = clamp(Math.round(p.x2), 0, imgW), y2 = clamp(Math.round(p.y2), 0, imgH);
      if (Math.hypot(x2 - x1, y2 - y1) < MIN_ARROW) return { error: 'small' };
      return { mark: { id: id, type: 'arrow', x1: x1, y1: y1, x2: x2, y2: y2 } };
    }
    if (type === 'text') {
      var t = cleanText(p.text);
      if (!t) return { error: len(String(p.text || '').trim()) > MAX_TEXT ? '文字は' + MAX_TEXT + '字までです' : '先に文字を書いてください' };
      var tb = textBox({ x: 0, y: 0, text: t }, imgW, imgH);
      return { mark: { id: id, type: 'text', x: clamp(Math.round(p.x), 0, Math.max(0, imgW - tb.w)), y: clamp(Math.round(p.y), 0, Math.max(0, imgH - tb.h)), text: t } };
    }
    return { error: 'type' };
  }

  function add(marks, mark) { return renumber(marks.concat([mark])); }
  function remove(marks, id) { return renumber(marks.filter(function (m) { return m.id !== id; })); }
  function update(marks, id, patch) { return marks.map(function (m) { return m.id === id ? Object.assign({}, m, patch) : m; }); }

  // 文字の印の大きさ（当たり判定・描画で同じ値を使う）。1字＝font の幅とみなす（全角の目安）
  function textBox(m, imgW, imgH) {
    var s = sizes(imgW, imgH), pad = Math.round(s.font * 0.3);
    var w = 0; Array.from(m.text).forEach(function (c) { w += /[\x20-\x7e]/.test(c) ? s.font * 0.6 : s.font; });
    return { x: m.x, y: m.y, w: Math.round(w) + pad * 2, h: Math.round(s.font * 1.3) + pad * 2, pad: pad, font: s.font };
  }

  // 印の外わくの四角
  function bounds(m, imgW, imgH) {
    var s = sizes(imgW, imgH);
    if (m.type === 'stamp') return { x: m.x - s.stamp / 2, y: m.y - s.stamp / 2, w: s.stamp, h: s.stamp };
    if (m.type === 'rect' || m.type === 'mosaic') return { x: m.x, y: m.y, w: m.w, h: m.h };
    if (m.type === 'arrow') return { x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2), w: Math.abs(m.x2 - m.x1), h: Math.abs(m.y2 - m.y1) };
    var t = textBox(m, imgW, imgH); return { x: t.x, y: t.y, w: t.w, h: t.h };
  }

  function distToSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    var t = l2 ? clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  var ORDER = { mosaic: 0, rect: 1, arrow: 2, text: 3, stamp: 4 }; // 描く順（下から）

  // 押した所にある印（上に描かれる物を選ぶ）。なければ null
  function hit(marks, x, y, imgW, imgH) {
    var s = sizes(imgW, imgH), tol = s.line + 4;
    var best = null;
    marks.forEach(function (m, idx) {
      var on = false;
      if (m.type === 'stamp') on = Math.hypot(x - m.x, y - m.y) <= s.stamp / 2 + 2;
      else if (m.type === 'text') { var b = textBox(m, imgW, imgH); on = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
      else if (m.type === 'arrow') on = distToSeg(x, y, m.x1, m.y1, m.x2, m.y2) <= tol;
      else if (m.type === 'rect') {
        var inOuter = x >= m.x - tol && x <= m.x + m.w + tol && y >= m.y - tol && y <= m.y + m.h + tol;
        var inInner = x > m.x + tol && x < m.x + m.w - tol && y > m.y + tol && y < m.y + m.h - tol;
        on = inOuter && !inInner;
      } else if (m.type === 'mosaic') on = x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h;
      if (!on) return;
      var key = ORDER[m.type] * 1000 + idx;
      if (!best || key > best.key) best = { key: key, id: m.id };
    });
    return best ? best.id : null;
  }

  // 動かす（写真の端で止まる）
  function move(marks, id, dx, dy, imgW, imgH) {
    return marks.map(function (m) {
      if (m.id !== id) return m;
      var b = bounds(m, imgW, imgH);
      var ddx = clamp(dx, -b.x, imgW - (b.x + b.w)), ddy = clamp(dy, -b.y, imgH - (b.y + b.h));
      if (m.type === 'stamp') { var rr = Math.ceil(b.w / 2); ddx = clamp(dx, rr - m.x, Math.max(rr, imgW - rr) - m.x); ddy = clamp(dy, rr - m.y, Math.max(rr, imgH - rr) - m.y); }
      if (m.type === 'text') { ddx = clamp(dx, -m.x, Math.max(0, imgW - b.w) - m.x); ddy = clamp(dy, -m.y, Math.max(0, imgH - b.h) - m.y); }
      ddx = Math.round(ddx); ddy = Math.round(ddy);
      if (m.type === 'arrow') return Object.assign({}, m, { x1: m.x1 + ddx, y1: m.y1 + ddy, x2: m.x2 + ddx, y2: m.y2 + ddy });
      return Object.assign({}, m, { x: m.x + ddx, y: m.y + ddy });
    });
  }

  // 元に戻す用の記録（古い物から捨てる）
  function pushHistory(history, marks) {
    var h = history.concat([marks]);
    return h.length > MAX_HISTORY ? h.slice(h.length - MAX_HISTORY) : h;
  }
  function undo(history, marks) {
    if (!history.length) return { history: history, marks: marks, done: false };
    return { history: history.slice(0, -1), marks: history[history.length - 1], done: true };
  }

  function summary(marks) {
    var c = { stamp: 0, rect: 0, arrow: 0, mosaic: 0, text: 0 };
    marks.forEach(function (m) { c[m.type]++; });
    return c;
  }

  var api = { sizes: sizes, toImage: toImage, normBox: normBox, cleanText: cleanText, create: create, add: add, remove: remove,
    update: update, renumber: renumber, textBox: textBox, bounds: bounds, hit: hit, move: move, pushHistory: pushHistory,
    undo: undo, summary: summary, ORDER: ORDER, MAX_STAMPS: MAX_STAMPS, MAX_TEXT: MAX_TEXT, MAX_HISTORY: MAX_HISTORY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Marks = api;
})(this);
