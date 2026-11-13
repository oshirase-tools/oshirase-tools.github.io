// 画面の動き（取り込み・道具の切り替え・一覧・印刷）。ブラウザ用
// 使う人が書いた文は textContent でだけ画面に出す。外へは何も送らない
(function () {
  'use strict';
  var M = window.Marks, L = window.Layout, D = window.Draw;
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  var doc = { title: '', perPage: 2, steps: [], currentId: null };
  var tool = 'stamp', selectedId = null;
  var curImg = null, curImgId = null;   // いま出している手順の写真（絵に戻した物）
  var drag = null;                      // なぞっている途中
  var printedOnce = false, shrinkNoted = false, busy = false, rafId = 0;
  var cv = $('cv');

  var HELP = {
    select: '選ぶ：印を押すと選べます（青い点線）。そのままなぞると動きます。Delete キーか「この印を消す」で消せます。',
    stamp: '①番号：写真の上を押すと、赤い丸の番号が付きます。置いた順に 1、2、3… と振ります（1枚に20個まで）。',
    rect: '□枠：写真の上をなぞると、赤い枠が付きます。',
    arrow: '→矢印：なぞった始まりから終わりへ、赤い矢印が付きます（終わりに矢じり）。',
    mosaic: '▦モザイク：なぞった四角の中を、大きなマスで塗りつぶして読みにくくします。パスワードや番号などは、写さずに撮り直すのが確実です。',
    text: 'A文字：先に下の欄に文字を書き、写真の上を押すと置けます。選んだ文字の印は、欄で直せます。'
  };

  function msg(text, type) { var m = $('msg'); m.textContent = text || ''; m.className = 'msgbar' + (type ? ' ' + type : ''); }
  function cur() { for (var i = 0; i < doc.steps.length; i++) if (doc.steps[i].id === doc.currentId) return doc.steps[i]; return null; }
  function curIndex() { for (var i = 0; i < doc.steps.length; i++) if (doc.steps[i].id === doc.currentId) return i; return -1; }
  function len(s) { return Array.from(s || '').length; }
  function makeId() { try { return crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); } }
  function inField(t) { t = t || document.activeElement; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }

  // ---- 画面の幅 ----
  function checkWidth() { $('narrow').hidden = window.innerWidth >= 1024; }
  window.addEventListener('resize', checkWidth); checkWidth();

  // ---- 道具 ----
  function setTool(t) {
    tool = t;
    Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tool') === t ? 'true' : 'false'); });
    $('tool-help').textContent = HELP[t];
    cv.classList.toggle('sel', t === 'select');
    if (t !== 'select') select(null);
    if (t === 'text') $('text-in').focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (b) {
    b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
  });

  // ---- 取り込み ----
  function decode(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise(function (ok, ng) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); ok(im); };
      im.onerror = function () { URL.revokeObjectURL(u); ng(new Error('decode')); };
      im.src = u;
    });
  }
  function toBlob(canvas) { return new Promise(function (ok, ng) { canvas.toBlob(function (b) { b ? ok(b) : ng(new Error('toBlob')); }, 'image/png'); }); }
  function closeImg(im) { try { if (im && im.close) im.close(); } catch (e) {} }

  // 写真1枚を手順にする。だめなら理由の文を返す
  function ingest(file) {
    var bad = L.checkFile(file.type, file.size);
    if (bad) return Promise.resolve(bad);
    return decode(file).then(function (im) {
      var w = im.width, h = im.height;
      var bad2 = L.checkSize(w, h);
      if (bad2) { closeImg(im); return bad2; }
      var s = L.shrink(w, h);
      if (s.shrunk) shrinkNoted = true;
      var c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
      var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, 0, 0, s.w, s.h);
      closeImg(im);
      return toBlob(c).then(function (b) {
        c.width = c.height = 0;
        if (doc.steps.length >= L.MAX_STEPS) return '20枚まで入っています';
        var step = { id: makeId(), image: { blob: b, width: s.w, height: s.h }, caption: '', marks: [], history: [] };
        doc.steps.push(step);
        return { step: step };
      });
    }).catch(function () { return '読み込めませんでした（こわれているか、対応していない写真です）'; });
  }

  function busyMsg() { msg('読み込み中・印刷の用意中です。終わってからもう一度操作してください', 'warn'); }
  function addFiles(files) {
    if (busy) { if (files && files.length) busyMsg(); return; }
    files = Array.prototype.filter.call(files || [], function (f) { return f && f.type !== undefined; });
    if (!files.length) return;
    busy = true; msg('読み込んでいます…');
    var room = L.MAX_STEPS - doc.steps.length;
    var take = files.slice(0, Math.max(0, room)), skipped = files.length - take.length;
    var reasons = [], added = null, n = 0;
    shrinkNoted = false;
    take.reduce(function (p, f) {
      return p.then(function () { return ingest(f).then(function (r) { if (typeof r === 'string') reasons.push(r); else { n++; if (!added) added = r.step; } }); });
    }, Promise.resolve()).then(function () {
      busy = false;
      if (added) show(added.id); else refreshList();
      var parts = [];
      if (n) parts.push(n + '枚入れました');
      if (shrinkNoted) parts.push('大きい写真を縮めました');
      if (skipped > 0) parts.push(skipped + '枚は入れませんでした（20枚まで）');
      if (reasons.length) parts.push(reasons.length + '枚は入れませんでした：' + reasons[0]);
      msg(parts.join('。'), (skipped > 0 || reasons.length) ? 'warn' : '');
    });
  }

  $('pick').addEventListener('click', function () { $('file').click(); });
  $('add-file').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function () { addFiles(Array.prototype.slice.call(this.files)); this.value = ''; });

  var stage = $('stage');
  ['dragenter', 'dragover'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); stage.classList.add('over'); } });
  });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) stage.classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    stage.classList.remove('over');
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    addFiles(Array.prototype.slice.call(e.dataTransfer.files));
  });
  document.addEventListener('paste', function (e) {
    if (inField(e.target)) return;                     // 入力欄ではふつうの貼り付け
    var items = (e.clipboardData && e.clipboardData.items) || [], files = [];
    for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { var f = items[i].getAsFile(); if (f) files.push(f); }
    if (!files.length) return;
    e.preventDefault(); addFiles(files);
  });

  // 見本（作り話の画面）
  $('sample').addEventListener('click', function () {
    if (busy) { busyMsg(); return; }
    if (doc.steps.length >= L.MAX_STEPS) { msg('20枚まで入っています', 'warn'); return; }
    var s = D.sampleCanvas();
    busy = true;
    toBlob(s.canvas).then(function (b) {
      busy = false;
      if (doc.steps.length >= L.MAX_STEPS) { msg('20枚まで入っています', 'warn'); return; }
      var step = { id: makeId(), image: { blob: b, width: s.w, height: s.h }, caption: '右下の「申請する」を押します。名前の欄は見本のためモザイクをかけています。', marks: [], history: [] };
      s.marks.forEach(function (d) { var r = M.create(step.marks, d.type, d.p, s.w, s.h); if (r.mark) step.marks = M.add(step.marks, r.mark); });
      doc.steps.push(step);
      if (!$('title').value) { $('title').value = '経費の申請のしかた（見本）'; onTitle(); }
      show(step.id);
      msg('見本を入れました（作り話の画面です）');
    }).catch(function () { busy = false; msg('見本を入れられませんでした', 'err'); });
  });

  // ---- 手順の一覧 ----
  function refreshList() {
    var ol = $('step-list'); ol.textContent = '';
    doc.steps.forEach(function (st, i) {
      var li = el('li'); if (st.id === doc.currentId) li.className = 'cur';
      var th = el('canvas', 'thumb'); th.setAttribute('role', 'button'); th.tabIndex = 0;
      th.setAttribute('aria-label', '手順' + (i + 1) + 'を出す');
      th.addEventListener('click', function () { show(st.id); });
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(st.id); } });
      li.appendChild(th);
      var row = el('div', 'row');
      row.appendChild(el('b', null, '手順 ' + (i + 1) + (st.id === doc.currentId ? ' ◀' : '')));
      var up = el('button', 'sub', '↑'); up.type = 'button'; up.disabled = i === 0; up.setAttribute('aria-label', '手順' + (i + 1) + 'を上へ');
      up.addEventListener('click', function () { if (busy) { busyMsg(); return; } swap(i, i - 1); });
      var dn = el('button', 'sub', '↓'); dn.type = 'button'; dn.disabled = i === doc.steps.length - 1; dn.setAttribute('aria-label', '手順' + (i + 1) + 'を下へ');
      dn.addEventListener('click', function () { if (busy) { busyMsg(); return; } swap(i, i + 1); });
      var x = el('button', 'sub', '×'); x.type = 'button'; x.setAttribute('aria-label', '手順' + (i + 1) + 'を消す');
      x.addEventListener('click', function () { if (busy) { busyMsg(); return; } removeStep(st.id); });
      row.appendChild(up); row.appendChild(dn); row.appendChild(x);
      li.appendChild(row); ol.appendChild(li);
      drawThumb(st, th, true);
    });
    $('step-count').textContent = '(' + doc.steps.length + '/' + L.MAX_STEPS + ')';
    $('print').disabled = doc.steps.length === 0;
    var has = doc.steps.length > 0;
    $('drop').hidden = has; cv.hidden = !has; stage.classList.toggle('has', has);
    if (!has) { cv.width = cv.height = 0; closeImg(curImg); curImg = null; curImgId = null; }
    $('cap-box').hidden = !has;
    if (!has) { $('mark-sum').textContent = ''; }
  }
  // 小さな画像は手順ごとに覚えておき、印が変わったときだけ作り直す
  function drawThumb(st, th, useCache) {
    var w = 176, h = Math.max(1, Math.round(st.image.height * w / st.image.width));
    if (useCache && st.thumb) { th.width = w; th.height = h; th.getContext('2d').drawImage(st.thumb, 0, 0); return; }
    var full = document.createElement('canvas');
    var done = function (im) {
      D.render(full, im, st.image.width, st.image.height, st.marks);
      var t = st.thumb || document.createElement('canvas'); t.width = w; t.height = h;
      t.getContext('2d').drawImage(full, 0, 0, w, h); st.thumb = t;
      th.width = w; th.height = h; th.getContext('2d').drawImage(t, 0, 0);
      full.width = full.height = 0;
    };
    if (st.id === curImgId && curImg) done(curImg);
    else decode(st.image.blob).then(function (im) { done(im); closeImg(im); }).catch(function () {});
  }
  function thumbOf(id) {
    var i = -1; doc.steps.forEach(function (s, k) { if (s.id === id) i = k; });
    var li = $('step-list').children[i]; return li ? li.querySelector('canvas') : null;
  }
  function swap(a, b) {
    if (b < 0 || b >= doc.steps.length) return;
    var t = doc.steps[a]; doc.steps[a] = doc.steps[b]; doc.steps[b] = t;
    refreshList(); updateCapLabel();
  }
  function removeStep(id) {
    var i = -1; doc.steps.forEach(function (s, k) { if (s.id === id) i = k; });
    if (i < 0) return;
    if (!window.confirm('手順' + (i + 1) + 'を消します。元に戻せません。')) return;
    doc.steps.splice(i, 1);
    if (doc.currentId === id) {
      doc.currentId = null; closeImg(curImg); curImg = null; curImgId = null; selectedId = null;
      var next = doc.steps[Math.min(i, doc.steps.length - 1)];
      if (next) { show(next.id); return; }
    }
    updateCapLabel();
    refreshList();
  }

  // ---- 手順を出す ----
  function show(id) {
    doc.currentId = id; selectedId = null; drag = null;
    var st = cur(); if (!st) { refreshList(); return; }
    $('caption').value = st.caption; onCaptionCount();
    updateCapLabel();
    refreshList();
    if (curImgId === id && curImg) { redraw(); return; }
    decode(st.image.blob).then(function (im) {
      if (doc.currentId !== id) { closeImg(im); return; }
      closeImg(curImg); curImg = im; curImgId = id; redraw();
    }).catch(function () { msg('写真を出せませんでした', 'err'); });
  }
  function updateCapLabel() { var i = curIndex(); $('cap-label').textContent = i >= 0 ? '手順' + (i + 1) + ' の説明文' : '説明文'; }

  function redraw(preview) {
    var st = cur(); if (!st || !curImg || curImgId !== st.id) return;
    D.render(cv, curImg, st.image.width, st.image.height, st.marks, { selectedId: selectedId, preview: preview || null });
    var c = M.summary(st.marks), parts = [];
    if (c.stamp) parts.push('番号' + c.stamp); if (c.rect) parts.push('枠' + c.rect); if (c.arrow) parts.push('矢印' + c.arrow);
    if (c.mosaic) parts.push('モザイク' + c.mosaic); if (c.text) parts.push('文字' + c.text);
    $('mark-sum').textContent = '印 ' + st.marks.length + 'つ' + (parts.length ? '（' + parts.join('・') + '）' : '');
    $('del-mark').disabled = !selectedId;
    $('undo').disabled = !st.history.length;
  }
  function redrawSoon(preview) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () { rafId = 0; redraw(preview); });
  }
  function commit(st, marks) {
    st.history = M.pushHistory(st.history, st.marks);
    st.marks = marks;
    redraw();
    var th = thumbOf(st.id); if (th) drawThumb(st, th);
  }

  function select(id) {
    selectedId = id;
    var st = cur();
    if (st && id) {
      var m = st.marks.filter(function (x) { return x.id === id; })[0];
      if (m && m.type === 'text') { $('text-in').value = m.text; onTextCount(); }
    }
    textEditPushed = false;
    redraw();
  }

  // ---- キャンバスの操作 ----
  function pos(e) {
    var st = cur(), r = cv.getBoundingClientRect();
    var p = M.toImage(e.clientX - r.left, e.clientY - r.top, r.width, r.height, st.image.width, st.image.height);
    return { x: Math.max(0, Math.min(st.image.width, p.x)), y: Math.max(0, Math.min(st.image.height, p.y)) };
  }
  cv.addEventListener('pointerdown', function (e) {
    var st = cur(); if (!st || !curImg || e.button !== 0) return;
    e.preventDefault();
    if (busy) { busyMsg(); return; }
    var p = pos(e), w = st.image.width, h = st.image.height;
    if (tool === 'stamp' || tool === 'text') {
      var r = M.create(st.marks, tool, { x: p.x, y: p.y, text: $('text-in').value }, w, h);
      if (r.error) { msg(r.error, 'warn'); if (tool === 'text') $('text-in').focus(); return; }
      commit(st, M.add(st.marks, r.mark)); msg('');
      return;
    }
    if (tool === 'select') {
      var id = M.hit(st.marks, p.x, p.y, w, h);
      select(id);
      if (id) { drag = { kind: 'move', id: id, sx: p.x, sy: p.y, cx: e.clientX, cy: e.clientY, base: st.marks, moved: false }; cv.classList.add('move'); }
    } else {
      drag = { kind: tool, sx: p.x, sy: p.y };
    }
    if (drag) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var st = cur(); if (!st) return;
    var p = pos(e), w = st.image.width, h = st.image.height;
    if (drag.kind === 'move') {
      var dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (!drag.moved && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < 5) return;   // 画面の上で5px 未満は手ぶれとみなす
      drag.moved = true;
      st.marks = M.move(drag.base, drag.id, dx, dy, w, h);
      redrawSoon();
      return;
    }
    drag.ex = p.x; drag.ey = p.y;
    var pv;
    if (drag.kind === 'arrow') pv = { type: 'arrow', x1: drag.sx, y1: drag.sy, x2: p.x, y2: p.y };
    else pv = { type: drag.kind, x: Math.min(drag.sx, p.x), y: Math.min(drag.sy, p.y), w: Math.abs(p.x - drag.sx), h: Math.abs(p.y - drag.sy) };
    redrawSoon(pv);
  });
  function endDrag(e, cancel) {
    if (!drag) return;
    var d = drag; drag = null; cv.classList.remove('move');
    var st = cur(); if (!st) return;
    if (d.kind === 'move') {
      if (!d.moved) return;
      var moved = st.marks; st.marks = d.base;
      if (cancel) { redraw(); return; }
      commit(st, moved);
      var mv = st.marks.filter(function (x) { return x.id === d.id; })[0];
      if (mv && mv.type === 'mosaic') msg('モザイクを動かしました。隠したい所が隠れているか確かめてください', 'warn');
      return;
    }
    if (cancel || d.ex === undefined) { redraw(); return; }
    var r = M.create(st.marks, d.kind, { x1: d.sx, y1: d.sy, x2: d.ex, y2: d.ey }, st.image.width, st.image.height);
    if (r.error) { redraw(); if (r.error !== 'small') msg(r.error, 'warn'); return; }
    commit(st, M.add(st.marks, r.mark)); msg('');
  }
  cv.addEventListener('pointerup', function (e) { endDrag(e, false); });
  cv.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  // ---- 元に戻す・消す ----
  function undo() {
    if (busy) { busyMsg(); return; }
    var st = cur(); if (!st) return;
    var u = M.undo(st.history, st.marks); if (!u.done) return;
    st.history = u.history; st.marks = u.marks;
    if (selectedId && !st.marks.some(function (m) { return m.id === selectedId; })) selectedId = null;
    redraw(); var th = thumbOf(st.id); if (th) drawThumb(st, th);
  }
  function deleteSelected() {
    if (busy) { busyMsg(); return; }
    var st = cur(); if (!st || !selectedId) return;
    var id = selectedId; selectedId = null;
    commit(st, M.remove(st.marks, id));
  }
  $('undo').addEventListener('click', undo);
  $('del-mark').addEventListener('click', deleteSelected);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); if (doc.steps.length) $('print').click(); else msg('先に写真を入れてください', 'warn'); return; }
    if (e.key === 'Escape') { if (drag) { endDrag(null, true); } else if (selectedId) select(null); return; }
    if (inField(e.target)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); }
  });

  // ---- 文字・タイトル・説明文 ----
  var textEditPushed = false;
  function onTextCount() { $('text-len').textContent = len($('text-in').value) + '/' + M.MAX_TEXT; }
  $('text-in').addEventListener('input', function () {
    onTextCount();
    var st = cur(); if (!st || !selectedId) return;
    var m = st.marks.filter(function (x) { return x.id === selectedId; })[0];
    if (!m || m.type !== 'text') return;
    if (busy) { busyMsg(); return; }
    var t = M.cleanText(this.value); if (!t) return;     // 空のときは印を変えない
    if (!textEditPushed) { st.history = M.pushHistory(st.history, st.marks); textEditPushed = true; }
    st.marks = M.move(M.update(st.marks, m.id, { text: t }), m.id, 0, 0, st.image.width, st.image.height);   // 長くなっても写真の中に収め直す
    redraw(); var th = thumbOf(st.id); if (th) drawThumb(st, th);
  });
  $('text-in').addEventListener('focus', function () { textEditPushed = false; });
  $('text-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });

  function onTitle() {
    var t = $('title').value;
    if (!L.titleOk(t)) { t = Array.from(t).slice(0, L.MAX_TITLE).join(''); $('title').value = t; }
    doc.title = t; $('title-len').textContent = len(t) + '/' + L.MAX_TITLE;
  }
  $('title').addEventListener('input', onTitle);
  $('per-page').addEventListener('change', function () { doc.perPage = this.value === '1' ? 1 : 2; });

  var lastCaption = '';
  function onCaptionCount() { lastCaption = $('caption').value; $('cap-len').textContent = len(lastCaption) + '/' + L.MAX_CAPTION + '（3行まで）'; }
  function captionCheck(box) {
    if (!L.captionOk(box.value)) { box.value = lastCaption; msg('説明文は150字・紙で3行（1行48字）までです', 'warn'); return; }
    var st = cur(); if (st) st.caption = box.value;
    onCaptionCount();
  }
  $('caption').addEventListener('compositionend', function () { captionCheck(this); });
  $('caption').addEventListener('input', function (e) {
    if (e.isComposing) return;   // 変換中は確定してから確かめる
    if (!L.captionOk(this.value)) { this.value = lastCaption; msg('説明文は150字・紙で3行（1行48字）までです', 'warn'); return; }
    var st = cur(); if (st) st.caption = this.value;
    onCaptionCount();
  });

  // ---- 1手順の PNG 保存 ----
  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 10000);
  }
  function bake(st) {
    var c = document.createElement('canvas');
    var go = function (im) { D.render(c, im, st.image.width, st.image.height, st.marks); return toBlob(c).then(function (b) { c.width = c.height = 0; return b; }); };
    if (st.id === curImgId && curImg) return go(curImg);
    return decode(st.image.blob).then(function (im) { return go(im).then(function (b) { closeImg(im); return b; }); });
  }
  $('save-png').addEventListener('click', function () {
    var st = cur(), i = curIndex(); if (!st) return;
    bake(st).then(function (b) { download(b, 'tejun_' + String(i + 1).padStart(2, '0') + '.png'); msg('PNG を保存しました'); })
      .catch(function () { msg('保存できませんでした', 'err'); });
  });

  // ---- 印刷・PDF ----
  var printUrls = [];
  function clearPrint() { printUrls.forEach(function (u) { URL.revokeObjectURL(u); }); printUrls = []; $('print-area').textContent = ''; }
  $('print').addEventListener('click', function () {
    if (!doc.steps.length || busy) return;
    if (!printedOnce && !window.confirm('名前・メールアドレス・ページの住所欄（URL）・通知・社内の数字が写っていないか、確かめましたか？\n（OK で印刷の画面を開きます）')) return;
    printedOnce = true; busy = true; msg('印刷の用意をしています…');
    clearPrint();
    doc.perPage = $('per-page').value === '1' ? 1 : 2;
    var title = doc.title.trim();
    var area = $('print-area'), steps = doc.steps.slice(), pages = L.pages(steps.length, doc.perPage), imgs = [];
    steps.reduce(function (p, st) { return p.then(function (arr) { return bake(st).then(function (b) { arr.push(b); return arr; }); }); }, Promise.resolve([]))
      .then(function (blobs) {
        pages.forEach(function (pg) {
          var page = el('div', 'page');
          if (title) page.appendChild(el(pg.showBigTitle ? 'h1' : 'p', pg.showBigTitle ? 't-big' + (L.titleLong(title) ? ' long' : '') : 't-small', title));
          pg.stepIndexes.forEach(function (si) {
            var st = steps[si], box = el('div', 'step');
            box.appendChild(el('h3', null, '手順 ' + (si + 1)));
            var ph = el('div', 'ph'), im = new Image(), u = URL.createObjectURL(blobs[si]);
            printUrls.push(u); im.src = u; im.alt = '手順' + (si + 1) + 'の画面';
            var f = L.fit(st.image.width, st.image.height, doc.perPage);
            im.style.width = f.w + 'mm'; im.style.height = f.h + 'mm';
            ph.appendChild(im); box.appendChild(ph); imgs.push(im);
            if (st.caption) box.appendChild(el('p', 'cap', st.caption));
            page.appendChild(box);
          });
          page.appendChild(el('p', 'no', pg.pageNo + ' / ' + pg.totalPages));
          area.appendChild(page);
        });
        return Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }));
      })
      .then(function () { busy = false; msg(''); window.print(); })
      .catch(function () { busy = false; clearPrint(); msg('印刷の用意ができませんでした', 'err'); });
  });
  window.addEventListener('afterprint', function () { setTimeout(clearPrint, 500); });

  // ---- 閉じる前の注意 ----
  window.addEventListener('beforeunload', function (e) { if (doc.steps.length) { e.preventDefault(); e.returnValue = ''; } });

  doc.perPage = $('per-page').value === '1' ? 1 : 2;
  setTool('stamp');
  refreshList();
})();
