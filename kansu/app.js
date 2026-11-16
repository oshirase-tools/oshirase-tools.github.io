(function (root) {
  'use strict';

  var COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  var RECIPES = {
    lookup: {
      id: 'lookup',
      label: '① 別の表から一致するデータを持ってくる（VLOOKUP / XLOOKUP）',
      shortDesc: '商品コードや社員番号をもとに、別の一覧表から「商品名」「単価」「氏名」などを自動で引っ張ってきます。',
      samplePreview: [
        ['セル', 'A列（探す値）', 'B列（結果を入れる）', '｜', 'E列（元表のコード）', 'F列（商品名）', 'G列（単価）'],
        ['2行目', 'A-101', '←ここに数式！', '｜', 'A-101', 'ハンドソープ', '1,200'],
        ['3行目', 'A-102', '下にコピー', '｜', 'A-102', '詰め替え用', '850']
      ]
    },
    sumifs: {
      id: 'sumifs',
      label: '② 条件に合う行だけ「合計金額」を出す（SUMIF / SUMIFS）',
      shortDesc: '「営業部だけ」「支払済だけ」など、決まった条件に合う行の金額だけを自動で合計します。',
      samplePreview: [
        ['セル', 'B列（部門・条件）', 'C列（状態）', 'E列（金額：合計したい列）'],
        ['2行目', '営業部', '支払済', '15,000（←条件に合うので足す）'],
        ['3行目', '総務部', '支払済', '8,000（←部門が違うので足さない）']
      ]
    },
    countifs: {
      id: 'countifs',
      label: '③ 条件に合うデータの「件数（人数）」を数える（COUNTIF / COUNTIFS）',
      shortDesc: '名簿や一覧表の中から、「未提出」「出席」「東京」などの条件に合う行が何件あるかを数えます。',
      samplePreview: [
        ['セル', 'B列（氏名）', 'C列（提出状況：数える列）', '集計結果'],
        ['2行目', '山田', '済', '「済」の件数 → 2件'],
        ['3行目', '佐藤', '未提出', '「未提出」の件数 → 1件']
      ]
    },
    if_basic: {
      id: 'if_basic',
      label: '④ もし〇〇以上なら「合格」、違ったら「再確認」と出す（IF）',
      shortDesc: '点数や金額、文字を見て、条件に合えば「OK（済）」、合わなければ「要確認（未）」などを自動で表示します。',
      samplePreview: [
        ['セル', 'A列（判定する値）', 'B列（自動表示される結果）'],
        ['2行目', '85', '合格（80以上なので）'],
        ['3行目', '65', '再確認（80未満なので）']
      ]
    },
    if_and_or: {
      id: 'if_and_or',
      label: '⑤ 2つの条件の「両方（またはどちらか）」を満たすとき印をつける（IF＋AND/OR）',
      shortDesc: '「状態が完了 かつ 確認が確認済」のように、2つの条件を組み合わせてチェックを入れます。',
      samplePreview: [
        ['セル', 'B列（条件1）', 'C列（条件2）', 'D列（判定結果）'],
        ['2行目', '完了', '確認済', 'OK（両方満たす）'],
        ['3行目', '完了', '未確認', '要確認（片方が未確認）']
      ]
    },
    clean_text: {
      id: 'clean_text',
      label: '⑥ 前後の余分な空白を消し、全角の英数字を半角にそろえる（TRIM＋ASC。カタカナも半角になります）',
      shortDesc: 'VLOOKUPで一致しない原因になりやすい「前後の見えないスペース」と「全角の英数字・ハイフン」を一括で整えます。',
      samplePreview: [
        ['セル', 'A列（元の文字）', 'B列（整えた後の文字）'],
        ['2行目', '　Ａ－１０１ ', 'A-101（空白が消えて半角に！）'],
        ['3行目', ' ０３－１２３４ ', '03-1234']
      ]
    },
    round_tax: {
      id: 'round_tax',
      label: '⑦ 消費税（10%・8%）や金額の端数を切り捨て・四捨五入する（ROUNDDOWN / ROUND）',
      shortDesc: '請求書や見積書で、1円未満の端数を「切り捨て」「四捨五入」「切り上げ」してきれいな整数にします。',
      samplePreview: [
        ['セル', 'A列（税抜金額）', 'B列（消費税10%・切り捨て）', 'C列（税込金額）'],
        ['2行目', '1,285', '128（128.5の端数切り捨て）', '1,413'],
        ['3行目', '3,500', '350', '3,850']
      ]
    },
    dup_check: {
      id: 'dup_check',
      label: '⑧ 名簿や商品コードの「重複（ダブり）」を見つけて印をつける（COUNTIF）',
      shortDesc: '同じメールアドレスや社員番号、商品コードが2回以上入っている行に自動で「重複あり」と表示します。',
      samplePreview: [
        ['セル', 'B列（商品コード・メール）', 'C列（重複チェック結果）'],
        ['2行目', 'user01@example.com', '重複あり（2件あります）'],
        ['3行目', 'user02@example.com', '（空欄＝重複なし）'],
        ['4行目', 'user01@example.com', '重複あり（2件あります）']
      ]
    }
  };

  // R36完全準拠：VLOOKUPの#N/A原因に「大文字・小文字の違い」は絶対に書かない（Excelでは区別されないため）
  var ERROR_GUIDES = {
    err_na: {
      id: 'err_na',
      code: '#N/A',
      title: '#N/A が出た！（VLOOKUP・XLOOKUPで「値が見つからない」と言われる）',
      summary: '探している文字や数字が、元の表の中で「完全に同じ形」で見つからないときに出る一番多いサインです。',
      causes: [
        '1. 全角と半角の違い（例：「Ａ０１」と「A01」、全角ハイフン「－」と半角「-」が混ざっている）※Excel の場合です。Google スプレッドシートで試したところ、全角の「Ａ０１」でも半角の「A01」の行が見つかりました',
        '2. 【見えない罠】文字のうしろや前に「見えないスペース（空白）」が入っている（Webやメールから貼り付けた表でよく起きます）',
        '3. 「数字（数値の 101）」と「文字として扱われている数字（文字列の \'101）」の違いで別物と判定されている',
        '4. 数式を下にコピーしたときに、探す表の範囲（A2:D100 など）が一緒に下にズレてしまっている（$A$2:$D$100 の「$」固定漏れ）',
        '5. 探す値が、範囲のいちばん左の列にない（VLOOKUP は範囲の左端の列でしか探せません）'
      ],
      proTip: '※豆知識：英語の「大文字と小文字の違い（A と a）」は、Excel や Google スプレッドシートの VLOOKUP では同じ文字として扱われるため、#N/A の原因にはなりません。まずは「見えない空白」と「全角・半角」「$ の付け忘れ」の3つを確かめてみてください。',
      beforeFormula: '=VLOOKUP(A2, E2:G100, 2, FALSE)',
      afterFormula: '=IF(A2="","",IFERROR(VLOOKUP(A2, $E$2:$G$100, 2, FALSE), "未登録"))',
      fixSteps: [
        '1. 範囲に「$」を付ける：E2:G100 を $E$2:$G$100 に変えて、下にコピーしても範囲がズレないようにします。',
        '2. 空白と全角を整える：探す値と元の表の両方を、先に同じ形にそろえます（ページ下の「表記ゆれお直し道具」も使えます）。式の中で TRIM(ASC(A2)) を使うと、数字のコードが文字に変わって見つからなくなったり、カタカナが半角になったりするので、コードが英数字の文字だけのときに限ります。',
        '3. まだ元データがない行の #N/A を消す：外側を IFERROR(..., "未登録") や IF(A2="","",...) で包むと、表がきれいに整います。※IFERROR は範囲のまちがいなど別のエラーも「未登録」に隠すので、先に1行だけ IFERROR なしで正しく出るか確かめてから包みます。'
      ]
    },
    err_value: {
      id: 'err_value',
      code: '#VALUE!',
      title: '#VALUE! が出た！（計算の中に「文字」や「空白 ""」が混ざっている）',
      summary: '足し算や掛け算の中に、数字ではなく「文字」や「数式で作った空白（""）」が混ざっているときに出ます。',
      causes: [
        '1. 「=A2+B2+C2」のように「+」で足し算していて、その中に数式で空白（""）にしたセルや「-」「未定」などの文字が入っている',
        '2. 金額のセルの中に「1,000円」や「¥1,000」など、表示形式ではなく直接「円」という文字が打ち込まれている',
        '3. 全角の数字（１２３）やスペースだけのセルを掛け算（*）・割り算（/）している'
      ],
      proTip: '「+」記号で足し算すると空白文字列（""）で #VALUE! になりますが、「SUM 関数」を使えば文字や空白（""）を自動で飛ばして数字だけを安全に合計してくれます。ただし SUM は「1,000円」のような文字の金額も黙って飛ばすので、合計が少なくないか確かめてください。',
      beforeFormula: '=B2 + C2 + D2',
      afterFormula: '=SUM(B2:D2)',
      fixSteps: [
        '1. 「+」の足し算を「SUM」に変える：=B2+C2 ではなく =SUM(B2:C2) に書き換えます。',
        '2. 掛け算（数量×単価）のときは IF で空欄をよける：=IF(OR(B2="",C2=""), "", B2*C2) にすると、入力前でもエラーが出ません。',
        '3. セルの中の「円」やスペースを消す：セルには数字だけ（1000）を入れ、カンマや円マークは表示形式で付けます。'
      ]
    },
    err_div0: {
      id: 'err_div0',
      code: '#DIV/0!',
      title: '#DIV/0! が出た！（割り算の分母が「0」または「空欄」になっている）',
      summary: '達成率や平均単価などを計算するとき、割る数（分母）のセルがまだ空欄か「0」のときに出ます。',
      causes: [
        '1. 来月以降の行まで先に数式をコピーしていて、まだ売上や件数（分母）が空欄（0）になっている',
        '2. AVERAGE（平均）関数で、対象の範囲にまだ1つも数字が入っていない'
      ],
      proTip: '表の見た目が悪くなりやすいエラーです。IFERROR 関数で包むか、「分母が0以下なら0（または空白）にする」という IF 文を足すだけでピタッと消えます。',
      beforeFormula: '=B2 / C2',
      afterFormula: '=IF(C2<=0, "", ROUND(B2 / C2, 2))',
      fixSteps: [
        '1. 割り算の前に「もし分母が0以下なら空白」を入れる：=IF(C2<=0, "", B2/C2) に書き換えます。',
        '2. または一番簡単なおまじない IFERROR を使う：=IFERROR(B2/C2, "") と書けば、エラーのときだけきれいな空欄になります。',
        '※上の「直した後の式」は、小数第2位で四捨五入しています。'
      ]
    },
    err_ref: {
      id: 'err_ref',
      code: '#REF!',
      title: '#REF! が出た！（見に行っていた行・列が消えた ／ VLOOKUPの列番号オーバー）',
      summary: '数式が参照していたセル（行や列）を削除してしまったか、VLOOKUPで「表の列数より大きい番号」を指定したときに出ます。',
      causes: [
        '1. 数式が見に行っていた行や列を「右クリック ＞ 削除」で消してしまった（数式の中が =SUM(#REF!) に変わっています）',
        '2. VLOOKUP(A2, $E$2:$F$100, 3, FALSE) のように、範囲が2列（E列とF列）しかないのに「3列目（3）」を取り出そうとしている',
        '3. 相対参照の数式を上の行や左の列へコピーして、A1 より外側の存在しない場所を見に行ってしまった'
      ],
      proTip: '行や列を消した直後なら、すぐにキーボードの「Ctrl + Z（元に戻す）」を押せば1秒で復活します！',
      beforeFormula: '=VLOOKUP(A2, $E$2:$F$100, 3, FALSE)',
      afterFormula: '=VLOOKUP(A2, $E$2:$G$100, 3, FALSE)',
      fixSteps: [
        '1. 消した直後なら「Ctrl + Z」で元に戻します。',
        '2. VLOOKUPで出た場合は、第2引数の範囲（$E$2:$G$100）が取り出したい列までしっかり含んでいるか確かめます。',
        '3. 行を消すときは、セルごと削除するのではなく「中身だけクリア（Deleteキー）」して並び替えると #REF! を防げます。'
      ]
    },
    err_name: {
      id: 'err_name',
      code: '#NAME?',
      title: '#NAME? が出た！（関数名のつづり間違い ／ 文字を「""」で囲み忘れている）',
      summary: 'Excelが「そんな名前の関数や定義は知りません」と困っているサインです。',
      causes: [
        '1. 関数名のスペルが1文字違う（例：VLOOKUP が VLOOKP、SUMIFS が SUMFIS になっている）',
        '2. 数式の中で「済」や「営業部」などの文字を書くときに、前後のダブルクォーテーション（"済"）を付け忘れている',
        '3. 範囲を指定するコロン「:」が抜けて「SUM(A2A10)」のようになっている、または全角の「”」や「：」が混ざっている',
        '4. 古いExcel（2019以前）で、新しい関数（XLOOKUP など）が入ったファイルを開いた'
      ],
      proTip: '数式の中で日本語や英字の「文字」を判定させるときは、必ず半角のダブルクォーテーション " " で囲むのが鉄則です（数字は囲みません）。',
      beforeFormula: '=IF(A2=完了, 〇, ×)',
      afterFormula: '=IF(A2="完了", "〇", "×")',
      fixSteps: [
        '1. 数式の中の文字（"完了"、"〇" など）が半角の「"」で囲まれているか確かめます。',
        '2. コロン（:）やカンマ（,）が全角になっていないか確かめます。',
        '3. 相手のExcelのバージョンが古い可能性があるときは、XLOOKUP ではなく VLOOKUP を使うとどのパソコンでも動きます。'
      ]
    },
    err_zero: {
      id: 'err_zero',
      code: '0落ち',
      title: '電話番号（090...）やコード（0012）の「先頭の 0」が勝手に消えてしまう！',
      summary: 'Excelが「0012 も 12 も算数では同じ数字だよね！」と気を利かせて、先頭の 0 を消してしまうために起きます。',
      causes: [
        '1. セルの表示形式が「標準」や「数値」のまま、0から始まる番号を入力した',
        '2. 管理画面から出した CSV ファイルを、そのままダブルクリックして Excel で開いた（数字だけの欄は、開いた瞬間に先頭の 0 が消えます）'
      ],
      proTip: 'CSVファイルをダブルクリックで開いてそのまま上書き保存すると、消えた「0」は元に戻りません。CSVは必ず「データ ＞ テキストまたはCSVから」で文字列として読み込むか、TEXT関数で復活させます。',
      beforeFormula: '=A2',
      afterFormula: '=TEXT(A2, "0000")',
      fixSteps: [
        '1. これから入力するとき：入力する前に列を選び、表示形式を「文字列」に変えるか、先頭に半角のアポストロフィ（\'0012）を付けて打ちます。',
        '2. すでに4桁のコード（12 → 0012）で 0 が消えたとき：隣の列に =TEXT(A2,"0000") と入れると、先頭に 0 を補った文字が作れます。',
        '3. 携帯番号（11桁）で先頭の 0 が消えた（9012345678 になった）とき：=IF(A2="","",IF(LEFT(A2,1)="0",A2,"0"&A2)) で、先頭が 0 でない番号にだけ 0 を付けます（固定電話の番号も二重になりません）。'
      ]
    },
    err_serial: {
      id: 'err_serial',
      code: '45610 / 式が出る',
      title: '日付が「45610」のような謎の5桁の数字になった ／ 数式が文字のまま計算されない！',
      summary: 'セルの「表示形式（見た目）」がズレているときに起きる現象です。データは壊れていないので10秒で直せます！',
      causes: [
        '1. 【日付が5桁の数字になる】Excelの内部では日付を「1900年1月1日からの通し番号（例：45610）」で持っているため、表示形式が「標準」や「数値」になると5桁の数字で見えてしまいます',
        '2. 【数式が計算されず =SUM(...) の文字のまま出る】数式を入れる前にセルの書式が「文字列」になっていたか、「=」の前にスペースが入っている'
      ],
      proTip: '別のセルと文字をくっつけたとき（="締切日："&A2）に「締切日：45610」になってしまう場合は、TEXT関数（="締切日："&TEXT(A2,"yyyy/m/d")）を使うときれいな日付になります！',
      beforeFormula: '="請求日：" & A2',
      afterFormula: '="請求日：" & TEXT(A2, "yyyy年m月d日")',
      fixSteps: [
        '1. セル単体が「45610」になったとき：そのセルを選び、ホームタブの表示形式を「標準」から「短い日付形式（2026/11/15）」に変えるだけで元に戻ります。',
        '2. 文字とつなげて5桁になったとき：A2 を TEXT(A2, "yyyy/mm/dd") で包みます。',
        '3. 数式が文字のまま計算されないとき：表示形式を「標準」に戻し、セルをダブルクリックして Enter キーを押すと計算が始まります。'
      ]
    }
  };

  var FORBIDDEN_OVERCLAIMS = [
    '必ず稼げる',
    '絶対に稼げる',
    '100%直る',
    '完璧に解決'
  ];

  function colToIndex(colStr) {
    var clean = String(colStr || 'A').trim().toUpperCase();
    var idx = COLS.indexOf(clean);
    return idx >= 0 ? idx : 0;
  }

  function formatSheetPrefix(sheetName) {
    if (!sheetName || typeof sheetName !== 'string') return '';
    var s = sheetName.trim();
    if (!s) return '';
    var escaped = s.replace(/'/g, "''");
    if (/^[A-Za-z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(s) && !/^[0-9]/.test(s)) {
      return s + '!';
    }
    return "'" + escaped + "'!";
  }

  function normalizeRowRange(startRow, endRow) {
    var s = parseInt(startRow, 10);
    var e = parseInt(endRow, 10);
    if (isNaN(s) || s < 1) s = 2;
    if (isNaN(e) || e < 1) e = 100;
    if (s > 1000000) s = 1000000;
    if (e > 1000000) e = 1000000;
    if (s > e) {
      var tmp = s;
      s = e;
      e = tmp;
    }
    return { start: s, end: e };
  }

  function wrapBlankAndError(coreFormula, keyCell, emptyFallback, useIfError, checkBlank) {
    var body = coreFormula.replace(/^=/, '');
    var fb = emptyFallback === 'zero' ? '0' : (emptyFallback === 'unregistered' ? '"未登録"' : '""');
    if (useIfError) {
      body = 'IFERROR(' + body + ', ' + fb + ')';
    }
    if (checkBlank && keyCell) {
      body = 'IF(' + keyCell + '="", "", ' + body + ')';
    }
    return '=' + body;
  }

  function generateFormulaRecipe(options) {
    var opts = options || {};
    var recipeId = RECIPES[opts.recipeId] ? opts.recipeId : 'lookup';
    var recipe = RECIPES[recipeId];

    var keyCell = String(opts.keyCell || 'A2').trim().toUpperCase();
    if (!/^[A-Z]{1,2}[0-9]{1,7}$/.test(keyCell)) {
      keyCell = 'A2';
    }

    var searchCol = String(opts.searchCol || 'B').trim().toUpperCase();
    if (COLS.indexOf(searchCol) < 0) searchCol = 'B';

    var targetCol = String(opts.targetCol || 'E').trim().toUpperCase();
    if (COLS.indexOf(targetCol) < 0) targetCol = 'E';

    var rows = normalizeRowRange(opts.startRow, opts.endRow);
    var sheetPrefix = formatSheetPrefix(opts.sheetName || '');
    var emptyFallback = opts.emptyFallback || 'blank'; // 'blank' | 'zero' | 'unregistered'
    var useIfError = opts.useIfError !== false;
    var checkBlank = opts.checkBlank !== false;
    var conditionText = String(opts.conditionText || '営業部').trim().replace(/"/g, '""');
    var conditionText2 = String(opts.conditionText2 || '支払済').trim().replace(/"/g, '""');
    var thresholdNum = isNaN(parseFloat(opts.thresholdNum)) ? 80 : parseFloat(opts.thresholdNum);

    var sIdx = colToIndex(searchCol);
    var tIdx = colToIndex(targetCol);
    var searchRange = sheetPrefix + '$' + searchCol + '$' + rows.start + ':$' + searchCol + '$' + rows.end;
    var targetRange = sheetPrefix + '$' + targetCol + '$' + rows.start + ':$' + targetCol + '$' + rows.end;

    var primaryFormula = '';
    var secondaryFormula = '';
    var secondaryLabel = '';
    var explanation = '';
    var warningNote = '';

    if (recipeId === 'lookup') {
      var fbText = emptyFallback === 'zero' ? '0' : (emptyFallback === 'unregistered' ? '"未登録"' : '""');
      var xlookupCore = 'XLOOKUP(' + keyCell + ', ' + searchRange + ', ' + targetRange + ', ' + fbText + ')';
      var xlookupFull = checkBlank ? '=IF(' + keyCell + '="", "", ' + xlookupCore + ')' : '=' + xlookupCore;

      if (tIdx >= sIdx) {
        var colNum = tIdx - sIdx + 1;
        var tableRange = sheetPrefix + '$' + searchCol + '$' + rows.start + ':$' + targetCol + '$' + rows.end;
        var vlookupCore = 'VLOOKUP(' + keyCell + ', ' + tableRange + ', ' + colNum + ', FALSE)';
        primaryFormula = wrapBlankAndError(vlookupCore, keyCell, emptyFallback, useIfError, checkBlank);
        secondaryFormula = xlookupFull;
        secondaryLabel = '新しいExcel（Microsoft 365 / 2021以降）・Googleスプレッドシートなら、列挿入でもズレない XLOOKUP も使えます：';
        explanation =
          '1. セル「' + keyCell + '」に入力された値を、範囲「' + tableRange + '」の一番左（' + searchCol + '列）から探します。\n' +
          '2. 一致する行が見つかったら、左から数えて「' + colNum + '列目（' + targetCol + '列）」の値を取り出します。\n' +
          '3. 下の行へコピーしても範囲がズレないように「$（絶対参照）」を自動で付けています。';
      } else {
        // Left-column lookup guard! VLOOKUP cannot look left.
        warningNote =
          '【自動チェック】取り出したい列（' + targetCol + '列）が、探す列（' + searchCol + '列）より左側にあります。VLOOKUP関数は左側の列を取り出せない仕様のため、どのExcelでも動く「INDEX + MATCH」の式と、新しいExcel（Microsoft 365・2021以降）・Googleスプレッドシートで使える「XLOOKUP」の式を組み立てました。';
        var indexMatchCore = 'INDEX(' + targetRange + ', MATCH(' + keyCell + ', ' + searchRange + ', 0))';
        primaryFormula = wrapBlankAndError(indexMatchCore, keyCell, emptyFallback, useIfError, checkBlank);
        secondaryFormula = xlookupFull;
        secondaryLabel = '新しいExcel・Googleスプレッドシートなら、さらに短い XLOOKUP がおすすめです：';
        explanation =
          '1. MATCH関数で「' + keyCell + '」が「' + searchRange + '」の上から何番目にあるかを見つけます。\n' +
          '2. INDEX関数で、左側にある「' + targetRange + '」の同じ行から値を取り出します（VLOOKUPの「左側の列を取れない弱点」を解消した式です）。';
      }
    } else if (recipeId === 'sumifs') {
      var sumifCore = 'SUMIF(' + searchRange + ', "' + conditionText + '", ' + targetRange + ')';
      var nextCol = COLS[Math.min(sIdx + 1, 25)];
      var cond2Range = sheetPrefix + '$' + nextCol + '$' + rows.start + ':$' + nextCol + '$' + rows.end;
      var sumifsCore = 'SUMIFS(' + targetRange + ', ' + searchRange + ', "' + conditionText + '", ' + cond2Range + ', "' + conditionText2 + '")';
      primaryFormula = '=' + sumifCore;
      secondaryFormula = '=' + sumifsCore;
      secondaryLabel = '条件が2つ以上あるとき（例：「' + conditionText + '」かつ「' + conditionText2 + '」）の SUMIFS 式：';
      explanation =
        '1. 「' + searchRange + '」の中で「' + conditionText + '」と一致する行だけを探します。\n' +
        '2. 一致した行の「' + targetRange + '（金額など）」だけを合計します。\n' +
        '3. ※SUMIFS（複数条件）にすると、最初に「合計したい列（' + targetRange + '）」を書く順番に自動で切り替わります。\n※2つ目の条件は、探す列のすぐ右の列（' + nextCol + '列）で見ています。ちがう列のときは、式の中の列の文字を書きかえてください。';
    } else if (recipeId === 'countifs') {
      var countifCore = 'COUNTIF(' + searchRange + ', "' + conditionText + '")';
      var nextColC = COLS[Math.min(sIdx + 1, 25)];
      var cond2RangeC = sheetPrefix + '$' + nextColC + '$' + rows.start + ':$' + nextColC + '$' + rows.end;
      var countifsCore = 'COUNTIFS(' + searchRange + ', "' + conditionText + '", ' + cond2RangeC + ', "' + conditionText2 + '")';
      primaryFormula = '=' + countifCore;
      secondaryFormula = '=' + countifsCore;
      secondaryLabel = '2つの条件を同時に満たす件数を数える COUNTIFS 式：';
      explanation =
        '1. 範囲「' + searchRange + '」の中に、「' + conditionText + '」という文字が何件あるかを自動で数えます。\n' +
        '2. 下の行や別の表にコピーしても範囲が動かないよう「$」で固定しています。\n※2つ目の条件は、探す列のすぐ右の列（' + nextColC + '列）で見ています。ちがう列のときは、式の中の列の文字を書きかえてください。';
    } else if (recipeId === 'if_basic') {
      var ifCore = 'IF(' + keyCell + '>=' + thresholdNum + ', "合格", "再確認")';
      primaryFormula = checkBlank ? '=IF(' + keyCell + '="", "", ' + ifCore + ')' : '=' + ifCore;
      secondaryFormula = '=IF(' + keyCell + '="' + conditionText + '", "〇", "")';
      secondaryLabel = '文字（例：「' + conditionText + '」かどうか）で判定して「〇」をつける場合の式：';
      explanation =
        '1. もしセル「' + keyCell + '」がまだ空欄なら、何も表示せず空白（""）のままにします。\n' +
        '2. 数値が入っていて「' + thresholdNum + '以上」なら「合格」、それ未満なら「再確認」と自動で表示します。\n※基準の ' + thresholdNum + ' は、式の中の数字を書きかえてください。セルに文字が入っていると「合格」と出るので、数字だけの列に使ってください。';
    } else if (recipeId === 'if_and_or') {
      var secondCell = targetCol + keyCell.replace(/^[A-Z]+/, '');
      var andCore = 'IF(AND(' + keyCell + '="' + conditionText + '", ' + secondCell + '="' + conditionText2 + '"), "OK", "要確認")';
      var orCore = 'IF(OR(' + keyCell + '="' + conditionText + '", ' + secondCell + '="' + conditionText2 + '"), "対象", "")';
      primaryFormula = '=' + andCore;
      secondaryFormula = '=' + orCore;
      secondaryLabel = '2つのうち「どちらか片方でも」当てはまれば印をつける OR 版の式：';
      explanation =
        '1. AND（両方満たす）を使い、「' + keyCell + ' が ' + conditionText + '」かつ「' + secondCell + ' が ' + conditionText2 + '」のときだけ「OK」と出します。\n' +
        '2. どちらか1つでも条件に満たない場合は「要確認」と表示して見落としを防ぎます。\n※2つ目の条件は「5. 取り出したい列」の同じ行（' + secondCell + '）を見ます。';
    } else if (recipeId === 'clean_text') {
      primaryFormula = '=IF(' + keyCell + '="", "", TRIM(ASC(' + keyCell + ')))';
      secondaryFormula = '=IF(' + keyCell + '="", "", SUBSTITUTE(SUBSTITUTE(TRIM(ASC(' + keyCell + ')), " ", ""), "　", ""))';
      secondaryLabel = '文字の「途中にあるスペース」まで全部消してピタッと詰めたいときの式：';
      explanation =
        '1. ASC関数で全角の英数字やハイフン（Ａ－１０１）を半角（A-101）にそろえてから、TRIM関数で文字の前後にある余分なスペースを消します。※ASC は全角のカタカナも半角（ﾊﾝﾄﾞｿｰﾌﾟ）に変えます。カタカナの列には使わないでください。長音の「ー」はハイフン「-」には変わりません。\n' +
        '2. VLOOKUPで #N/A が出るときに、この式で整えてから照合するとスッと一致するようになります。';
    } else if (recipeId === 'round_tax') {
      var taxDown = 'ROUNDDOWN(' + keyCell + '*0.1, 0)';
      var totalDown = 'ROUNDDOWN(' + keyCell + '*1.1, 0)';
      primaryFormula = checkBlank ? '=IF(' + keyCell + '="", "", ' + taxDown + ')' : '=' + taxDown;
      secondaryFormula = '=IF(' + keyCell + '="", "", ' + totalDown + ')';
      secondaryLabel = '税込合計金額（10%・1円未満切り捨て）を1つのセルで直接出したいときの式：';
      explanation =
        '1. セル「' + keyCell + '」の金額に消費税率（10% ＝ 0.1）を掛け、ROUNDDOWN（桁数 0）で1円未満の端数を切り捨てます。\n' +
        '2. 四捨五入にしたいときは「ROUNDDOWN」を「ROUND」に、切り上げにしたいときは「ROUNDUP」に変えるだけで使えます。\n3. インボイスの請求書では、消費税の端数は「請求書1枚・税率ごとに1回」まとめて処理します。1行ずつの切り捨ては見積の目安に使ってください。';
    } else if (recipeId === 'dup_check') {
      var dupCell = searchCol + rows.start;
      var dupCore = 'IF(COUNTIF(' + searchRange + ', ' + dupCell + ')>1, "重複あり", "")';
      primaryFormula = '=IF(' + dupCell + '="", "", ' + dupCore + ')';
      secondaryFormula = '=COUNTIF($' + searchCol + '$' + rows.start + ':' + dupCell + ', ' + dupCell + ')';
      secondaryLabel = '同じデータが2回以上出てきた順番に「1回目、2回目…」と番号を振りたいときの式：';
      explanation =
        '1. 範囲「' + searchRange + '」の中に、同じ文字やコードが「2件以上（>1）」あるかを COUNTIF 関数で数えます。\n' +
        '2. 2件以上ある行にだけ「重複あり」と表示し、1件しかない正常な行は空欄のままにします。';
    }

    return {
      recipe: recipe,
      primaryFormula: primaryFormula,
      secondaryFormula: secondaryFormula,
      secondaryLabel: secondaryLabel,
      explanation: explanation,
      warningNote: warningNote
    };
  }

  function initBrowserUI() {
    if (typeof document === 'undefined') return;

    var tabRecipeBtn = document.getElementById('tab-btn-recipe');
    var tabErrorBtn = document.getElementById('tab-btn-error');
    var panelRecipe = document.getElementById('panel-recipe');
    var panelError = document.getElementById('panel-error');

    var recipeSelect = document.getElementById('recipe-select');
    var keyCellInput = document.getElementById('key-cell');
    var searchColSelect = document.getElementById('search-col');
    var targetColSelect = document.getElementById('target-col');
    var startRowInput = document.getElementById('start-row');
    var endRowInput = document.getElementById('end-row');
    var sheetNameInput = document.getElementById('sheet-name');
    var cond1Input = document.getElementById('cond1-input');
    var cond2Input = document.getElementById('cond2-input');
    var fallbackSelect = document.getElementById('fallback-select');
    var chkBlank = document.getElementById('chk-blank');
    var chkIferror = document.getElementById('chk-iferror');

    var descBox = document.getElementById('recipe-desc');
    var warnBox = document.getElementById('warning-box');
    var primaryOut = document.getElementById('primary-formula');
    var copyPrimaryBtn = document.getElementById('btn-copy-primary');
    var secondaryWrap = document.getElementById('secondary-wrap');
    var secondaryLabelEl = document.getElementById('secondary-label');
    var secondaryOut = document.getElementById('secondary-formula');
    var copySecondaryBtn = document.getElementById('btn-copy-secondary');
    var explanationOut = document.getElementById('formula-explanation');
    var previewTableBody = document.getElementById('preview-tbody');
    var btnLoadSample = document.getElementById('btn-load-sample');
    var btnSwapLeftTest = document.getElementById('btn-swap-left');

    // Populate column dropdowns A-Z
    if (searchColSelect && targetColSelect && searchColSelect.options.length === 0) {
      for (var i = 0; i < COLS.length; i++) {
        var c = COLS[i];
        var opt1 = document.createElement('option');
        opt1.value = c;
        opt1.textContent = c + '列';
        if (c === 'E') opt1.selected = true;
        searchColSelect.appendChild(opt1);

        var opt2 = document.createElement('option');
        opt2.value = c;
        opt2.textContent = c + '列';
        if (c === 'G') opt2.selected = true;
        targetColSelect.appendChild(opt2);
      }
    }

    function renderPreviewTable(rows) {
      if (!previewTableBody) return;
      while (previewTableBody.firstChild) {
        previewTableBody.removeChild(previewTableBody.firstChild);
      }
      if (!rows || !rows.length) return;
      for (var r = 0; r < rows.length; r++) {
        var tr = document.createElement('tr');
        for (var c = 0; c < rows[r].length; c++) {
          var cellEl = document.createElement(r === 0 ? 'th' : 'td');
          cellEl.textContent = rows[r][c];
          tr.appendChild(cellEl);
        }
        previewTableBody.appendChild(tr);
      }
    }

    function updateRecipeUI() {
      var res = generateFormulaRecipe({
        recipeId: recipeSelect ? recipeSelect.value : 'lookup',
        keyCell: keyCellInput ? keyCellInput.value : 'A2',
        searchCol: searchColSelect ? searchColSelect.value : 'E',
        targetCol: targetColSelect ? targetColSelect.value : 'G',
        startRow: startRowInput ? startRowInput.value : 2,
        endRow: endRowInput ? endRowInput.value : 100,
        sheetName: sheetNameInput ? sheetNameInput.value : '',
        conditionText: cond1Input ? cond1Input.value : '営業部',
        conditionText2: cond2Input ? cond2Input.value : '支払済',
        emptyFallback: fallbackSelect ? fallbackSelect.value : 'blank',
        checkBlank: chkBlank ? chkBlank.checked : true,
        useIfError: chkIferror ? chkIferror.checked : true
      });

      if (descBox) descBox.textContent = res.recipe.shortDesc;
      if (primaryOut) primaryOut.textContent = res.primaryFormula;
      if (explanationOut) explanationOut.textContent = res.explanation;

      if (warnBox) {
        if (res.warningNote) {
          warnBox.textContent = res.warningNote;
          warnBox.classList.remove('hidden');
        } else {
          warnBox.textContent = '';
          warnBox.classList.add('hidden');
        }
      }

      if (secondaryWrap && secondaryLabelEl && secondaryOut) {
        if (res.secondaryFormula) {
          secondaryLabelEl.textContent = res.secondaryLabel;
          secondaryOut.textContent = res.secondaryFormula;
          secondaryWrap.classList.remove('hidden');
        } else {
          secondaryWrap.classList.add('hidden');
        }
      }

      renderPreviewTable(res.recipe.samplePreview);
    }

    // Error guide UI
    var errorSelect = document.getElementById('error-select');
    var errTitle = document.getElementById('err-title');
    var errSummary = document.getElementById('err-summary');
    var errCausesList = document.getElementById('err-causes');
    var errProTip = document.getElementById('err-protip');
    var errBefore = document.getElementById('err-before');
    var errAfter = document.getElementById('err-after');
    var errStepsList = document.getElementById('err-steps');
    var btnCopyErrAfter = document.getElementById('btn-copy-err-after');

    function updateErrorUI() {
      var errKey = errorSelect && ERROR_GUIDES[errorSelect.value] ? errorSelect.value : 'err_na';
      var g = ERROR_GUIDES[errKey];
      if (errTitle) errTitle.textContent = g.title;
      if (errSummary) errSummary.textContent = g.summary;
      if (errProTip) errProTip.textContent = g.proTip;
      if (errBefore) errBefore.textContent = g.beforeFormula;
      if (errAfter) errAfter.textContent = g.afterFormula;

      if (errCausesList) {
        while (errCausesList.firstChild) errCausesList.removeChild(errCausesList.firstChild);
        for (var i = 0; i < g.causes.length; i++) {
          var li = document.createElement('li');
          li.textContent = g.causes[i];
          errCausesList.appendChild(li);
        }
      }
      if (errStepsList) {
        while (errStepsList.firstChild) errStepsList.removeChild(errStepsList.firstChild);
        for (var j = 0; j < g.fixSteps.length; j++) {
          var li2 = document.createElement('li');
          li2.textContent = g.fixSteps[j];
          errStepsList.appendChild(li2);
        }
      }
    }

    function copyText(text, btn, defaultLabel) {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'コピーしました！';
          setTimeout(function () {
            btn.textContent = defaultLabel;
          }, 1800);
        });
      }
    }

    if (tabRecipeBtn && tabErrorBtn && panelRecipe && panelError) {
      tabRecipeBtn.addEventListener('click', function () {
        tabRecipeBtn.classList.add('active');
        tabErrorBtn.classList.remove('active');
        panelRecipe.classList.remove('hidden');
        panelError.classList.add('hidden');
      });
      tabErrorBtn.addEventListener('click', function () {
        tabErrorBtn.classList.add('active');
        tabRecipeBtn.classList.remove('active');
        panelError.classList.remove('hidden');
        panelRecipe.classList.add('hidden');
      });
    }

    var inputs = [
      recipeSelect, keyCellInput, searchColSelect, targetColSelect,
      startRowInput, endRowInput, sheetNameInput, cond1Input, cond2Input,
      fallbackSelect, chkBlank, chkIferror
    ];
    for (var k = 0; k < inputs.length; k++) {
      if (inputs[k]) {
        inputs[k].addEventListener('input', updateRecipeUI);
        inputs[k].addEventListener('change', updateRecipeUI);
      }
    }

    if (errorSelect) {
      errorSelect.addEventListener('change', updateErrorUI);
    }

    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', function () {
        if (recipeSelect) recipeSelect.value = 'lookup';
        if (keyCellInput) keyCellInput.value = 'A2';
        if (searchColSelect) searchColSelect.value = 'B';
        if (targetColSelect) targetColSelect.value = 'E';
        if (startRowInput) startRowInput.value = '2';
        if (endRowInput) endRowInput.value = '150';
        if (sheetNameInput) sheetNameInput.value = '商品マスタ';
        if (fallbackSelect) fallbackSelect.value = 'unregistered';
        if (chkBlank) chkBlank.checked = true;
        if (chkIferror) chkIferror.checked = true;
        updateRecipeUI();
      });
    }

    if (btnSwapLeftTest) {
      btnSwapLeftTest.addEventListener('click', function () {
        if (recipeSelect) recipeSelect.value = 'lookup';
        if (searchColSelect) searchColSelect.value = 'E';
        if (targetColSelect) targetColSelect.value = 'B';
        updateRecipeUI();
      });
    }

    if (copyPrimaryBtn) {
      copyPrimaryBtn.addEventListener('click', function () {
        copyText(primaryOut ? primaryOut.textContent : '', copyPrimaryBtn, 'この数式をコピーする');
      });
    }
    if (copySecondaryBtn) {
      copySecondaryBtn.addEventListener('click', function () {
        copyText(secondaryOut ? secondaryOut.textContent : '', copySecondaryBtn, 'こちらの数式をコピーする');
      });
    }
    if (btnCopyErrAfter) {
      btnCopyErrAfter.addEventListener('click', function () {
        copyText(errAfter ? errAfter.textContent : '', btnCopyErrAfter, '改善後の数式をコピーする');
      });
    }

    updateRecipeUI();
    updateErrorUI();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBrowserUI);
    } else {
      initBrowserUI();
    }
  }

  var api = {
    RECIPES: RECIPES,
    ERROR_GUIDES: ERROR_GUIDES,
    FORBIDDEN_OVERCLAIMS: FORBIDDEN_OVERCLAIMS,
    colToIndex: colToIndex,
    formatSheetPrefix: formatSheetPrefix,
    normalizeRowRange: normalizeRowRange,
    generateFormulaRecipe: generateFormulaRecipe
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KansuRecipeBuilder = api;
  }
})(typeof window !== 'undefined' ? window : this);
