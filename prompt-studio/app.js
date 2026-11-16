(function (root) {
  'use strict';

  // 作る物の種類ごとの決まり
  var KINDS = {
    header: {
      label: 'note・ブログの見出し画像',
      shapes: [
        { id: 'wide', label: '横長（16:9 で作り、後で上下を少し切る）', text: '横長（横:縦が16:9）。後で上下を少し切って横1280×縦670にするので、上下の端には大事な物を置かない' }
      ],
      purpose: 'note やブログ記事のいちばん上に置く見出し画像',
      layout: '左側に文字を置ける広い空き、右側に主題を置く。スマホで小さく表示されても主題が分かるように、主題は大きく1つにする',
      textLimit: 15
    },
    sns: {
      label: 'SNS の投稿画像',
      shapes: [
        { id: 'square', label: '正方形（1:1）', text: '正方形（横:縦が1:1）' },
        { id: 'portrait', label: '縦長（4:5）', text: '縦長（横:縦が4:5）' }
      ],
      purpose: 'X・Threads・Instagram の投稿に付ける画像',
      layout: '画面の中央に主題を大きく置く。上下の端は切れても困らないように、大事な物は中央に寄せる',
      textLimit: 12
    },
    video: {
      label: '8秒の短い動画',
      shapes: [
        { id: 'landscape', label: '横長（16:9）', text: '横長（横:縦が16:9）' },
        { id: 'vertical', label: '縦長（9:16・ショート動画）', text: '縦長（横:縦が9:16）' }
      ],
      purpose: '商品やサービスの紹介に使う、約8秒の短い動画',
      layout: '最初の1秒で何の動画か分かるように、主題を最初から画面に出す。場面の切り替えは0〜1回にする',
      textLimit: 10
    },
    diagram: {
      label: '手順・仕組みの図解',
      shapes: [
        { id: 'landscape', label: '横長（16:9）', text: '横長（横:縦が16:9）' },
        { id: 'square', label: '正方形（1:1）', text: '正方形（横:縦が1:1）' }
      ],
      purpose: '手順や仕組みを1枚で伝える図解',
      layout: '左から右（または上から下）へ、番号つきの四角を矢印でつなぐ。四角の数は書いた手順の数と同じにする',
      textLimit: 8
    }
  };

  var MOODS = {
    soft: 'やさしく親しみやすい',
    clean: 'すっきりして清潔感がある',
    pop: '明るく元気',
    calm: '落ち着いていて信頼感がある',
    premium: '上品で高級感がある'
  };

  var STYLES = {
    illust: 'やわらかいイラスト',
    flat: '線と面だけのシンプルな図（フラットデザイン）',
    photo: '写真のような見た目',
    hand: '手書き風のイラスト'
  };

  var MOTIONS = {
    zoom: 'カメラがゆっくり主題に近づく',
    pan: 'カメラがゆっくり左から右へ動く',
    still: 'カメラは動かさず、主題だけが少し動く'
  };

  var MAX_SUBJECT = 200;
  var MAX_STEPS = 6;

  // 実在の作品や人に似せる指示を見つけるための言葉
  var RISKY_WORDS = ['そっくり', '似せて', 'のような絵柄', '風の絵柄', 'ジブリ', 'ディズニー', 'ピクサー', 'ポケモン', 'ピカチュウ', 'ドラえもん', 'ミッキー', 'ロゴを', '芸能人', '有名人'];

  // 文字数は絵文字なども1文字として数える
  function len(s) { return Array.from(s).length; }
  function cut(s, max) { var a = Array.from(s); return a.length > max ? a.slice(0, max).join('') : s; }

  function clean(s, max) {
    var t = String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
    if (max) t = cut(t, max);
    return t;
  }

  function splitSteps(s) {
    return String(s == null ? '' : s).split('\n')
      .map(function (x) { return x.replace(/^\s*(?:[0-9０-９]+(?:[.．](?![0-9０-９])|[、)）])|[・\-*])\s*/, '').trim(); })
      .filter(function (x) { return x.length > 0; });
  }

  // 作る物ごとの「文字の入れ方」の選び方
  var TEXT_MODES = {
    normal: [
      { id: 'inside', label: '短い文字を1か所だけ入れる' },
      { id: 'later', label: '文字は入れない（後から自分で入れる）' }
    ],
    diagram: [
      { id: 'none', label: '文字なし（後から自分で入れる）' },
      { id: 'numbers', label: '四角に番号だけ入れる' },
      { id: 'words', label: '四角に手順の短い言葉を入れる（8文字まで）' }
    ]
  };
  var STEP_WORD_LIMIT = 8;

  // 指示文を組み立てる（入力は外へ送らない。文字を組み合わせるだけ）
  function buildPrompt(input) {
    var inp = input || {};
    var kind = KINDS[inp.kind] ? inp.kind : 'header';
    var k = KINDS[kind];
    var warnings = [];
    var rawSubject = clean(inp.subject, 0);
    var subject = clean(inp.subject, MAX_SUBJECT);
    var text = clean(inp.text, 40);
    var colors = clean(inp.colors, 60);
    var shape = k.shapes.filter(function (s) { return s.id === inp.shape; })[0] || k.shapes[0];
    var mood = MOODS[inp.mood] || MOODS.soft;
    var style = STYLES[inp.style] || (kind === 'diagram' ? STYLES.flat : STYLES.illust);
    var modes = kind === 'diagram' ? TEXT_MODES.diagram : TEXT_MODES.normal;
    var textMode = modes.some(function (m) { return m.id === inp.textMode; }) ? inp.textMode : modes[0].id;
    var where = kind === 'video' ? '動画' : '画像';

    if (!subject) {
      return { ok: false, prompt: '', warnings: ['「何を見せるか」を書いてください。'] };
    }
    if (len(rawSubject) > MAX_SUBJECT) {
      warnings.push('「何を見せるか」が長いので、はじめの' + MAX_SUBJECT + '文字だけを使いました。');
    }
    if (len(subject) < 6) {
      warnings.push('「何を見せるか」が短いと、AI が思いどおりの絵を出しにくくなります。だれが・どこで・何をしているかを足すと伝わりやすくなります。');
    }
    var usesText = kind !== 'diagram' && textMode === 'inside';
    var joined = subject + ' ' + (usesText ? text : '') + ' ' + colors + ' ' + (kind === 'diagram' ? String(inp.steps || '') : '');
    var risky = RISKY_WORDS.filter(function (w) { return joined.indexOf(w) !== -1; });
    if (risky.length) {
      warnings.push('「' + risky.join('」「') + '」が入っています。実在の作品・キャラクター・人・ロゴに似せた' + where + 'は、権利の問題になることがあります。「やわらかい色のイラスト」のように、見た目の特徴の言葉に置きかえてください（このページは、似せる言葉をすべては見つけられません）。' + (risky.indexOf('ロゴを') !== -1 ? '自分のお店のロゴは、AI に描かせず後から重ねてください。' : ''));
    }

    var lines = [];
    lines.push('次の条件で、' + where + 'を1つ作ってください。');
    lines.push('');
    lines.push('【使い道】' + k.purpose);
    lines.push('【見せたい物】' + subject);

    var steps = [];
    if (kind === 'diagram') {
      steps = splitSteps(inp.steps);
      if (steps.length === 0) {
        warnings.push('図解の手順が空です。1行に1つずつ、手順を書いてください（' + MAX_STEPS + 'つまで）。');
      }
      if (steps.length > MAX_STEPS) {
        warnings.push('手順が' + steps.length + 'つあります。1枚の図で読めるように、はじめの' + MAX_STEPS + 'つだけを使いました。');
        steps = steps.slice(0, MAX_STEPS);
      }
      if (steps.some(function (s) { return len(s) > 40; })) {
        warnings.push('40文字より長い手順があるので、はじめの40文字だけを使いました。');
      }
      steps = steps.map(function (s) { return clean(s, 40); });
      if (textMode === 'words' && steps.some(function (s) { return len(s) > STEP_WORD_LIMIT; })) {
        warnings.push('「四角に手順の短い言葉を入れる」を選んでいますが、' + STEP_WORD_LIMIT + '文字より長い手順があります。AI は長い日本語をよく書き間違えるので、各手順を' + STEP_WORD_LIMIT + '文字以内に短くするか、「文字なし」を選んでください。');
      }
      if (steps.length) {
        lines.push('【図にする手順】' + (textMode === 'words' ? '（四角の中には、この言葉をそのまま入れる）' : '（この言葉は絵を選ぶための説明です）'));
        for (var i = 0; i < steps.length; i++) {
          lines.push((i + 1) + '. ' + steps[i]);
        }
      }
    } else {
      if (textMode === 'inside' && !text) {
        warnings.push('「短い文字を1か所だけ入れる」を選んでいますが、「入れる文字」が空なので、文字なしで作る指示にしました。');
      }
      if (textMode === 'inside' && text && len(text) > k.textLimit) {
        warnings.push(where + 'に入れる文字が' + len(text) + '文字あります。AI は長い日本語の文字をよく間違えるので、' + k.textLimit + '文字以内にするか、文字は後から自分で入れるのがおすすめです。');
      }
    }

    lines.push('【形】' + shape.text);
    lines.push('【配置】' + k.layout);
    lines.push('【雰囲気】' + mood);
    lines.push('【絵のタッチ】' + style);
    lines.push('【色】' + (colors ? colors + 'を中心に、使う色は3〜4色までにする' : '使う色は3〜4色までにする'));

    if (kind === 'video') {
      var motion = MOTIONS[inp.motion] || MOTIONS.zoom;
      lines.push('【長さ】約8秒（サービスで長さが決まっている場合は、その長さで）');
      lines.push('【動き】' + motion + '。速い動きや点滅は入れない');
      lines.push('【音】なし（あとから自分で付ける）');
    }

    if (kind === 'diagram') {
      if (textMode === 'words' && steps.length) {
        lines.push('【文字】各四角に、上の手順の言葉だけを太く大きな字で入れる。ほかの文字は入れない');
      } else if (textMode === 'numbers' && steps.length) {
        lines.push('【文字】各四角には番号（1〜' + Math.max(steps.length, 1) + '）だけを入れる。上の手順の言葉や、ほかの文字は画像に書かない。四角の中には手順に合う小さな絵（アイコン）を置く');
      } else {
        lines.push('【文字】画像には文字も数字も書かない。上の手順の言葉は、絵を選ぶための説明として使う。四角の中には手順に合う小さな絵（アイコン）を置き、後から文字を入れる空きを残す');
      }
    } else if (textMode === 'inside' && text) {
      lines.push('【' + where + 'に入れる文字】「' + text + '」だけを、太く大きな字で1か所に入れる。ほかの文字は入れない');
    } else {
      lines.push('【文字】' + where + 'の中には文字を入れない' + (textMode === 'later' ? '。文字を置くための空きだけを作る' : ''));
    }

    var avoid = ['実在の人物の顔', '実在の会社名・商品名・ロゴ', '既存のキャラクターや作品に似た絵'];
    if (inp.noHands) avoid.push('手や指のアップ（形が崩れやすいため）');
    lines.push('【入れないもの】' + avoid.join('、'));
    lines.push('');
    lines.push('できあがったら、上の条件と合っていない所があれば、どこかを短く教えてください。');

    return { ok: true, prompt: lines.join('\n'), warnings: warnings, kind: kind, steps: steps.length, textMode: textMode };
  }

  var SAMPLES = {
    header: {
      kind: 'header', subject: '机の上で、散らかったメモの紙が、きれいな1枚の手順書にまとまっていく様子',
      mood: 'clean', style: 'illust', colors: '紺と白とうすい黄色', text: '手順書の作り方', textMode: 'inside', shape: 'wide'
    },
    sns: {
      kind: 'sns', subject: 'ノートパソコンの画面に、色分けされた表が映っている。横にコーヒーカップ',
      mood: 'soft', style: 'illust', colors: '緑とベージュ', text: '', textMode: 'later', shape: 'square'
    },
    video: {
      kind: 'video', subject: 'スマホの画面で、ボタンを押すと文章の一部に色が付く様子（画面の中身は架空）',
      mood: 'pop', style: 'flat', colors: '青と白', text: '', textMode: 'later', shape: 'vertical', motion: 'zoom'
    },
    diagram: {
      kind: 'diagram', subject: 'お店の注文を受けてから発送するまでの流れ（架空のお店）',
      mood: 'calm', style: 'flat', colors: '紺とグレー', textMode: 'none', shape: 'landscape',
      steps: '注文のメールを確かめる\n在庫を表で確かめる\n箱に入れて送り状を貼る\n発送のお知らせを送る'
    }
  };

  // ---- 画面 ----
  function initBrowser() {
    if (typeof document === 'undefined') return;
    var $ = function (id) { return document.getElementById(id); };
    var kindEl = $('kind'), subjectEl = $('subject'), moodEl = $('mood'), styleEl = $('style'), colorsEl = $('colors');
    var textEl = $('img-text'), textModeEl = $('text-mode'), shapeEl = $('shape'), motionEl = $('motion'), stepsEl = $('steps');
    var noHandsEl = $('no-hands'), outEl = $('output'), warnEl = $('warnings'), statusEl = $('copy-status');
    if (!kindEl) return;

    function fillShapes(kind, keep) {
      var shapes = KINDS[kind].shapes;
      while (shapeEl.firstChild) shapeEl.removeChild(shapeEl.firstChild);
      shapes.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.id; o.textContent = s.label;
        shapeEl.appendChild(o);
      });
      if (keep && shapes.some(function (s) { return s.id === keep; })) shapeEl.value = keep;
    }

    function fillModes(kind, keep) {
      var modes = kind === 'diagram' ? TEXT_MODES.diagram : TEXT_MODES.normal;
      var cur = keep || textModeEl.value;
      while (textModeEl.firstChild) textModeEl.removeChild(textModeEl.firstChild);
      modes.forEach(function (m) {
        var o = document.createElement('option');
        o.value = m.id; o.textContent = m.label;
        textModeEl.appendChild(o);
      });
      if (modes.some(function (m) { return m.id === cur; })) textModeEl.value = cur;
    }

    function syncTextInput() {
      var usable = kindEl.value !== 'diagram' && textModeEl.value === 'inside';
      textEl.disabled = !usable;
      $('row-img-text').hidden = kindEl.value === 'diagram';
    }

    function showFor(kind) {
      $('row-motion').hidden = kind !== 'video';
      $('row-steps').hidden = kind !== 'diagram';
      document.querySelector('label[for=text-mode]').textContent = kind === 'video' ? '動画の中の文字' : '画像の中の文字';
      $('text-limit').textContent = KINDS[kind].textLimit + '文字以内がおすすめ';
    }

    function render() {
      syncTextInput();
      var res = buildPrompt({
        kind: kindEl.value, subject: subjectEl.value, mood: moodEl.value, style: styleEl.value,
        colors: colorsEl.value, text: textEl.value, textMode: textModeEl.value, shape: shapeEl.value,
        motion: motionEl.value, steps: stepsEl.value, noHands: noHandsEl.checked
      });
      outEl.value = res.prompt;
      while (warnEl.firstChild) warnEl.removeChild(warnEl.firstChild);
      res.warnings.forEach(function (w) {
        var li = document.createElement('li');
        li.textContent = w;
        warnEl.appendChild(li);
      });
      $('warn-box').hidden = res.warnings.length === 0;
      $('btn-copy').disabled = !res.ok;
      statusEl.textContent = '';
    }

    function loadSample(name) {
      var s = SAMPLES[name];
      kindEl.value = s.kind;
      fillShapes(s.kind, s.shape);
      showFor(s.kind);
      subjectEl.value = s.subject; moodEl.value = s.mood; styleEl.value = s.style;
      colorsEl.value = s.colors || ''; textEl.value = s.text || ''; fillModes(s.kind, s.textMode);
      motionEl.value = s.motion || 'zoom'; stepsEl.value = s.steps || '';
      render();
      statusEl.textContent = '見本（' + KINDS[s.kind].label + '）を入れました。';
    }

    kindEl.addEventListener('change', function () {
      fillShapes(kindEl.value);
      fillModes(kindEl.value);
      if (kindEl.value === 'diagram') { styleEl.value = 'flat'; }
      showFor(kindEl.value);
      render();
    });
    [subjectEl, moodEl, styleEl, colorsEl, textEl, textModeEl, shapeEl, motionEl, stepsEl, noHandsEl].forEach(function (el) {
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', render);
    });
    Object.keys(SAMPLES).forEach(function (name) {
      var b = $('sample-' + name);
      if (b) b.addEventListener('click', function () { loadSample(name); });
    });
    $('btn-clear').addEventListener('click', function () {
      subjectEl.value = ''; colorsEl.value = ''; textEl.value = ''; stepsEl.value = '';
      render();
    });
    $('btn-copy').addEventListener('click', function () {
      if (!outEl.value) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(outEl.value).then(function () {
          statusEl.textContent = '指示文をコピーしました。Gemini や ChatGPT の入力欄に貼ってください。';
        }, function () {
          outEl.focus(); outEl.select();
          statusEl.textContent = 'コピーできませんでした。指示文を選んだので、Ctrl+C（スマホは長押し→コピー）でコピーしてください。';
        });
      } else {
        outEl.focus(); outEl.select();
        statusEl.textContent = '指示文を選びました。Ctrl+C（スマホは長押し→コピー）でコピーしてください。';
      }
    });

    if (!subjectEl.value.trim()) {
      loadSample('header');
      statusEl.textContent = '見本が入っています。「何を見せるか」などを書きかえてください。';
    } else {
      fillShapes(kindEl.value, shapeEl.value); fillModes(kindEl.value); showFor(kindEl.value); render();
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser);
    else initBrowser();
  }

  var api = { KINDS: KINDS, SAMPLES: SAMPLES, buildPrompt: buildPrompt, splitSteps: splitSteps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PromptStudio = api;
})(typeof window !== 'undefined' ? window : this);
