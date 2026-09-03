<!--
Qiitaタイトル: 「shi」でも「si」でも正解にする。Vanilla JSでタイピングゲームの入力判定を作る
推奨タグ: JavaScript / HTML / CSS / Canvas / ゲーム制作
-->

猫種と毛柄は、どちらも猫の話ですが別のものです。「メインクーン」は猫種で、「キジトラ」は毛柄です。

その2つに、猫のからだとしぐさの言葉を加えて、猫に関する言葉だけが出てくるタイピングゲームを作りました。名前は**ねこタイプ**、全120語で、30秒・60秒・90秒から時間を選べます。

https://asobi-nekotyping.vercel.app

![ねこタイプの紹介画像。グレー、茶トラ、三毛の3匹の猫がキーボードに前足をのせている](https://asobi-nekotyping.vercel.app/og-image.png)

作りはじめてすぐに分かったのは、このゲームで一番面倒なのはゲーム部分ではなく**ローマ字の入力判定**だという点でした。「しゃむ」は `shamu` でも `syamu` でも正しく、「ニャー」の長音をどう打つかは人によって違います。

この記事では、Vanilla JavaScriptで次の仕組みを実装した方法を紹介します。

- 音が同じローマ字をすべて正解にする候補展開
- 長音「ー」の3通りの入力への対応
- 1打ごとに候補を絞り込むマッチング
- 単語が終わった直後の1打を捨てない420msの猶予
- 出題が偏らないデッキ方式
- 正解した言葉をWikipediaから補足する処理
- 文字を置く余白のあるアートから作る結果画像
- ページを離れる前に済ませる共有の案内

## 「正解のローマ字は1つ」という前提が崩れる

最初は、単語ごとに正解のローマ字を1つ持たせて、先頭から1文字ずつ比較していました。

「まんちかん」を `manchikan` と比べるだけなら、これで足ります。しかし「しゃむ」で行き詰まります。`shamu` と `syamu` はどちらも正しく、どちらを打つかは利用者の癖です。片方だけを正解にすると、もう片方を使う人はゲームが始まった瞬間にミスします。

そこで単語データには、正解を1つではなく**入力の候補**を持たせました。

```js
{
  label: "シャム",
  reading: "しゃむ",
  romaji: ["shamu", "syamu", "siamese"],
  kind: "猫種",
  wiki: "シャム (ネコ)",
  coat: "point",
  fallback: "濃いポイントカラーと青い目で知られる猫種です。",
}
```

とはいえ、120語すべてについて考えられる打ち方を手で並べるのは現実的ではありません。書き漏らした綴りが、そのままミス判定になってしまいます。

そこで、代表的な綴りだけをデータに書き、残りはコード側で機械的に増やすことにしました。

## 音が同じ組み合わせを置換で増やす

入力の揺れは、多くが決まった組み合わせです。`shi` と `si`、`chi` と `ti`、`ji` と `zi` などをグループにまとめました。

```js
const SOUND_GROUPS = [
  ["sha", "sya"],
  ["shu", "syu"],
  ["sho", "syo"],
  ["cha", "tya", "cya"],
  ["chu", "tyu", "cyu"],
  ["cho", "tyo", "cyo"],
  ["ja", "zya", "jya"],
  ["ju", "zyu", "jyu"],
  ["jo", "zyo", "jyo"],
  ["shi", "si"],
  ["chi", "ti"],
  ["tsu", "tu"],
  ["fu", "hu"],
  ["ji", "zi"],
];
```

各グループについて、候補の中に現れた表記を同じグループの別の表記へ置き換え、新しい候補が増えなくなるまで繰り返します。

```js
function expandGroup(variants, group) {
  const expanded = new Set(variants);
  let changed = true;

  while (changed) {
    changed = false;
    [...expanded].forEach((variant) => {
      group.forEach((source) => {
        let index = variant.indexOf(source);
        while (index !== -1) {
          group.forEach((replacement) => {
            const next =
              variant.slice(0, index) +
              replacement +
              variant.slice(index + source.length);
            if (!expanded.has(next)) {
              expanded.add(next);
              changed = true;
            }
          });
          index = variant.indexOf(source, index + 1);
        }
      });
    });
  }

  return expanded;
}
```

1回の置換で終わりにしていない理由は、同じ音が単語の中に複数回出てくることがあるためです。置換した結果に対してもう一度走らせないと、片方だけ置き換えた形しか作れません。`Set` に入れているので、同じ候補が何度生まれても重複しません。

## 長音「ー」は3通りを受け付ける

外来語の猫種名には「フォールド」「クーン」「ブルー」のように長音が入ります。この「ー」の打ち方は、少なくとも3通りあります。

- 打たずに飛ばす: `forudo`
- ハイフンを打つ: `fo-rudo`
- 母音を重ねる: `foorudo`

データにはハイフン形を書き、そこから残り2つを作ります。

```js
function expandLongVowels(variants) {
  const expanded = new Set(variants);
  let changed = true;

  while (changed) {
    changed = false;
    [...expanded].forEach((variant) => {
      const index = variant.indexOf("-");
      if (index === -1) return;
      const vowel = variant[index - 1];
      const replacements = /[aeiou]/.test(vowel) ? ["", vowel] : [""];
      replacements.forEach((replacement) => {
        const next =
          variant.slice(0, index) + replacement + variant.slice(index + 1);
        if (!expanded.has(next)) {
          expanded.add(next);
          changed = true;
        }
      });
    });
  }

  return expanded;
}
```

直前が母音のときだけ「母音を重ねる」形を作ります。長音の前は母音であるのが普通ですが、そうでない綴りを渡されたときに母音でない文字を重ねてしまわないよう、条件を分けてあります。

最後に、長音の展開と音のグループ展開をつなげます。

```js
function expandRomajiVariants(baseVariants) {
  let variants = new Set(baseVariants.map((value) => value.toLowerCase()));
  variants = expandLongVowels(variants);
  SOUND_GROUPS.forEach((group) => {
    variants = expandGroup(variants, group);
  });
  return [...variants];
}
```

「スコティッシュフォールド」は、データに4つ書いてあるだけですが、この処理を通すと20通りの入力が正解になります。`sukotisshufo-rudo` も `sukotissyuforudo` も `sukochisshufoorudo` も通ります。

なお、この展開は英語表記にも及ぶため、`siamese` から `shiamese` のような実際には使われない候補も生まれます。誤って正解になる語が増えるわけではないので、そのまま許容しています。

## 1打ごとに候補を絞り込む

判定は、確定した1つの正解と比べるのではなく、**候補の集合を打つたびに狭めていく**方式にしました。

```js
function matchRomaji(candidates, typed, key) {
  const nextTyped = typed + key.toLowerCase();
  const remaining = candidates.filter((candidate) =>
    candidate.startsWith(nextTyped)
  );

  if (!remaining.length) {
    return { accepted: false, typed, candidates, complete: false, graceKeys: [] };
  }

  const complete = remaining.includes(nextTyped);
  const graceKeys = complete
    ? [...new Set(
        remaining
          .filter((candidate) => candidate.length > nextTyped.length)
          .map((candidate) => candidate[nextTyped.length])
      )]
    : [];

  return { accepted: true, typed: nextTyped, candidates: remaining, complete, graceKeys };
}
```

押されたキーを加えた文字列で始まる候補が1つでも残れば正解、0件になったらミスです。候補が残らなかった場合は `typed` も `candidates` も更新せず、打つ前の状態をそのまま返します。ミスした1打で入力が壊れないようにするためです。

「シャム」を `syamu` と打った場合、候補はこう動きます。

```
key=s  typed=s      候補=4  shamu | syamu | siamese | shiamese
key=y  typed=sy     候補=1  syamu
key=a  typed=sya    候補=1  syamu
key=m  typed=syam   候補=1  syamu
key=u  typed=syamu  候補=1  syamu  → complete
```

`s` の時点ではまだ4通りが生きていて、`y` を押した瞬間に1通りへ決まります。どの綴りを選んだかを事前に宣言する必要はありません。

## 表示するローマ字は、消えたときだけ差し替える

画面には打つべきローマ字を出しています。ただ、候補が絞られるたびに表示を更新すると、文字列が目の前で入れ替わって読みづらくなります。

そこで、初期表示はデータの先頭を使い、**それが候補から消えたときだけ**別の候補へ差し替えます。

```js
if (!state.candidates.includes(state.target)) {
  state.target = NekoTyping.chooseDisplayTarget(state.candidates, state.target);
}
```

差し替え先は、長音をハイフンで表した形を優先し、その中で短いものを選びます。

```js
function chooseDisplayTarget(candidates, fallback = "") {
  if (!candidates.length) return fallback;
  return candidates.reduce((preferred, candidate) => {
    const preferredDashes = (preferred.match(/-/g) || []).length;
    const candidateDashes = (candidate.match(/-/g) || []).length;
    if (candidateDashes > preferredDashes) return candidate;
    if (candidateDashes < preferredDashes) return preferred;
    return candidate.length < preferred.length ? candidate : preferred;
  });
}
```

ハイフンを優先するのは、`nyaa` より `nya-` のほうが「ニャー」という読みと対応が付きやすいからです。

`shamu` を表示していた人が `sy` と打った時点で、表示は `syamu` へ切り替わります。自分が選んだ綴りに画面が追いついてくる形になり、残りを最後まで読み続けられます。

## 単語が終わった直後の1打を捨てない

候補方式には副作用があります。短い候補で単語が確定したのに、利用者は長い候補を打ち続けている場合です。

「肉球」の候補は `nikukyu` と `nikukyuu` です。`nikukyu` まで打った時点で単語は完成しますが、`nikukyuu` の癖がある人は最後の `u` をもう1打押します。その1打は次の単語の1文字目として扱われ、たいていミスになります。

打った本人からすると、正しく打ち切ったのに理由のないミスが記録されます。

そこで、単語が完成した時点で「このあと来ても許すキー」を求めておきます。これが `matchRomaji` が返す `graceKeys` です。残っている候補のうち、確定した長さより長いものの次の1文字を集めています。

```
「ニャー」を nya まで打った時点
  → complete = true
  → graceKeys = ["-", "a"]   （nya- と nyaa の続き）
```

完成処理では、このキーと有効期限を状態へ持たせます。

```js
state.graceKeys = new Set(graceKeys);
state.graceUntil = performance.now() + 420;
```

キー入力の先頭で、猶予中かどうかを先に判定します。

```js
if (performance.now() < state.graceUntil && state.graceKeys.has(key)) {
  state.totalKeys += 1;
  state.correctKeys += 1;
  state.graceKeys.delete(key);
  playTone(true);
  return;
}
```

ここで `return` しているので、その1打は次の単語の判定には回りません。総打鍵数と正解打鍵数の両方に加えているため、正確さの数字も下がりません。使ったキーは `delete` するので、同じキーを連打して猶予を稼ぐことはできません。

420msという長さは、次の単語を認識して打ちはじめるより短く、指が勢いで1打進むよりは長い、という基準で決めました。

## 出題はデッキから引く

120語を毎回ランダムに選ぶと、同じ単語が短い間に何度も出ます。30秒モードでは十数語しか出題されないので、重複はかなり目立ちます。

そこで、全語をシャッフルした山札を作り、`pop` で引いていく方式にしました。

```js
function shuffledWords() {
  const deck = [...WORDS];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  const nextIndex = deck.length - 1;
  if (deck[nextIndex] === state.lastWord && nextIndex > 0) {
    const swapIndex = Math.floor(Math.random() * nextIndex);
    [deck[nextIndex], deck[swapIndex]] = [deck[swapIndex], deck[nextIndex]];
  }
  return deck;
}

function pickWord() {
  if (!state.wordDeck.length) state.wordDeck = shuffledWords();
  return state.wordDeck.pop();
}
```

シャッフル直後に1か所だけ入れ替えているのは、山札を切り直した瞬間の連続を防ぐためです。前回引いた単語が新しい山札の一番上に来ていた場合だけ、別の位置と交換します。

デッキを使い切るまで同じ単語は出ないので、「さっきも見た」という感覚がなくなります。

## ミスの音は3回続いてから鳴らす

1打ごとに音を鳴らすと、ミスの音がうるさくなります。タイピングでは、指がずれて数打続けて外れることが普通にあるためです。

そこで、ミスの効果音は連続3回で鳴らすようにしました。

```js
state.combo = 0;
state.missStreak += 1;
if (state.missStreak >= 3) {
  playEffect("mistake");
  state.missStreak = 0;
}
```

代わりに、外れた1打では単語カードを短く横に振っています。

```css
.type-machine.is-error .word-card { animation: wrong 160ms ease; }

@keyframes wrong {
  35% { transform: translateX(-7px) rotate(-.1deg); }
  70% { transform: translateX(7px) rotate(-.1deg); }
}
```

音は連続したときだけ、見た目は毎回。この分け方にしてから、ミスが分かりにくいという感じも、音が邪魔だという感じもなくなりました。

なお、同じアニメーションを連続で再生するには、クラスを外したあとに一度レイアウトを読み直す必要があります。

```js
elements.machine.classList.remove("is-error");
void elements.machine.offsetWidth;
elements.machine.classList.add("is-error");
```

`void element.offsetWidth` を挟まないと、外して付け直す操作がまとめて処理され、アニメーションが再生されません。肉球のスタンプや正解時の猫のジャンプでも同じ書き方を使っています。

## 毛柄はCSSのグラデーションで描く

出題中の単語カードには、その言葉に対応する毛柄を置いています。三毛、トラ、黒、白、ポイントの5種類です。

画像を5枚用意してもよかったのですが、毛柄は模様の規則そのものなので、CSSで表現できました。

```css
.coat-swatch.calico {
  background: conic-gradient(
    var(--orange) 0 28%, var(--ink) 28% 43%,
    #eed9b8 43% 72%, var(--orange) 72%
  );
}
.coat-swatch.tabby {
  background: repeating-linear-gradient(115deg, #5f5c57 0 10px, #b7ad98 10px 23px);
}
.coat-swatch.point {
  background: radial-gradient(circle at 70% 25%, #4f4036 0 18%, #d7b985 19%);
}
```

三毛は色の面が分かれるので `conic-gradient`、トラはしま模様なので `repeating-linear-gradient`、ポイントは顔まわりだけ色が濃いので `radial-gradient` です。

単語データが持つ `coat` の値をクラス名に渡すだけで切り替わります。

```js
elements.swatch.className = `coat-swatch ${word.coat || ""}`;
```

## 正解した言葉をWikipediaから補足する

猫種名を打っていると、「ティックドタビーってどんな模様なのか」が気になります。ゲームが終わるまで分からないのは惜しいので、正解した言葉の説明をその場で表示するようにしました。

説明は日本語版WikipediaのMediaWiki Action APIから取りに行きます。`origin=*` を付けた未認証のCORSリクエストで、APIキーは不要です。

```js
const params = new URLSearchParams({
  action: "query",
  prop: "extracts",
  exintro: "1",
  explaintext: "1",
  exsentences: "2",
  redirects: "1",
  titles: word.wiki.split("#")[0],
  format: "json",
  origin: "*",
});

const response = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`);
```

`exintro` と `explaintext` で導入部のプレーンテキストだけを受け取り、`exsentences: 2` で2文に絞っています。ゲーム中に読むものなので、長い本文は要りません。

ただし、外部APIに頼るとゲーム自体が通信に左右されます。そこで単語データに `fallback` として短い説明を持たせ、取得できないときはそちらを使います。

```js
try {
  // ...fetch して extract を取り出す
  wikiCache.set(word.wiki, text);
  copy.textContent = text;
} catch {
  wikiCache.set(word.wiki, word.fallback);
  copy.textContent = word.fallback;
} finally {
  entry.classList.remove("is-loading");
}
```

取得結果は `Map` にキャッシュします。同じ単語を何度も正解したときに、毎回リクエストを送らないためです。

`fallback` を用意したことで、オフラインでもゲームは完全に遊べます。外部APIは「あると嬉しい情報」に留めて、遊べるかどうかには関わらせないという切り分けです。

## 結果画像は「文字を置く余白のあるアート」を別に用意する

結果はCanvasで `1200 × 630` の画像にしています。ここで用意した画像は2枚です。

1. `og-image.png`: URLを共有したときに表示される固定OGP
2. `og-art.png`: 結果画像の背景に使う、左側が空いているアート

同じイラストですが、固定OGPには「ねこの名前を、すばやくタイプ。」というコピーが入っていて、結果画像用のほうは左側が背景のまま空いています。

固定OGPを背景に流用すると、コピーの上にスコアを重ねることになります。そこで、文字を置く場所を最初から空けたアートを別に書き出しました。

```js
context.drawImage(shareArt, 0, 0, canvas.width, canvas.height);
drawRoundedRect(context, 58, 54, 490, 522, 34);
context.fillStyle = "rgba(255, 248, 234, .92)";
context.fill();
context.strokeStyle = "rgba(48, 40, 31, .72)";
context.lineWidth = 3;
context.stroke();

context.fillStyle = "#e88724";
context.font = '800 76px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
context.fillText(`${state.paws}こ`, 98, 283);
```

アートを全面に敷き、空けておいた左側へ半透明の紙を1枚置き、その上に肉球の数・スコア・正確さ・最高コンボを書きます。半透明にしているのは、背景の紙の質感を残したまま文字を読ませるためです。

なお、`canvas.toBlob` はコールバック方式で、環境によっては返ってこないことがあります。共有ボタンを押したまま何も起きない状態を避けるため、3秒で打ち切って `null` を返し、そのときは固定OGPを保存する経路へ落としています。共有そのものは必ず成立させる、という方針です。

画像を作ったあとは、スマホならWeb Share API、PCならClipboard API、どちらも使えない環境なら保存、と経路を分けます。この部分は同じasobi内の他のゲームと共通の作りなので詳細は省きます。

ただし、PCの経路には作ったあとで気づいた穴がありました。

## 「コピーしました」は読まれない

クリップボードへコピーしたあと、`window.location.assign` でXの投稿画面へ移動しています。ここで結果を伝えているつもりでした。

```js
const copied = await copyImageToClipboard(file);
if (copied) {
  setShareStatus(`画像をコピーしました。Xの投稿欄で${pasteShortcutLabel()}を押して貼り付けてください。`);
} else {
  downloadShareImage(file);
  setShareStatus("画像を保存しました。Xの投稿に添付してください。");
}
window.setTimeout(openXShare, 650);
```

しかし、この文章が画面に出ているのは650msだけです。そのあとタブはXへ切り替わり、こちらのページは消えます。しかもXの投稿欄は、クリップボードに画像が入っていても勝手には貼り付けてくれません。

つまり利用者は、貼り付けが必要だと知らないまま、空の投稿欄の前に立たされます。コピーが成功したことすら見えていません。

移動したあとで伝える手段はないので、**押す前に伝える**しかありません。共有ボタンが押せるようになった時点で、これから何が起きるかを書いておくことにしました。

```js
setShareStatus(supportsFileShareEnvironment()
  ? "共有先でXを選ぶだけです。"
  : `画像をコピーしてXの投稿画面を開きます。Xでは自動で貼られないので、投稿欄で${pasteShortcutLabel()}を押してください。`);
```

Web Share APIが使える端末では共有シートが開くだけなので、貼り付けの話は出しません。この判定は画像ができる前に呼ぶ必要があるので、端末とAPIの有無だけを見る部分を切り出しました。

```js
function supportsFileShareEnvironment() {
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return isMobileDevice && Boolean(navigator.share) && Boolean(navigator.canShare);
}
```

`navigator.canShare({ files: [file] })` はファイルを渡さないと判定できません。そこで環境だけを見る関数をこちらに置き、実際の共有時にファイル付きの判定を足す形にしています。

押すキーの表記も環境で変えます。

```js
function pasteShortcutLabel() {
  return /Macintosh|Mac OS X/i.test(navigator.userAgent) ? "⌘V" : "Ctrl+V";
}
```

「貼り付けてください」だけでは、何を押すのかを利用者に翻訳させることになります。`⌘V` と `Ctrl+V` のどちらかを名指しするほうが、読んでそのまま指が動きます。

別サイトの投稿欄へこちらのJavaScriptから貼り付けることはできません。できないのであれば、残った1操作を渡すところまでは丁寧に書く、という切り分けです。

## まとめ

ねこタイプで効果があったのは、次の6点でした。

- 正解を1つに決めず、候補の集合を絞り込む方式にする
- 候補は手で並べず、音のグループと長音の規則から機械的に増やす
- 表示は候補から消えたときだけ差し替えて、読み続けられるようにする
- 単語をまたぐ余分な1打を420msの猶予で吸収する
- 外部APIはフォールバックを用意して、遊べるかどうかには関わらせない
- ページを離れる操作の案内は、押したあとではなく押す前に出す

特に効いたのは「正解を1つに決めない」ことでした。ローマ字入力は打つ人の癖が出るところなので、そこを合わせに行くより、どの癖でも通る形にしたほうが素直に作れました。

ソースコードはこちらです。

https://github.com/chisato410/asobi/tree/main/nekotyping
