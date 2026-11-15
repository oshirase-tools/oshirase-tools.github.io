/* 見積書・請求書・領収書メーカー - 計算（純粋な関数だけ。画面にさわらない） */
(function (root) {
  'use strict';
  var MAX_PRICE = 999999999;
  var MAX_QTY100 = 9999999;          // 99,999.99
  var MAX_TOTAL = 9999999999;
  var MAX_ITEMS = 15;
  var RATES = [10, 8, 0];

  /* ---------- 入力の読み方 ---------- */
  function toHalf(s) {
    return String(s == null ? '' : s)
      .replace(/[０-９Ａ-Ｚａ-ｚ．，－＋]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[−ー―‐]/g, '-').replace(/　/g, ' ');
  }
  // 単価：整数の円。「¥1,000」「１０００」「1,000円」「-500」→ 数。だめなら { ok:false }
  function parseYen(s, opts) {
    opts = opts || {};
    var t = toHalf(s).trim().replace(/^[¥￥]/, '').replace(/円$/, '').replace(/,/g, '').trim();
    if (t === '') return opts.allowEmpty ? { ok: true, value: null } : { ok: false, error: '金額を入れてください' };
    if (!/^-?\d+$/.test(t)) return { ok: false, error: '単価は整数の円で入れてください' };
    var v = parseInt(t, 10);
    var min = opts.allowNegative === false ? 0 : -MAX_PRICE;
    if (v < min || v > MAX_PRICE) return { ok: false, error: '金額が大きすぎます' };
    return { ok: true, value: v };
  }
  // 数量：0 より大きく、小数2けたまで。100倍の整数で返す
  function parseQty(s) {
    var t = toHalf(s).trim().replace(/,/g, '');
    if (t === '') return { ok: false, error: '数量を入れてください' };
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false, error: '数量は 0 より大きい数で、小数は2けたまで' };
    var p = t.split('.');
    var v = parseInt(p[0], 10) * 100 + parseInt(((p[1] || '') + '00').slice(0, 2), 10);
    if (v <= 0) return { ok: false, error: '数量は 0 より大きい数で、小数は2けたまで' };
    if (v > MAX_QTY100) return { ok: false, error: '数量が大きすぎます' };
    return { ok: true, value: v };
  }
  function qtyText(q100) {
    var w = Math.floor(q100 / 100), f = q100 % 100;
    return w.toLocaleString('ja-JP') + (f ? '.' + (f < 10 ? '0' + f : String(f)).replace(/0$/, '') : '');
  }

  /* ---------- 日付 ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1) return false;
    var dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return d <= dim;
  }
  function todayString(now) { return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()); }
  function dateJa(s) { return isValidDate(s) ? (+s.slice(0, 4)) + '年' + (+s.slice(5, 7)) + '月' + (+s.slice(8, 10)) + '日' : ''; }

  /* ---------- 登録番号 ---------- */
  function normalizeRegNo(s) { return toHalf(s).replace(/\s|-/g, '').toUpperCase(); }
  function regNoState(s) {
    var t = normalizeRegNo(s);
    if (t === '') return 'empty';
    return /^T\d{13}$/.test(t) ? 'ok' : 'bad';
  }

  /* ---------- 丸め ---------- */
  // num/den を、正の数として丸めて符号を戻す（den > 0）
  function roundDiv(num, den, mode) {
    var neg = num < 0, a = Math.abs(num);
    var q = Math.floor(a / den), r = a - q * den;
    if (r !== 0) {
      if (mode === 'ceil') q += 1;
      else if (mode === 'round' && r * 2 >= den) q += 1;
    }
    return neg ? -q : q;
  }

  /* ---------- 明細 ---------- */
  // 金額＝数量×単価の1円未満切り捨て（0 に近い方へ）
  function lineAmount(qty100, price) {
    var p = qty100 * price;               // 最大 9,999,999 × 999,999,999 ≒ 1e16 → 安全な整数を超えるおそれ
    if (!Number.isSafeInteger(p)) return null;
    return p < 0 ? -Math.floor(-p / 100) : Math.floor(p / 100);
  }
  function isBlankItem(it) { return !it || (String(it.name || '').trim() === '' && (it.price === null || it.price === undefined || it.price === '')); }

  /* ---------- 源泉徴収（国税庁 No.2795） ---------- */
  function withholdingTax(base) {
    if (!(base > 0)) return 0;
    if (base <= 1000000) return Math.floor(base * 1021 / 10000);
    return Math.floor((base - 1000000) * 2042 / 10000) + 102100;
  }

  /* ---------- 収入印紙の目安（売上代金の受取書。国税庁 No.7105・7141） ---------- */
  var STAMP_TABLE = [[50000, 0], [1000000, 200], [2000000, 400], [3000000, 600], [5000000, 1000], [10000000, 2000], [20000000, 4000]];
  // 返り値：数（円）。0 は不要。null は「表で確かめて」
  function stampDuty(amount) {
    if (amount < 50000) return 0;
    for (var i = 1; i < STAMP_TABLE.length; i++) if (amount <= STAMP_TABLE[i][0]) return STAMP_TABLE[i][1];
    return null;
  }

  /* ---------- 書類全体 ---------- */
  // doc.items: [{ name, qty100, price, rate, unit }]（qty100・price は読み取り済みの数。読めない行は error を持つ）
  function computeDoc(doc) {
    var errors = [], lines = [];
    var byRate = { 10: { amount: 0, base: 0, tax: 0, count: 0 }, 8: { amount: 0, base: 0, tax: 0, count: 0 }, 0: { amount: 0, base: 0, tax: 0, count: 0 } };
    var mode = doc.rounding === 'round' || doc.rounding === 'ceil' ? doc.rounding : 'floor';
    var incl = doc.priceMode === 'incl';
    (doc.items || []).forEach(function (it, i) {
      if (isBlankItem(it)) return;
      if (it.error) { errors.push((i + 1) + '行目：' + it.error); return; }
      if (String(it.name || '').trim() === '') { errors.push((i + 1) + '行目：品名を入れてください'); return; }
      if (RATES.indexOf(it.rate) < 0) { errors.push((i + 1) + '行目：税率を選んでください'); return; }
      var amt = lineAmount(it.qty100, it.price);
      if (amt === null) { errors.push((i + 1) + '行目：金額が大きすぎます'); return; }
      lines.push({ index: i, name: it.name || '', unit: it.unit || '', qty100: it.qty100, price: it.price, rate: it.rate, amount: amt });
      byRate[it.rate].amount += amt; byRate[it.rate].count++;
    });
    RATES.forEach(function (r) {
      var g = byRate[r];
      if (r === 0) { g.base = g.amount; g.tax = 0; return; }
      if (incl) { g.tax = roundDiv(g.amount * r, 100 + r, mode); g.base = g.amount - g.tax; }
      else { g.base = g.amount; g.tax = roundDiv(g.amount * r, 100, mode); }
    });
    var totalExcl = byRate[10].base + byRate[8].base + byRate[0].base;
    var totalTax = byRate[10].tax + byRate[8].tax;
    var total = totalExcl + totalTax;
    var wh = doc.withholding ? withholdingTax(totalExcl) : 0;
    var payable = total - wh;
    if (Math.abs(total) > MAX_TOTAL) errors.push('金額が大きすぎます');
    if (lines.length === 0) errors.push('品目を1行以上入れてください');
    var negative = total < 0;
    var stampBase = doc.taxExempt ? total : totalExcl;
    return {
      lines: lines, byRate: byRate, totalExcl: totalExcl, totalTax: totalTax, total: total,
      withholding: wh, payable: payable, negative: negative,
      stampBase: stampBase, stamp: stampDuty(stampBase), errors: errors, rounding: mode, incl: incl
    };
  }

  // 「計算の式」を人が読める文の配列で返す
  function explain(res, doc) {
    var out = [], ML = { floor: '切り捨て', round: '四捨五入', ceil: '切り上げ' }[res.rounding];
    [10, 8].forEach(function (r) {
      var g = res.byRate[r]; if (!g.count) return;
      if (res.incl) out.push(r + '%対象（税込）' + yen(g.amount) + ' × ' + r + '/' + (100 + r) + ' ＝ うち消費税 ' + yen(g.tax) + '（1円未満' + ML + '）');
      else out.push(r + '%対象 ' + yen(g.base) + ' × ' + r + '% ＝ 消費税 ' + yen(g.tax) + '（1円未満' + ML + '）');
    });
    if (res.byRate[0].count) out.push('非課税 ' + yen(res.byRate[0].base) + '（消費税なし）');
    out.push('消費税は税率ごとの合計に1回だけ掛けています（品目ごとには丸めません）');
    if (doc.withholding) {
      var b = res.totalExcl;
      if (b <= 1000000) out.push('源泉徴収税額 ＝ 税抜 ' + yen(b) + ' × 10.21% ＝ ' + yen(res.withholding) + '（1円未満切り捨て）');
      else out.push('源泉徴収税額 ＝（税抜 ' + yen(b) + ' − 1,000,000円）× 20.42% ＋ 102,100円 ＝ ' + yen(res.withholding) + '（1円未満切り捨て）');
      out.push((doc.kind === 'estimate' ? '差引お見積金額' : '差引ご請求額') + ' ＝ ' + yen(res.total) + ' − ' + yen(res.withholding) + ' ＝ ' + yen(res.payable));
    }
    return out;
  }

  function yen(n) { return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('ja-JP'); }
  function yenBig(n) { return yen(n) + '-'; }

  var api = {
    MAX_ITEMS: MAX_ITEMS, MAX_PRICE: MAX_PRICE, RATES: RATES,
    toHalf: toHalf, parseYen: parseYen, parseQty: parseQty, qtyText: qtyText,
    isValidDate: isValidDate, todayString: todayString, dateJa: dateJa,
    normalizeRegNo: normalizeRegNo, regNoState: regNoState,
    roundDiv: roundDiv, lineAmount: lineAmount, isBlankItem: isBlankItem,
    withholdingTax: withholdingTax, stampDuty: stampDuty, computeDoc: computeDoc, explain: explain, yen: yen, yenBig: yenBig
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SKY = root.SKY || {}; root.SKY.calc = api; }
})(typeof window !== 'undefined' ? window : this);
