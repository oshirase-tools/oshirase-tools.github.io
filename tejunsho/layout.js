// A4 への並べ方と、取り込みの判定。純粋な関数
(function (root) {
  'use strict';
  var MAX_STEPS = 20, MAX_BYTES = 15 * 1024 * 1024, MAX_SIDE = 8000, MIN_SIDE = 50, SHRINK_TO = 2000;
  var MAX_TITLE = 40, MAX_CAPTION = 150, MAX_CAPTION_BREAKS = 2, CAPTION_LINE = 48, TITLE_ONE_LINE = 29;
  var TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  var BOX = { 1: { w: 186, h: 205 }, 2: { w: 186, h: 90 } }; // 写真の枠（mm）

  function len(s) { return Array.from(s || '').length; }

  // ファイルを入れてよいか（形式と大きさだけ。縦横は読み込んだ後で checkSize）
  function checkFile(type, bytes) {
    if (TYPES.indexOf(type) < 0) return 'この形式は入れられません（PNG・JPEG・WebP のみ）';
    if (bytes > MAX_BYTES) return '大きすぎます（1枚15MBまで）';
    return null;
  }
  function checkSize(w, h) {
    if (Math.max(w, h) > MAX_SIDE) return '大きすぎます（長い辺 8,000px まで）';
    if (Math.min(w, h) < MIN_SIDE) return '小さすぎます（短い辺 50px 以上）';
    return null;
  }
  // 長い辺が 2,000px を超えたら縮める
  function shrink(w, h) {
    var L = Math.max(w, h);
    if (L <= SHRINK_TO) return { w: w, h: h, shrunk: false };
    var k = SHRINK_TO / L;
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), shrunk: true };
  }

  function titleOk(t) { return len(t) <= MAX_TITLE; }
  // 紙での行数（1行48字で折り返す。半角は0.5字）
  function captionLines(c) {
    return String(c || '').split('\n').reduce(function (n, para) {
      var w = 0; Array.from(para).forEach(function (ch) { w += /[\x20-\x7e]/.test(ch) ? 0.5 : 1; });
      return n + Math.max(1, Math.ceil(w / CAPTION_LINE));
    }, 0);
  }
  function captionOk(c) { return len(c) <= MAX_CAPTION && captionLines(c) <= MAX_CAPTION_BREAKS + 1; }
  function titleLong(t) { return len(t) > TITLE_ONE_LINE; }

  // 印刷のページ
  function pages(nSteps, perPage) {
    perPage = perPage === 1 ? 1 : 2;
    var total = Math.ceil(nSteps / perPage), out = [];
    for (var p = 0; p < total; p++) {
      var idx = [];
      for (var k = 0; k < perPage && p * perPage + k < nSteps; k++) idx.push(p * perPage + k);
      out.push({ pageNo: p + 1, totalPages: total, showBigTitle: p === 0, stepIndexes: idx });
    }
    return out;
  }

  // 写真を枠に、縦横の比を変えずに収めた大きさ（mm）
  function fit(imgW, imgH, perPage) {
    var b = BOX[perPage === 1 ? 1 : 2];
    var k = Math.min(b.w / imgW, b.h / imgH);
    return { w: Math.round(imgW * k * 10) / 10, h: Math.round(imgH * k * 10) / 10 };
  }

  var api = { captionLines: captionLines, titleLong: titleLong, checkFile: checkFile, checkSize: checkSize, shrink: shrink, titleOk: titleOk, captionOk: captionOk, pages: pages, fit: fit,
    MAX_STEPS: MAX_STEPS, MAX_BYTES: MAX_BYTES, MAX_TITLE: MAX_TITLE, MAX_CAPTION: MAX_CAPTION, MAX_CAPTION_BREAKS: MAX_CAPTION_BREAKS, BOX: BOX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Layout = api;
})(this);
