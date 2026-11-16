(function (root) {
  'use strict';

  // 見本データ（3種類）
  var SAMPLES = {
    high: [
      '結論から言うと、日々の業務効率化においてAIツールを活用することは非常に重要なポイントです！💡',
      '素晴らしい視点ですね。その感覚はまさに本質を突いています。✨',
      '',
      '### 📌 成功のための3つのポイント',
      '1. **目的の明確化**：まず最初に、どの作業に時間がかかっているかを浮き彫りにすることが求められます。',
      '2. **段階的な導入**：一概には言えませんが、多角的な視点から小さく始めることが成功への近道と言っても過言ではありません。🚀',
      '3. **継続的な見直し**：定期的に効果を測定することが重要です。改善を重ねることが大切です。結果を記録することが必要です。✅',
      '',
      'いかがでしたでしょうか？ぜひ今日から実践してみてくださいね！'
    ].join('\n'),

    mid: [
      'いつもお世話になっております。',
      '結論から言うと、来週の打ち合わせ資料について3つのポイントをご報告いたします。',
      '',
      '・**スケジュールについて**：現在の進捗はおおむね順調です。',
      '・**課題の整理**：コスト削減という観点から、いくつかの改善案が挙げられます。',
      '・**今後の対応**：多角的な視点から検討を進めることが重要です。引き続きよろしくお願いいたします。'
    ].join('\n'),

    low: [
      'お疲れさまです。来週火曜（11/24）の打ち合わせ資料の下書きができましたので共有します。',
      '',
      '前回ご相談した「発送リストの入力ミス」ですが、原因は郵便番号のハイフン有無が混ざっていたことでした。',
      '対策として、入力シートのB列に自動でハイフンをそろえる数式を入れています（作業時間は1回あたり約15分減る見込みです）。',
      '',
      '3ページ目の図だけまだ仮の状態ですので、明日15時までに差し替えてお送りします。気になる点があれば教えてください。'
    ].join('\n')
  };

  // 検出ルール辞書（カテゴリ別）
  var RULES = [
    // ① AI記号・定番絵文字の残り (sym)
    {
      cat: 'sym',
      label: 'Markdownの太字記号（**）の露出',
      regex: /\*\*[^*\n]+\*\*/g,
      weight: 14,
      tip: 'メールやSNS・noteの下書きに「**」がそのまま残っています。「1クリックお掃除」ボタンで一括削除できます。'
    },
    {
      cat: 'sym',
      label: 'Markdownの見出し記号（###）の露出',
      regex: /^#{1,6}[ \t]+(?=\S)/gm,
      weight: 12,
      tip: '行頭の「### 」はAIの出力そのままに見えます。■や【 】に変えるか、お掃除ボタンで消すと自然です。'
    },
    {
      cat: 'sym',
      label: 'AI定番の絵文字（💡📌🚀✅✨🔍）',
      regex: /(?:💡|📌|🚀|✅|✨|🔍|🎯|📝|🌟)/gu,
      weight: 6,
      tip: '💡・📌・🚀・✅・✨が並ぶと一目でAI文面だと気づかれやすくなります。1〜2個に絞るか消すのがおすすめです。'
    },

    // ② お決まりAI構文・チャッピー定型句 (phrase)
    {
      cat: 'phrase',
      label: '「結論から言うと」',
      regex: /結論から言うと|結論からお伝えすると|結論から申し上げますと/g,
      weight: 12,
      tip: '前置きを削り、いきなり結論の中身（「〇〇は△△です」など）から書き始めると人間らしい文章になります。'
    },
    {
      cat: 'phrase',
      label: '「いかがでしたでしょうか」',
      regex: /いかがでしたでしょうか[？?]?|いかがだったでしょうか[？?]?/g,
      weight: 14,
      tip: 'AIや量産記事の定番の締め言葉です。「まずは〇〇から試してみてください」など具体的な行動に変えると自然です。'
    },
    {
      cat: 'phrase',
      label: '「〜と言っても過言ではありません」',
      regex: /と言っても過言ではありません|といっても過言ではないでしょう/g,
      weight: 13,
      tip: '大げさなAI定型句です。「〜と言えます」「〜だからこそ大切です」とシンプルに言い切る方が信頼されます。'
    },
    {
      cat: 'phrase',
      label: '「一概には言えませんが」',
      regex: /一概には言えませんが|一概には言えないものの/g,
      weight: 10,
      tip: 'AIが断定を避けるときの口ぐせです。「〇〇の場合は△△です」と条件を具体的に書く方が親切です。'
    },
    {
      cat: 'phrase',
      label: '「ポイントは〇つあります」宣言',
      regex: /(?:ポイント|理由|ステップ|注意点)は[次の以下の]*[0-9０-９一二三四五35]+つ(?:あります|です)/g,
      weight: 9,
      tip: '悪くはありませんが、毎回使うとAI特有の型に見えます。「特に気をつけたいのは次の〇点です」などに変えると柔らかくなります。'
    },
    {
      cat: 'phrase',
      label: '「〜が挙げられます」',
      regex: /が挙げられます/g,
      weight: 8,
      tip: '説明書っぽく突き放した印象になります。「たとえば〇〇があります」「よく起きるのは〇〇です」と言い換えると読みやすくなります。'
    },

    // ③ 過剰なヨイショ・優等生フレーズ (praise)
    {
      cat: 'praise',
      label: '過剰なヨイショ（「素晴らしい視点」「本質を突いて」）',
      regex: /素晴らしい視点ですね|本質を突いて|非常に重要なポイントです|まさにその通りです|その感覚は[、,]*むしろ/g,
      weight: 15,
      tip: 'AIの返答でよく見る「全肯定のほめ言葉」です。ビジネス文書や記事に残っていると強い違和感が出るため削除しましょう。'
    },
    {
      cat: 'praise',
      label: '優等生な義務表現（「〜することが重要です／求められます」）',
      regex: /することが重要です|することが求められます|することが不可欠です|することが大切です|することが必要です/g,
      weight: 9,
      tip: '上から目線の教科書調に聞こえます。「〜しておくと安心です」「〜すると手間が減ります」とメリットで書くと自然です。'
    },

    // ④ 翻訳調・硬すぎる抽象語 (abst)
    {
      cat: 'abst',
      label: '「多角的な視点から」',
      regex: /多角的な視点から|多面的な視点で/g,
      weight: 11,
      tip: '中身がない抽象語の代表例です。「費用と手間の両面から」「使う人と作る人の目線で」のように具体化しましょう。'
    },
    {
      cat: 'abst',
      label: '「〜を浮き彫りにする」',
      regex: /を浮き彫りに/g,
      weight: 11,
      tip: '英語（highlight）の直訳調のAI表現です。「〜がはっきり分かります」「〜の原因が見えてきます」に直すと自然です。'
    },
    {
      cat: 'abst',
      label: '「〜において」「〜という観点から」',
      regex: /において[、,]|という観点から|の文脈において|を最大化するため/g,
      weight: 8,
      tip: '硬い翻訳調です。「〜では」「〜の面から」「〜をもっと活かすため」と平易な言葉にほどくとスッと読めます。'
    }
  ];

  // ⑤ 同じ語尾の3連続を検出する関数
  function findRepeatedEndings(text) {
    var results = [];
    if (!text || !text.trim()) return results;

    // 句点・改行・感嘆符・疑問符で文に分割（位置情報つき）
    var sentenceRegex = /[^。！？!?\n]+[。！？!?]?/g;
    var match;
    var sentences = [];
    while ((match = sentenceRegex.exec(text)) !== null) {
      var raw = match[0];
      var trimmed = raw.trim();
      if (trimmed.length < 4) continue;
      // 箇条書きの先頭などを除き文末パターンを判定
      var ending = null;
      if (/です[。！？!?]?$/.test(trimmed)) ending = '〜です';
      else if (/ます[。！？!?]?$/.test(trimmed)) ending = '〜ます';
      else if (/せん[。！？!?]?$/.test(trimmed)) ending = '〜せん';
      else if (/しょう[。！？!?]?$/.test(trimmed)) ending = '〜しょう';
      else if (/した[。！？!?]?$/.test(trimmed)) ending = '〜した';

      sentences.push({
        start: match.index,
        end: match.index + raw.length,
        text: raw,
        ending: ending
      });
    }

    var streak = 1;
    for (var i = 1; i < sentences.length; i++) {
      if (sentences[i].ending && sentences[i].ending === sentences[i - 1].ending) {
        streak++;
        if (streak >= 3) {
          results.push({
            cat: 'end',
            label: '同じ語尾（' + sentences[i].ending + '）の3連続以上',
            matchText: sentences[i].text.trim(),
            start: sentences[i].start,
            end: sentences[i].end,
            weight: 4,
            tip: '「' + sentences[i].ending + '」が3回以上続いています。途中の1文を体言止めや「〜ためです」「〜しましょう」に変えるとリズムが良くなります。'
          });
        }
      } else {
        streak = 1;
      }
    }
    return results;
  }

  // 文章全体を診断するメイン関数
  function analyzeText(text) {
    var source = String(text || '');
    if (!source.trim()) {
      return {
        score: 0,
        charCount: 0,
        sentenceCount: 0,
        rank: '文字を入力してください',
        level: 'good',
        comment: '左の入力欄に文章を入れるか、「見本①〜③」ボタンを押すと3秒で診断結果が出ます。',
        counts: { sym: 0, phrase: 0, praise: 0, abst: 0, end: 0 },
        barWidths: { sym: 0, phrase: 0, praise: 0, abst: 0, end: 0 },
        findings: [],
        spans: []
      };
    }

    var counts = { sym: 0, phrase: 0, praise: 0, abst: 0, end: 0 };
    var points = { sym: 0, phrase: 0, praise: 0, abst: 0, end: 0 };
    var findingsMap = {};
    var spans = [];

    // 1〜4のルール検出
    for (var r = 0; r < RULES.length; r++) {
      var rule = RULES[r];
      var re = new RegExp(rule.regex.source, rule.regex.flags);
      var m;
      while ((m = re.exec(source)) !== null) {
        counts[rule.cat]++;
        points[rule.cat] += rule.weight;
        spans.push({
          start: m.index,
          end: m.index + m[0].length,
          cat: rule.cat,
          text: m[0]
        });
        if (!findingsMap[rule.label]) {
          findingsMap[rule.label] = {
            cat: rule.cat,
            label: rule.label,
            count: 0,
            sample: m[0],
            tip: rule.tip
          };
        }
        findingsMap[rule.label].count++;
      }
    }

    // 5. 語尾の連続検出
    var endMatches = findRepeatedEndings(source);
    for (var e = 0; e < endMatches.length; e++) {
      var em = endMatches[e];
      counts.end++;
      points.end += em.weight;
      spans.push({
        start: em.start,
        end: em.end,
        cat: 'end',
        text: em.matchText
      });
      if (!findingsMap[em.label]) {
        findingsMap[em.label] = {
          cat: 'end',
          label: em.label,
          count: 0,
          sample: em.matchText,
          tip: em.tip
        };
      }
      findingsMap[em.label].count++;
    }

    // 具体数字が1つもない場合の軽微な加算（100文字以上のとき）
    var hasNumbers = /[0-9０-９]/.test(source);
    if (source.trim().length >= 100 && !hasNumbers) {
      counts.end++;
      points.end += 8;
      findingsMap['具体的な数字（日付・回数・割合など）が0個'] = {
        cat: 'end',
        label: '具体的な数字（日付・回数・割合など）が0個',
        count: 1,
        sample: '数字なし',
        tip: '文章全体で数字が1つも使われていません。「3つの手順」「約10分」のように数字を1〜2個入れるだけで説得力がぐっと上がります。'
      };
    }

    // スコア算出（各カテゴリに上限を設けて合計100%満点にする：お掃除で記号を消すと確実に約25%下がる設計）
    var cappedSym = Math.min(26, points.sym);
    var cappedPhrase = Math.min(24, points.phrase);
    var cappedPraise = Math.min(20, points.praise);
    var cappedAbst = Math.min(18, points.abst);
    var cappedEnd = Math.min(12, points.end);
    var rawScore = cappedSym + cappedPhrase + cappedPraise + cappedAbst + cappedEnd;
    var score = Math.min(100, Math.round(rawScore));

    // メーターバーの幅（各カテゴリ最大100%）
    var barWidths = {
      sym: Math.min(100, counts.sym * 25),
      phrase: Math.min(100, counts.phrase * 30),
      praise: Math.min(100, counts.praise * 35),
      abst: Math.min(100, counts.abst * 30),
      end: Math.min(100, counts.end * 35)
    };

    var rank = '';
    var level = 'good';
    var comment = '';

    if (score >= 70) {
      rank = 'チャッピー構文・丸出し級（要注意）';
      level = 'danger';
      comment = 'AI特有の記号や決まり文句が多く残っています。そのまま出すと「AIでコピペしたな」と気づかれやすい状態です。下の「1クリックお掃除」と言い換えヒントで整えましょう！';
    } else if (score >= 40) {
      rank = 'AI風味・やや強め（手直し推奨）';
      level = 'warn';
      comment = '内容は整っていますが、優等生すぎる言い回しや定型句がちらほら混ざっています。色がついた箇所を2〜3か所ほどくだけで、ぐっと人間らしい文章になります。';
    } else if (score >= 15) {
      rank = 'ほぼ自然な文章（あと一歩！）';
      level = 'good';
      comment = 'かなり自然で読みやすい文章です！ハイライトされた細かいクセだけ軽く見直せばバッチリです。';
    } else {
      rank = '人間味バッチリ！（自然な文章）';
      level = 'good';
      comment = 'AI特有のイヤな口ぐせや記号の消し忘れは見当たりません。具体的で読み手にすっと伝わる自然な文章です！';
    }

    var findings = Object.keys(findingsMap).map(function (k) {
      return findingsMap[k];
    });

    // 文の数を数える
    var sents = source.split(/[。！？!?\n]+/).filter(function (s) {
      return s.trim().length > 0;
    });

    return {
      score: score,
      charCount: source.length,
      sentenceCount: sents.length,
      rank: rank,
      level: level,
      comment: comment,
      counts: counts,
      barWidths: barWidths,
      findings: findings,
      spans: mergeSpans(spans)
    };
  }

  // ハイライト区間が重ならないように整列・統合する関数
  function mergeSpans(spans) {
    if (!spans || spans.length === 0) return [];
    var sorted = spans.slice().sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });
    var result = [];
    var current = sorted[0];
    for (var i = 1; i < sorted.length; i++) {
      var next = sorted[i];
      if (next.start < current.end) {
        // 重なっている場合は先行する区間を優先
        continue;
      } else {
        result.push(current);
        current = next;
      }
    }
    result.push(current);
    return result;
  }

  // 1クリックお掃除機能
  function cleanAiText(text, options) {
    var opts = options || { cleanMd: true, cleanEmoji: true, cleanColon: true };
    var out = String(text || '');

    if (opts.cleanMd) {
      // **太字** -> 太字
      out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
      // ### 見出し -> ■ 見出し
      out = out.replace(/^#{1,6}[ \t]+(.+)$/gm, '■ $1');
    }

    if (opts.cleanEmoji) {
      // 定番AI絵文字とその前後の余分な半角スペースを整理
      out = out.replace(/(?:💡|📌|🚀|✅|✨|🔍|🎯|📝|🌟)️?[ \t]?/gu, '');
    }

    if (opts.cleanColon) {
      // 「1. 〇〇：〜」や「・〇〇：〜」を「・〇〇 ── 〜」ではなく読みやすい「・〇〇（〜）」または自然な読点・改行へ整える
      out = out.replace(/^([ \t]*(?:[0-9０-９]+\.(?![0-9０-９])|[・\-*]))[ \t]*([^：\n]{2,20})：/gm, '$1$2　');
    }

    return out;
  }

  // ブラウザ画面のDOM更新（innerHTML不使用）
  function initBrowser() {
    if (typeof document === 'undefined') return;

    var sourceEl = document.getElementById('source-text');
    var charCountEl = document.getElementById('char-count');
    var sentenceCountEl = document.getElementById('sentence-count');
    var scoreCardEl = document.getElementById('score-card');
    var scoreValueEl = document.getElementById('score-value');
    var rankBadgeEl = document.getElementById('rank-badge');
    var rankCommentEl = document.getElementById('rank-comment');
    var highlightBoxEl = document.getElementById('highlight-preview');
    var adviceListEl = document.getElementById('advice-list');
    var cleanStatusEl = document.getElementById('clean-status');
    var shareStatusEl = document.getElementById('share-status');

    if (!sourceEl) return;

    function render() {
      var text = sourceEl.value;
      var res = analyzeText(text);

      charCountEl.textContent = res.charCount + '文字';
      sentenceCountEl.textContent = res.sentenceCount + '文';
      scoreValueEl.textContent = String(res.score);
      rankBadgeEl.textContent = res.rank;
      rankCommentEl.textContent = res.comment;

      scoreCardEl.className = 'score-card level-' + res.level;

      // 5項目メーター更新
      var cats = ['sym', 'phrase', 'praise', 'abst', 'end'];
      for (var i = 0; i < cats.length; i++) {
        var c = cats[i];
        var cntEl = document.getElementById('count-' + c);
        var barEl = document.getElementById('bar-' + c);
        if (cntEl) cntEl.textContent = res.counts[c] + '箇所';
        if (barEl) barEl.style.width = res.barWidths[c] + '%';
      }

      // ハイライト表示の安全な構築（createElement + textContent）
      while (highlightBoxEl.firstChild) {
        highlightBoxEl.removeChild(highlightBoxEl.firstChild);
      }
      if (!text.trim()) {
        highlightBoxEl.textContent = 'ここに色分けされた文章が表示されます。';
      } else {
        var cursor = 0;
        for (var s = 0; s < res.spans.length; s++) {
          var sp = res.spans[s];
          if (sp.start > cursor) {
            highlightBoxEl.appendChild(document.createTextNode(text.slice(cursor, sp.start)));
          }
          var mark = document.createElement('span');
          mark.className = 'hl-' + sp.cat;
          mark.textContent = text.slice(sp.start, sp.end);
          highlightBoxEl.appendChild(mark);
          cursor = sp.end;
        }
        if (cursor < text.length) {
          highlightBoxEl.appendChild(document.createTextNode(text.slice(cursor)));
        }
      }

      // 言い換えヒント一覧の安全な構築
      while (adviceListEl.firstChild) {
        adviceListEl.removeChild(adviceListEl.firstChild);
      }
      if (res.findings.length === 0) {
        var emptyLi = document.createElement('li');
        emptyLi.className = 'advice-empty';
        emptyLi.textContent = text.trim()
          ? 'AI特有の気になる口ぐせや記号残りは検出されませんでした！'
          : 'まだ検出された項目はありません。';
        adviceListEl.appendChild(emptyLi);
      } else {
        for (var f = 0; f < res.findings.length; f++) {
          var item = res.findings[f];
          var li = document.createElement('li');
          li.className = 'advice-item cat-' + item.cat;

          var titleSpan = document.createElement('span');
          titleSpan.className = 'advice-target';
          titleSpan.textContent = '● ' + item.label + '（' + item.count + '箇所）';

          var tipSpan = document.createElement('span');
          tipSpan.className = 'advice-tip';
          tipSpan.textContent = '→ 直し方のコツ：' + item.tip;

          li.appendChild(titleSpan);
          li.appendChild(tipSpan);
          adviceListEl.appendChild(li);
        }
      }
    }

    sourceEl.addEventListener('input', function () {
      cleanStatusEl.textContent = '';
      shareStatusEl.textContent = '';
      undoText = null; if (btnUndo) btnUndo.disabled = true; render();
    });

    // 見本ボタン
    var btnHigh = document.getElementById('btn-sample-high');
    var btnMid = document.getElementById('btn-sample-mid');
    var btnLow = document.getElementById('btn-sample-low');
    var btnClear = document.getElementById('btn-clear');

    if (btnHigh) {
      btnHigh.addEventListener('click', function () {
        sourceEl.value = SAMPLES.high;
        cleanStatusEl.textContent = '「見本①：AI丸出しのブログ文」を読み込みました。';
        undoText = null; if (btnUndo) btnUndo.disabled = true; render();
      });
    }
    if (btnMid) {
      btnMid.addEventListener('click', function () {
        sourceEl.value = SAMPLES.mid;
        cleanStatusEl.textContent = '「見本②：AIっぽい連絡メール」を読み込みました。';
        undoText = null; if (btnUndo) btnUndo.disabled = true; render();
      });
    }
    if (btnLow) {
      btnLow.addEventListener('click', function () {
        sourceEl.value = SAMPLES.low;
        cleanStatusEl.textContent = '「見本③：自然な人間の文章」を読み込みました。';
        undoText = null; if (btnUndo) btnUndo.disabled = true; render();
      });
    }
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        sourceEl.value = '';
        cleanStatusEl.textContent = '';
        shareStatusEl.textContent = '';
        undoText = null; if (btnUndo) btnUndo.disabled = true; render();
      });
    }

    // 1クリックお掃除ボタン
    var btnCleanApply = document.getElementById('btn-clean-apply');
    var btnUndo = document.getElementById('btn-undo');
    var undoText = null;
    if (btnUndo) {
      btnUndo.addEventListener('click', function () {
        if (undoText === null) return;
        sourceEl.value = undoText;
        undoText = null;
        btnUndo.disabled = true;
        render();
        cleanStatusEl.textContent = 'お掃除の前の文章に戻しました。';
      });
    }
    if (btnCleanApply) {
      btnCleanApply.addEventListener('click', function () {
        if (!sourceEl.value.trim()) {
          cleanStatusEl.textContent = '先に文章を入力するか、見本ボタンを押してください。';
          return;
        }
        var beforeRes = analyzeText(sourceEl.value);
        var opts = {
          cleanMd: document.getElementById('opt-clean-md').checked,
          cleanEmoji: document.getElementById('opt-clean-emoji').checked,
          cleanColon: document.getElementById('opt-clean-colon').checked
        };
        undoText = sourceEl.value;
        if (btnUndo) btnUndo.disabled = false;
        sourceEl.value = cleanAiText(sourceEl.value, opts);
        var afterRes = analyzeText(sourceEl.value);
        cleanStatusEl.textContent = (afterRes.score < beforeRes.score) ? ('お掃除しました。AIっぽさの目安が ' + beforeRes.score + '点 → ' + afterRes.score + '点 になりました。') : ('お掃除しました（目安の点数は ' + afterRes.score + '点 のままです。色の付いた所は手で直してください）。');
        render();
      });
    }

    // 文章コピー
    var btnCopyText = document.getElementById('btn-copy-text');
    if (btnCopyText) {
      btnCopyText.addEventListener('click', function () {
        if (!sourceEl.value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(sourceEl.value).then(function () {
            cleanStatusEl.textContent = '文章をクリップボードにコピーしました！';
          }, function () { cleanStatusEl.textContent = 'コピーできませんでした。文章を選んで Ctrl+C でコピーしてください。'; });
        }
      });
    }

    // SNSシェア用コピー
    var btnCopyShare = document.getElementById('btn-copy-share');
    if (btnCopyShare) {
      btnCopyShare.addEventListener('click', function () {
        if (!sourceEl.value.trim()) {
          shareStatusEl.textContent = '先に文章を入れてください。';
          return;
        }
        var res = analyzeText(sourceEl.value);
        var shareText = '私の文章の「AIっぽさ（チャッピー構文度）」は【' + res.score + '点（' + res.rank + '）】でした！\n#AIっぽさ診断 #文章のAIっぽさチェッカー\nhttps://oshirase-tools.github.io/ai-check/';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareText).then(function () {
            shareStatusEl.textContent = 'シェア用テキストをコピーしました！';
          }, function () { shareStatusEl.textContent = 'コピーできませんでした。'; });
        }
      });
    }

    // 初期表示は見本①を入れた状態で即体験できるようにする
    sourceEl.value = SAMPLES.high;
    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBrowser);
    } else {
      initBrowser();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SAMPLES: SAMPLES,
      RULES: RULES,
      analyzeText: analyzeText,
      cleanAiText: cleanAiText,
      findRepeatedEndings: findRepeatedEndings
    };
  } else {
    root.AiCheckApp = {
      SAMPLES: SAMPLES,
      analyzeText: analyzeText,
      cleanAiText: cleanAiText
    };
  }
})(typeof window !== 'undefined' ? window : this);
