// キャンバスへ描く（写真＋印を1枚に焼き付ける）。ブラウザ用
// 編集の画面・左の小さな画像・PNG・印刷は、すべてこの描き方で作る
(function (root) {
  'use strict';
  var M = root.Marks, Z = root.Mosaic;
  var RED = '#E60012';
  var FONT = "'Meiryo', 'Yu Gothic', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif";

  function drawArrow(ctx, m, s) {
    var ang = Math.atan2(m.y2 - m.y1, m.x2 - m.x1), head = s.head;
    var bx = m.x2 - Math.cos(ang) * head * 0.8, by = m.y2 - Math.sin(ang) * head * 0.8;
    ctx.strokeStyle = RED; ctx.lineWidth = s.line; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = RED; ctx.beginPath();
    ctx.moveTo(m.x2, m.y2);
    ctx.lineTo(m.x2 - Math.cos(ang - 0.45) * head, m.y2 - Math.sin(ang - 0.45) * head);
    ctx.lineTo(m.x2 - Math.cos(ang + 0.45) * head, m.y2 - Math.sin(ang + 0.45) * head);
    ctx.closePath(); ctx.fill();
  }

  function drawText(ctx, m, w, h) {
    var b = M.textBox(m, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = RED; ctx.font = 'bold ' + b.font + 'px ' + FONT; ctx.textBaseline = 'middle';
    ctx.fillText(m.text, b.x + b.pad, b.y + b.h / 2, b.w - b.pad * 2);
  }

  function drawStamp(ctx, m, s) {
    var r = s.stamp / 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fillStyle = RED; ctx.fill();
    ctx.lineWidth = Math.max(2, Math.round(r / 8)); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(s.stamp * (m.no >= 10 ? 0.5 : 0.6)) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(m.no), m.x, m.y + 1);
    ctx.textAlign = 'start';
  }

  /**
   * canvas に写真と印を描く。canvas の大きさは写真と同じ画素数にする
   * @param {CanvasImageSource} img 縮めた後の写真
   * @param {object} opt { selectedId, preview: 描きかけの印 }
   */
  function render(canvas, img, w, h, marks, opt) {
    opt = opt || {};
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    var s = M.sizes(w, h);
    var list = marks.slice().sort(function (a, b) { return M.ORDER[a.type] - M.ORDER[b.type]; });
    // 1. モザイク：写真の画素そのものを塗りかえる
    list.forEach(function (m) {
      if (m.type !== 'mosaic') return;
      var x = Math.max(0, m.x), y = Math.max(0, m.y), mw = Math.min(w - x, m.w), mh = Math.min(h - y, m.h);
      if (mw <= 0 || mh <= 0) return;
      var id = ctx.getImageData(x, y, mw, mh);
      Z.apply(id.data, mw, mh, 0, 0, mw, mh, Z.cellFor(w, h, m.w, m.h));
      ctx.putImageData(id, x, y);
    });
    // 2〜5. 枠・矢印・文字・番号
    list.forEach(function (m) {
      if (m.type === 'rect') {
        ctx.strokeStyle = RED; ctx.lineWidth = s.line; ctx.lineJoin = 'round';
        ctx.strokeRect(m.x + s.line / 2, m.y + s.line / 2, Math.max(1, m.w - s.line), Math.max(1, m.h - s.line));
      } else if (m.type === 'arrow') drawArrow(ctx, m, s);
      else if (m.type === 'text') drawText(ctx, m, w, h);
      else if (m.type === 'stamp') drawStamp(ctx, m, s);
    });
    // 編集の画面だけ：選んだ印の点線と、描きかけの印
    var dash = function (b, color) {
      ctx.save(); ctx.setLineDash([s.line * 2, s.line * 2]); ctx.lineWidth = Math.max(2, Math.round(s.line / 2));
      ctx.strokeStyle = color; ctx.strokeRect(b.x - s.line, b.y - s.line, b.w + s.line * 2, b.h + s.line * 2); ctx.restore();
    };
    if (opt.selectedId) {
      var sel = marks.filter(function (m) { return m.id === opt.selectedId; })[0];
      if (sel) dash(M.bounds(sel, w, h), '#1a73e8');
    }
    if (opt.preview) {
      var p = opt.preview;
      if (p.type === 'arrow') drawArrow(ctx, p, s);
      else if (p.type === 'rect') { ctx.strokeStyle = RED; ctx.lineWidth = s.line; ctx.strokeRect(p.x, p.y, p.w, p.h); }
      else if (p.type === 'mosaic') dash({ x: p.x, y: p.y, w: p.w, h: p.h }, '#333');
    }
    return canvas;
  }

  // 作り話の見本の画面（架空の経費の申請フォーム）を描く。画像ファイルは使わない
  function sampleCanvas() {
    var w = 1280, h = 760, c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.fillStyle = '#f3f5f8'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2b4c7e'; x.fillRect(0, 0, w, 64);
    x.fillStyle = '#fff'; x.font = 'bold 26px ' + FONT; x.textBaseline = 'middle'; x.fillText('見本の会社　経費の申請（作り話の画面）', 32, 32);
    x.fillStyle = '#fff'; x.fillRect(160, 110, 960, 560);
    x.strokeStyle = '#d0d6e0'; x.lineWidth = 2; x.strokeRect(160, 110, 960, 560);
    x.fillStyle = '#222'; x.font = 'bold 28px ' + FONT; x.fillText('新しい申請', 200, 160);
    var rows = [['申請する人', '見本 太郎'], ['使った日', '2026年11月14日'], ['金額', '1,200 円'], ['使いみち', '打ち合わせの交通費']];
    rows.forEach(function (r, i) {
      var y = 230 + i * 90;
      x.fillStyle = '#555'; x.font = '22px ' + FONT; x.fillText(r[0], 200, y);
      x.fillStyle = '#fff'; x.fillRect(400, y - 26, 520, 52); x.strokeStyle = '#b8c0cc'; x.strokeRect(400, y - 26, 520, 52);
      x.fillStyle = '#222'; x.font = '24px ' + FONT; x.fillText(r[1], 416, y);
    });
    x.fillStyle = '#e8eaee'; x.fillRect(640, 590, 180, 56); x.fillStyle = '#333'; x.font = 'bold 22px ' + FONT; x.fillText('下書き保存', 672, 618);
    x.fillStyle = '#1a73e8'; x.fillRect(840, 590, 180, 56); x.fillStyle = '#fff'; x.fillText('申請する', 884, 618);
    return { canvas: c, w: w, h: h, marks: [
      { type: 'mosaic', p: { x1: 404, y1: 206, x2: 916, y2: 254 } },
      { type: 'stamp', p: { x: 380, y: 410 } },
      { type: 'rect', p: { x1: 830, y1: 580, x2: 1030, y2: 656 } },
      { type: 'stamp', p: { x: 1060, y: 618 } },
      { type: 'arrow', p: { x1: 1180, y1: 470, x2: 1050, y2: 590 } },
      { type: 'text', p: { x: 960, y: 412, text: '最後にここを押す' } }
    ] };
  }

  root.Draw = { render: render, sampleCanvas: sampleCanvas, RED: RED };
})(this);
