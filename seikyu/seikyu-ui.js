/* 見積書・請求書・領収書メーカー - 画面（入力を読む → calc.js で計算 → A4 の見た目を作る）。保存はしない */
(function () {
  'use strict';
  var C = window.SKY.calc, S = window.SKY.sample;
  var SVG = 'http://www.w3.org/2000/svg';
  var KIND = {
    estimate: { title: '御見積書', total: '御見積金額', date: '発行日', due: '有効期限' },
    invoice: { title: '御請求書', total: 'ご請求金額', date: '発行日', due: 'お支払期限' },
    receipt: { title: '領収書', total: '金額', date: '受領日', due: '' }
  };
  var kind = 'invoice';
  var dirty = false;

  function $(id) { return document.getElementById(id); }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'text') e.textContent = props[k];
      else if (k === 'class') e.className = props[k];
      else if (k === 'on') Object.keys(props.on).forEach(function (ev) { e.addEventListener(ev, props.on[ev]); });
      else if (typeof props[k] === 'boolean') e[k] = props[k];
      else e.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function radio(name) { var r = document.querySelector('input[name=' + name + ']:checked'); return r ? r.value : null; }
  function setRadio(name, v) { var r = document.querySelector('input[name=' + name + '][value="' + v + '"]'); if (r) r.checked = true; }

  /* ---------- 品目の行 ---------- */
  function addRow(v) {
    var box = $('items');
    if (box.children.length >= C.MAX_ITEMS) return;
    v = v || { name: '', qty: '1', unit: '式', price: '', rate: 10 };
    var n = box.children.length + 1;
    var rate = h('select', { 'aria-label': n + '行目の税率' }, [
      h('option', { value: '10', text: '10%' }), h('option', { value: '8', text: '8%（軽減）' }), h('option', { value: '0', text: '非課税' })]);
    rate.value = String(v.rate);
    var row = h('div', { class: 'item-row' }, [
      h('input', { type: 'text', class: 'nm', maxlength: '50', 'aria-label': n + '行目の品名', value: v.name, autocomplete: 'off', placeholder: '品名' }),
      h('input', { type: 'text', class: 'qt', inputmode: 'decimal', 'aria-label': n + '行目の数量', value: v.qty, autocomplete: 'off', placeholder: '数量' }),
      h('input', { type: 'text', class: 'un', maxlength: '6', 'aria-label': n + '行目の単位', value: v.unit, autocomplete: 'off', placeholder: '単位' }),
      h('input', { type: 'text', class: 'pr', inputmode: 'numeric', 'aria-label': n + '行目の単価', value: v.price, autocomplete: 'off', placeholder: '単価（円）' }),
      rate,
      h('button', { type: 'button', class: 'del', 'aria-label': n + '行目を消す', text: '×', on: { click: function () { removeRow(row); } } }),
      h('div', { class: 'item-err', role: 'status' })
    ]);
    box.appendChild(row);
    renumber();
  }
  function removeRow(row) {
    var box = $('items');
    if (box.children.length <= 1) { row.querySelector('.nm').value = ''; row.querySelector('.qt').value = '1'; row.querySelector('.un').value = '式'; row.querySelector('.pr').value = ''; row.querySelector('select').value = '10'; }
    else { var next = row.nextElementSibling || row.previousElementSibling; row.remove(); if (next) next.querySelector('input').focus(); }
    renumber(); update();
  }
  function renumber() {
    var rows = $('items').children;
    for (var i = 0; i < rows.length; i++) {
      var n = i + 1, r = rows[i];
      r.querySelector('.nm').setAttribute('aria-label', n + '行目の品名');
      r.querySelector('.qt').setAttribute('aria-label', n + '行目の数量');
      r.querySelector('.un').setAttribute('aria-label', n + '行目の単位');
      r.querySelector('.pr').setAttribute('aria-label', n + '行目の単価');
      r.querySelector('select').setAttribute('aria-label', n + '行目の税率');
      r.querySelector('.del').setAttribute('aria-label', n + '行目を消す');
    }
    $('btnAddRow').disabled = rows.length >= C.MAX_ITEMS;
  }
  function readItems() {
    var out = [];
    Array.prototype.forEach.call($('items').children, function (r) {
      var name = r.querySelector('.nm').value.trim(), qs = r.querySelector('.qt').value, ps = r.querySelector('.pr').value;
      var unit = r.querySelector('.un').value.trim(), rate = parseInt(r.querySelector('select').value, 10);
      var errEl = r.querySelector('.item-err'), qIn = r.querySelector('.qt'), pIn = r.querySelector('.pr');
      qIn.removeAttribute('aria-invalid'); pIn.removeAttribute('aria-invalid'); errEl.textContent = '';
      if (name === '' && ps.trim() === '') { out.push({ name: '', price: null }); return; }
      var q = C.parseQty(qs), p = C.parseYen(ps);
      var err = !q.ok ? q.error : (!p.ok ? p.error : null);
      if (!q.ok) qIn.setAttribute('aria-invalid', 'true');
      if (!p.ok) pIn.setAttribute('aria-invalid', 'true');
      if (err) errEl.textContent = err;
      out.push(err ? { name: name, error: err } : { name: name, unit: unit, qty100: q.value, price: p.value, rate: rate });
    });
    return out;
  }

  /* ---------- 入力を読む ---------- */
  function readDoc() {
    return {
      kind: kind, to: $('fTo').value.trim(), honorific: radio('hon') || '御中',
      issuer: { name: $('fIssuer').value.trim(), addr1: $('fAddr1').value.trim(), addr2: $('fAddr2').value.trim(), tel: $('fTel').value.trim(), mail: $('fMail').value.trim(), regNo: C.normalizeRegNo($('fReg').value) },
      stamp: { type: radio('stamp') || 'none', text: $('fStampText').value.trim() },
      no: $('fNo').value.trim(), date: $('fDate').value, due: $('fDue').value, subject: $('fSubject').value.trim(), receiptFor: $('fReceiptFor').value.trim(),
      items: readItems(), priceMode: radio('pm') || 'excl', rounding: radio('rnd') || 'floor',
      withholding: $('fWh').checked, taxExempt: $('fExempt').checked, bank: $('fBank').value.trim(), note: $('fNote').value.trim()
    };
  }

  /* ---------- 印（SVG） ---------- */
  function stampSvg(type, text) {
    var chars = Array.from(text).slice(0, 8);
    if (type === 'none' || !chars.length) return null;
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'p-stamp'); svg.setAttribute('aria-hidden', 'true');
    var red = '#c8102e';
    var frame = type === 'round' ? document.createElementNS(SVG, 'circle') : document.createElementNS(SVG, 'rect');
    if (type === 'round') { frame.setAttribute('cx', '50'); frame.setAttribute('cy', '50'); frame.setAttribute('r', '46'); }
    else { frame.setAttribute('x', '5'); frame.setAttribute('y', '5'); frame.setAttribute('width', '90'); frame.setAttribute('height', '90'); frame.setAttribute('rx', '4'); }
    frame.setAttribute('fill', 'none'); frame.setAttribute('stroke', red); frame.setAttribute('stroke-width', '5');
    svg.appendChild(frame);
    // 縦書き。右の列から左へ。1列は4字まで
    var n = chars.length, cols = n <= (type === 'round' ? 3 : 2) ? 1 : (n <= 4 && type !== 'round' ? 2 : (n <= 6 ? 2 : 2));
    var rows = Math.ceil(n / cols);
    var box = type === 'round' ? 60 : 76, size = Math.min(box / rows, box / cols) * 0.95;
    var x0 = 50 + (cols - 1) * size / 2, y0 = 50 - (rows - 1) * size / 2;
    chars.forEach(function (ch, i) {
      var c = Math.floor(i / rows), r = i % rows;
      var t = document.createElementNS(SVG, 'text');
      t.setAttribute('x', (x0 - c * size).toFixed(1)); t.setAttribute('y', (y0 + r * size).toFixed(1));
      t.setAttribute('font-size', size.toFixed(1)); t.setAttribute('fill', red);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
      t.textContent = ch;
      svg.appendChild(t);
    });
    return svg;
  }

  /* ---------- A4 の見た目 ---------- */
  function render() {
    var d = readDoc(), res = C.computeDoc(d), K = KIND[kind];
    var paper = $('paper'); clear(paper);
    var isR = kind === 'receipt';
    var big = d.withholding && !isR ? res.payable : res.total;

    if (isR && res.stamp !== 0) paper.appendChild(h('div', { class: 'p-inshi' }, ['収入印紙']));
    paper.appendChild(h('h2', { class: 'p-title', text: K.title }));
    var meta = h('div', { class: 'p-meta' }, [
      d.no ? h('div', { text: 'No. ' + d.no }) : null,
      h('div', { text: (isR ? '' : K.date + '：') + (C.dateJa(d.date) || '　年　月　日') })]);
    var toEl = h('div', { class: 'p-to' }, d.to ? [d.to + '　' + d.honorific] : [h('span', { class: 'empty', text: '（宛名）' }), '　' + d.honorific]);
    paper.appendChild(h('div', { class: 'p-head' }, [toEl, meta]));

    // 発行者
    var iss = h('div', { class: 'p-issuer' }, [
      d.issuer.name ? h('div', { class: 'name', text: d.issuer.name }) : h('div', { class: 'name empty', text: '（発行者）' }),
      d.issuer.addr1 ? h('div', { text: d.issuer.addr1 }) : null,
      d.issuer.addr2 ? h('div', { text: d.issuer.addr2 }) : null,
      d.issuer.tel ? h('div', { text: 'TEL ' + d.issuer.tel }) : null,
      d.issuer.mail ? h('div', { text: d.issuer.mail }) : null,
      C.regNoState(d.issuer.regNo) === 'ok' ? h('div', { class: 'reg', text: '登録番号 ' + d.issuer.regNo }) : null]);
    var st = stampSvg(d.stamp.type, d.stamp.text); if (st) iss.appendChild(st);

    if (isR) {
      paper.appendChild(h('div', { class: 'p-receipt-amount' }, [h('span', { class: 'val', text: C.yenBig(res.total) })]));
      var rf = d.receiptFor || (d.subject ? d.subject + 'の代金' : '');
      paper.appendChild(h('div', { class: 'p-receipt-for', text: '但し　' + (rf || '　　　　') + (/として$/.test(rf) ? '' : '　として') }));
      paper.appendChild(h('div', { class: 'p-receipt-done', text: '上記正に領収いたしました' }));
      paper.appendChild(h('div', { class: 'p-body' }, [h('div', { class: 'p-left' }, [sumTable(res, d, true)]), iss]));
    } else {
      var left = h('div', { class: 'p-left' }, [
        d.subject ? h('p', { class: 'p-subject', text: '件名：' + d.subject }) : null,
        h('p', { text: kind === 'estimate' ? '下記のとおりお見積り申し上げます。' : '下記のとおりご請求申し上げます。' }),
        h('div', { class: 'p-total' }, [h('span', { class: 'lbl', text: d.withholding ? (kind === 'estimate' ? '差引お見積金額' : '差引ご請求額') : K.total }), h('span', { class: 'val', text: C.yenBig(big) }), d.withholding ? null : h('span', { class: 'sub', text: '（税込）' })]),
        d.due ? h('div', { class: 'p-due', text: K.due + '：' + C.dateJa(d.due) }) : null]);
      paper.appendChild(h('div', { class: 'p-body' }, [left, iss]));
      paper.appendChild(itemsTable(res, d));
      paper.appendChild(h('div', { class: 'p-sum' }, [sumTable(res, d, false)]));
      if (kind === 'invoice' && d.bank) paper.appendChild(h('div', { class: 'p-block' }, [h('div', { class: 'h', text: 'お振込先' }), h('div', { class: 't', text: d.bank })]));
    }
    if (d.note) paper.appendChild(h('div', { class: 'p-block' }, [h('div', { class: 'h', text: '備考' }), h('div', { class: 't', text: d.note })]));
    if (res.byRate[8].count && !isR) paper.appendChild(h('div', { class: 'p-mark', text: '※ は軽減税率（8%）の対象です' }));

    // A4 に入らないときは、行の間をつめた小さめの文字にする（それでも入らなければ印刷の前に止める）
    paper.classList.toggle('has-inshi', !!paper.querySelector('.p-inshi'));
    paper.classList.remove('compact');
    if (overflows()) paper.classList.add('compact');
    // Ctrl+P など、ボタンを通らない印刷でも、まちがい・あふれがあれば紙の見本を隠して案内だけを印刷する
    document.body.classList.toggle('cant-print', res.errors.length > 0 || overflows());
    sideInfo(d, res);
    fitPaper();
  }
  function itemsTable(res, d) {
    var tb = h('tbody');
    res.lines.forEach(function (l) {
      tb.appendChild(h('tr', null, [
        h('td', null, [h('div', { class: 'name', text: l.name })]),
        h('td', { class: 'num', text: C.qtyText(l.qty100) }), h('td', { class: 'c', text: l.unit }),
        h('td', { class: 'num', text: C.yen(l.price) }), h('td', { class: 'num', text: C.yen(l.amount) }),
        h('td', { class: 'c', text: l.rate === 0 ? '非課税' : l.rate + '%' + (l.rate === 8 ? '※' : '') })]));
    });
    var head = h('thead', null, [h('tr', null, [h('th', { text: '品名' }), h('th', { text: '数量' }), h('th', { text: '単位' }), h('th', { text: d.priceMode === 'incl' ? '単価（税込）' : '単価' }), h('th', { text: d.priceMode === 'incl' ? '金額（税込）' : '金額' }), h('th', { text: '税率' })])]);
    var cg = h('colgroup', null, [h('col', { class: 'c1' }), h('col'), h('col'), h('col'), h('col'), h('col')]);
    var t = h('table', { class: 'p-items' }, [cg, head, tb]);
    // 列の幅（CSSOM で設定。CSP の style 属性は使わない）
    var w = ['42%', '9%', '8%', '15%', '16%', '10%'];
    Array.prototype.forEach.call(cg.children, function (col, i) { col.style.width = w[i]; });
    return t;
  }
  function sumTable(res, d, isR) {
    var tb = h('tbody');
    var add = function (a, b, cls) { tb.appendChild(h('tr', cls ? { class: cls } : null, [h('td', { text: a }), h('td', { class: 'num', text: b })])); };
    [10, 8].forEach(function (r) {
      var g = res.byRate[r]; if (!g.count) return;
      var lab = r + '%対象' + (r === 8 ? '（軽減税率）' : '');
      if (res.incl) { add(r + '%対象' + (r === 8 ? '（軽減税率・税込）' : '（税込）'), C.yen(g.amount)); add('うち消費税（' + r + '%）', C.yen(g.tax)); }
      else { add(lab, C.yen(g.base)); add('消費税（' + r + '%）', C.yen(g.tax)); }
    });
    if (res.byRate[0].count) add('非課税', C.yen(res.byRate[0].base));
    add('合計（税込）', C.yen(res.total), 'strong');
    if (d.withholding && !isR) { add('源泉徴収税額', '-' + C.yen(res.withholding).replace('-', '')); add(kind === 'estimate' ? '差引お見積金額' : '差引ご請求額', C.yen(res.payable), 'strong'); }
    return h('table', { class: 'p-sumt' }, [tb]);
  }

  /* ---------- 画面の横の案内・エラー ---------- */
  function sideInfo(d, res) {
    var errs = res.errors.slice();
    if (d.date && !C.isValidDate(d.date)) errs.push('日付を正しく入れてください');
    if (res.negative) errs.push('合計がマイナスです。値引きの行を見直してください');
    var e = $('errors'), joined = errs.join('|');
    if (e.dataset.last !== joined) { e.dataset.last = joined; clear(e); errs.forEach(function (m) { e.appendChild(h('div', { text: m })); }); }

    var rs = C.regNoState(d.issuer.regNo), rm = $('regMsg');
    rm.className = 'msg ' + (rs === 'bad' ? 'bad' : rs === 'ok' ? 'ok' : 'info');
    rm.textContent = rs === 'bad' ? 'T と13桁の数字で入れてください（例：T1234567890123）'
      : rs === 'ok' ? '登録番号の形は合っています（番号が本当に登録されているかは確かめていません）'
      : '登録番号が空のときは、適格請求書（インボイス）としては使えません';
    $('fReg').setAttribute('aria-invalid', rs === 'bad' ? 'true' : 'false');

    var miss = [];
    if (!d.issuer.name) miss.push('発行者の名前'); if (rs !== 'ok') miss.push('登録番号'); if (!C.isValidDate(d.date)) miss.push('日付'); if (!d.to) miss.push('宛名');
    $('invoiceInfo').className = 'msg ' + (miss.length ? 'info' : 'ok');
    $('invoiceInfo').textContent = kind === 'estimate' ? '' : (miss.length ? 'インボイスの記載事項で空の所：' + miss.join('・') + '。' : 'インボイスの記載事項（発行者・登録番号・日付・品目・税率ごとの合計と税額・宛名）の欄が埋まっています。') + '取引の日付は「' + KIND[kind].date + '」として書いています。取引日がちがうとき（月末にまとめて請求するなど）は、件名か備考に「11月分」のように取引の時期を書いてください。';

    var si = $('stampInfo');
    if (kind === 'receipt' && res.lines.length) {
      var basis = d.taxExempt ? '税込' : '税抜';
      si.textContent = res.stamp === null ? '収入印紙の目安：金額が2,000万円を超えます。国税庁のページ（No.7105）の表で確かめてください。'
        : '収入印紙の目安：' + (res.stamp === 0 ? '不要（印紙の枠も印刷しません）' : res.stamp.toLocaleString('ja-JP') + '円') + '（記載金額 ' + basis + ' ' + C.yen(res.stampBase) + ' で判定）。紙で渡すときの目安です。PDF をメールで送るなど電子データで渡す領収書には、印紙は要りません。営業に関しない受け取りなども要りません。くわしくは国税庁のページ（No.7105）を見てください。';
    } else si.textContent = '';
    if (kind === 'receipt' && d.withholding) si.textContent += '　※ 領収書の金額は源泉徴収を引く前の合計（税込）です。源泉徴収された後の金額を受け取った場合は、金額の書き方を相手に確かめてください。';

    var ex = $('explain'); clear(ex);
    C.explain(res, d).forEach(function (s) { ex.appendChild(h('li', { text: s })); });
  }

  /* ---------- A4 を画面の幅に合わせて縮める ---------- */
  function fitPaper() {
    var wrap = $('paperScale'), paper = $('paper');
    var w = wrap.clientWidth, pw = paper.offsetWidth;
    var s = Math.min(1, w / pw);
    paper.style.transform = 'scale(' + s + ')';
    wrap.style.height = Math.ceil(paper.offsetHeight * s) + 'px';
  }

  /* ---------- タブ ---------- */
  function setKind(k) {
    kind = k;
    Array.prototype.forEach.call(document.querySelectorAll('[role=tab]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.kind === k)); });
    $('dateLabel').textContent = KIND[k].date;
    $('dueWrap').hidden = k === 'receipt'; $('dueLabel').textContent = KIND[k].due;
    $('bankWrap').hidden = k !== 'invoice';
    $('receiptForWrap').hidden = k !== 'receipt';
    $('exemptWrap').hidden = k !== 'receipt';
    update();
  }

  /* ---------- 見本・全部消す ---------- */
  function hasInput() {
    return Array.prototype.some.call(document.querySelectorAll('.form input[type=text], .form textarea'), function (i) { return i.value.trim() !== '' && !(i.classList.contains('qt') && i.value === '1') && !(i.classList.contains('un') && i.value === '式'); });
  }
  function fill(doc) {
    $('fTo').value = doc.to; setRadio('hon', doc.honorific);
    $('fIssuer').value = doc.issuer.name; $('fAddr1').value = doc.issuer.addr1; $('fAddr2').value = doc.issuer.addr2;
    $('fTel').value = doc.issuer.tel; $('fMail').value = doc.issuer.mail; $('fReg').value = doc.issuer.regNo;
    setRadio('stamp', doc.stamp.type); $('fStampText').value = doc.stamp.text;
    $('fNo').value = doc.no; $('fDate').value = doc.date; $('fDue').value = doc.due; $('fSubject').value = doc.subject; $('fReceiptFor').value = doc.receiptFor;
    clear($('items')); (doc.items.length ? doc.items : [null]).forEach(function (it) { addRow(it); });
    setRadio('pm', doc.priceMode); setRadio('rnd', doc.rounding);
    $('fWh').checked = !!doc.withholding; $('fExempt').checked = !!doc.taxExempt;
    $('fBank').value = doc.bank; $('fNote').value = doc.note;
  }
  function emptyDoc() {
    return { to: '', honorific: '御中', issuer: { name: '', addr1: '', addr2: '', tel: '', mail: '', regNo: '' }, stamp: { type: 'none', text: '' },
      no: '', date: C.todayString(new Date()), due: '', subject: '', receiptFor: '', items: [], priceMode: 'excl', rounding: 'floor', withholding: false, taxExempt: false, bank: '', note: '' };
  }
  function loadSample() {
    if (hasInput() && !window.confirm('今の入力は消えます。見本を入れますか？')) return;
    var sd = S.sampleDoc(C.todayString(new Date())); sd.subject = '焼き菓子の納品（' + (new Date().getMonth() + 1) + '月分）'; fill(sd); setKind('invoice'); dirty = false;
  }
  function clearAll() {
    if (hasInput() && !window.confirm('入力をすべて消しますか？')) return;
    fill(emptyDoc()); dirty = false; update();
  }

  /* ---------- 印刷 ---------- */
  function doPrint() {
    clearTimeout(timer); render();
    var d = readDoc(), res = C.computeDoc(d);
    if (res.errors.length) { window.alert('入力にまちがいがあります。直してから印刷してください。\n\n' + res.errors.join('\n') + '\n\n（まちがいのある行は合計に入っていません）'); return; }
    if (overflows()) { window.alert('A4 1枚に入りません。品名・備考を短くするか、行を減らしてください。'); return; }
    var miss = [];
    if (!d.to) miss.push('宛名が空です'); if (!d.issuer.name) miss.push('発行者の名前が空です');
    if (kind !== 'estimate') {
      var rs = C.regNoState(d.issuer.regNo);
      if (rs === 'empty') miss.push('登録番号が空です（インボイスとして出すときは要ります）');
      if (rs === 'bad') miss.push('登録番号の形がちがいます（T と13桁）');
      if (!C.isValidDate(d.date)) miss.push('日付が空か、正しくありません');
    }
    if (miss.length && !window.confirm(miss.join('\n') + '\n\nこのまま印刷しますか？')) return;
    window.print();
  }
  // A4（297mm）の高さを超えたか（画面の見た目の高さで確かめる）
  function overflows() {
    var p = $('paper'), mm = p.offsetWidth / 210;
    return p.scrollHeight > Math.ceil(297 * mm) + 2;
  }

  var timer = null;
  function update() { clearTimeout(timer); timer = setTimeout(render, 60); }

  function start() {
    try {
      fill(emptyDoc());
      document.querySelector('.form').addEventListener('input', function () { dirty = true; update(); });
      document.querySelector('.form').addEventListener('change', function () { dirty = true; update(); });
      Array.prototype.forEach.call(document.querySelectorAll('[role=tab]'), function (b) {
        b.addEventListener('click', function () { setKind(b.dataset.kind); });
        b.addEventListener('keydown', function (ev) {
          var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]')), i = tabs.indexOf(b);
          if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { var n = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setKind(n.dataset.kind); ev.preventDefault(); }
        });
      });
      $('btnAddRow').addEventListener('click', function () { addRow(); var rows = $('items').children; rows[rows.length - 1].querySelector('.nm').focus(); update(); });
      $('btnSample').addEventListener('click', loadSample);
      $('btnClear').addEventListener('click', clearAll);
      $('btnPrint').addEventListener('click', doPrint);
      window.addEventListener('resize', fitPaper);
      window.addEventListener('beforeprint', function () { clearTimeout(timer); render(); });
      window.addEventListener('beforeunload', function (ev) { if (dirty && hasInput()) { ev.preventDefault(); ev.returnValue = ''; } });
      setKind('invoice');
      render();
    } catch (e) {
      var p = document.createElement('p'); p.className = 'noscript'; p.textContent = '読み込みでエラーが起きました。ページを開き直してください。（' + (e && e.message) + '）';
      document.body.insertBefore(p, document.body.firstChild);
    }
  }
  start();
})();
