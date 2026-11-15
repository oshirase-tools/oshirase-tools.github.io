/* 見本（作り話）。実在の会社・人・口座ではありません */
(function (root) {
  'use strict';
  function sampleDoc(today) {
    return {
      kind: 'invoice', to: '株式会社見本商事', honorific: '御中',
      issuer: { name: '見本菓子店', addr1: '東京都見本区見本町1-2-3', addr2: '', tel: '000-0000-0000', mail: 'mihon@example.com', regNo: 'T0000000000000' },
      stamp: { type: 'square', text: '見本' },
      no: '0001', date: today, due: '', subject: '11月分 焼き菓子の納品', receiptFor: '',
      items: [
        { name: '焼き菓子の詰め合わせ（20個入り）', qty: '30', unit: '箱', price: '2,400', rate: 8 },
        { name: 'のし・個別包装', qty: '30', unit: '箱', price: '150', rate: 10 },
        { name: '配送料', qty: '1', unit: '式', price: '1,800', rate: 10 },
        { name: '大口のお値引き', qty: '1', unit: '式', price: '-3,000', rate: 8 }
      ],
      priceMode: 'excl', rounding: 'floor', withholding: false, taxExempt: false,
      bank: '見本銀行 見本支店 普通 0000000 ミホン タロウ', note: '振込手数料はご負担くださいますようお願いいたします。\n（これは作り話の見本です）'
    };
  }
  var api = { sampleDoc: sampleDoc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SKY = root.SKY || {}; root.SKY.sample = api; }
})(typeof window !== 'undefined' ? window : this);
