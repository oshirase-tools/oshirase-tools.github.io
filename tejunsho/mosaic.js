// モザイクの計算（画素の並びを受け取って、マスごとの平均の色で塗る）。純粋な関数
// 写真の画素そのものを塗りかえる。元の写真の上に絵を重ねる作りにはしない（元の画素が出力に残らないように）
(function (root) {
  'use strict';

  function cellSize(w, h) { return Math.max(16, Math.round(Math.max(w, h) / 100)); }
  // モザイクの四角ごとのマス。1行の欄（短い辺64px以下）は縦を1マスにし、大きい字でも形が残らないようにする
  function cellFor(imgW, imgH, boxW, boxH) {
    var s = Math.round(Math.min(boxW, boxH)), base = cellSize(imgW, imgH);
    if (s <= 64) return Math.max(base, s);
    return Math.max(base, Math.min(s, 48));
  }

  /**
   * data（RGBA の並び、幅 W・高さ H）の四角 (x,y,w,h) を、cell のマスで塗る。data をその場で書きかえる
   * マスの区切りは四角の左上から数える。写真の外にはみ出した分は切る
   */
  function apply(data, W, H, x, y, w, h, cell) {
    var x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    var x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
    if (x1 <= x0 || y1 <= y0) return data;
    cell = Math.max(1, Math.floor(cell));
    for (var cy = y0; cy < y1; cy += cell) {
      var ey = Math.min(cy + cell, y1);
      for (var cx = x0; cx < x1; cx += cell) {
        var ex = Math.min(cx + cell, x1);
        var r = 0, g = 0, b = 0, a = 0, n = 0, px, py, i;
        for (py = cy; py < ey; py++) for (px = cx; px < ex; px++) {
          i = (py * W + px) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n++;
        }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n); a = Math.round(a / n);
        for (py = cy; py < ey; py++) for (px = cx; px < ex; px++) {
          i = (py * W + px) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
        }
      }
    }
    return data;
  }

  var api = { cellSize: cellSize, cellFor: cellFor, apply: apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mosaic = api;
})(this);
