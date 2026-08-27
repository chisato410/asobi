<!--
Qiitaタイトル: ピンポンダッシュを『押すだけ』で終わらせず、7種類の結果画像まで作った
推奨タグ: JavaScript / HTML / CSS / Canvas / WebAPI
-->

動くゲージが緑のゾーンに入った瞬間にボタンを押す。
成功すれば次は少し速く、少し狭くなる。1回でも外したら、その場で御用です。

そんな単純なルールのブラウザゲーム、**ピンポンダッシュ**を作りました。

https://asobi-pinpondash.vercel.app/

![ピンポンダッシュの紹介画像。三毛猫が玄関のピンポンを押し、タイミングゲージが表示されている](https://asobi-pinpondash.vercel.app/og-image.png)

実際のピンポンダッシュは迷惑なので絶対にできませんが、ブラウザ上なら誰にも怒られません。

最初は本当に「ゲージを見てボタンを押すだけ」の小さなゲームでした。そこから、成功回数に応じた難易度調整、称号、自己ベスト、効果音、猫のアニメーションを追加し、最後には**結果を7種類のランダム画像にして共有できるところ**まで作りました。

この記事では、HTML・CSS・Vanilla JavaScriptだけで作ったタイミングゲームと、実装中に考えることの多かった「結果画像の生成・共有」について紹介します。

## 今回作ったもの

現在のピンポンダッシュには、次の機能があります。

- ゲージのマーカーが左右へ往復する
- 緑のセーフゾーン内で押すと成功する
- 成功するほどゲージが速くなり、ゾーンが狭くなる
- 5往復以内に押さなければ時間切れになる
- 連続成功数に応じて称号が変わる
- 自己ベストをブラウザへ保存する
- 成功・失敗で音と猫の動きが変わる
- 7種類のイラストからランダムな結果画像を生成する
- Xへの直接投稿と、画像付き共有を選べる
- リンクだけを共有した場合も、大きなOGP画像が表示される

フレームワークもバックエンドも使っていません。構成はHTML、CSS、JavaScript、`requestAnimationFrame`、Canvas API、Web Share API、`localStorage`です。

## ゲームを3つの状態に分ける

画面は、開始前・プレイ中・失敗後の3状態に分けました。

```js
let gameState = "idle";
```

状態遷移は次のようになります。

```text
idle ──開始──> running ──失敗・時間切れ──> gameover
                    │                         │
                    └──成功──> 次のラウンド   └──再挑戦──> running
```

小さなゲームでも、画面の`hidden`属性だけを個別に切り替えていると、「ゲーム終了後なのに判定が走る」といった矛盾が起きやすくなります。

ボタンを押したときは、最初に状態を確認します。

```js
function attemptPress() {
  if (gameState !== "running") return;

  // このあと判定処理
}
```

状態名を先に決めておくことで、クリック、キーボード入力、描画ループのどこから呼ばれても、同じ条件で処理を止められます。

## `requestAnimationFrame`は描画のきっかけに使う

マーカーの更新には`requestAnimationFrame`を使っています。

```js
function renderLoop() {
  if (gameState !== "running") return;

  const now = Date.now();
  const percent = getMarkerPercent(now);
  elements.marker.style.left = `${percent}%`;

  animationFrameId = window.requestAnimationFrame(renderLoop);
}
```

ただし、1フレームごとに座標を足しているわけではありません。現在時刻とラウンド開始時刻の差から、その瞬間の位置を毎回計算しています。

描画が一瞬止まっても、次のフレームで正しい場所へ戻れるためです。

## 三角波で0%→100%→0%の往復を作る

1往復の時間を`periodMs`として、経過割合を0〜1へ正規化します。

```js
function getMarkerPercent(now) {
  const elapsed = now - phaseStartedAt;
  const t = (elapsed % periodMs) / periodMs;
  const progress = t < 0.5 ? t * 2 : 2 - t * 2;
  return progress * 100;
}
```

前半は`0 → 1`、後半は`1 → 0`へ変換しています。

```text
t:        0 ───── 0.5 ───── 1
progress: 0 ─────  1  ───── 0
```

CSSアニメーションだけでも往復は作れます。しかし、表示と当たり判定を別々の仕組みにすると、見えている位置とJavaScript側の値がずれる可能性があります。

今回は、描画にも判定にも同じ`getMarkerPercent()`を使いました。

## DOMの位置を読むのではなく、同じ式で判定する

ピンポンを押した瞬間にも、現在時刻から位置を計算します。

```js
const percent = getMarkerPercent(Date.now());
const zoneEnd = currentZone.start + currentZone.width;
const isHit = percent >= currentZone.start && percent <= zoneEnd;

if (isHit) {
  handleSuccess();
} else {
  handleCaught();
}
```

画面上の`left`を読み取る方法もありますが、直前の描画値だったり、レイアウト計算が発生したりします。

見た目と判定を同じ時刻・同じ関数から求めることで、「緑に入って見えたのに失敗した」という違和感を減らしました。

## 成功するほど速く・狭くする

難易度は、1往復の時間とセーフゾーンの幅で調整しています。

```js
function getPeriodMs(streak) {
  return Math.max(500, 1700 - streak * 70);
}

function getZoneWidthPercent(streak) {
  return Math.max(6, 24 - streak * 1.1);
}
```

初回は1往復1.7秒、ゾーン幅24%。成功するたびに70ms速くなり、ゾーンが1.1ポイント狭くなります。

両方に下限を設けているのは、最後に端末性能や入力遅延との勝負になるのを避けるためです。難しくし続けるのではなく、ゲームとして遊べる範囲に止めました。

セーフゾーンの開始位置は、右端がゲージ外へはみ出さない範囲から選びます。

```js
function randomizeZone(width) {
  const maxStart = 100 - width;
  const start = Math.random() * maxStart;
  return { start, width };
}
```

## 5往復で時間切れにする

押さずに眺め続けられると、タイミングゲームとして緊張感がなくなります。そこで、各ラウンドは5往復で終了するようにしました。

```js
const elapsed = now - phaseStartedAt;
const completedRoundTrips = Math.floor(elapsed / periodMs);
const remaining = Math.max(0, 5 - completedRoundTrips);

if (remaining === 0) {
  handleCaught("timeout");
  return;
}
```

残り回数が少なくなると表示色も変えています。単に制限時間を足すのではなく、プレイヤーが焦り始めるきっかけとして画面にも反映しました。

## 結果画像をCanvasでその場で作る

ゲーム結果を共有するとき、最初は文章とURLだけを渡していました。しかし、見せたいのは「何回成功したか」と、そのとき出た猫のイラストです。

そこで、共有ボタンを押した時点でCanvasへ結果カードを描画しています。画像サイズはOGPにも使いやすい`1200 × 630`です。

```js
const canvas = document.createElement("canvas");
canvas.width = 1200;
canvas.height = 630;

const context = canvas.getContext("2d");
context.fillStyle = "#c9dcde";
context.fillRect(0, 0, canvas.width, canvas.height);
```

Canvas上には次の情報を描いています。

- 今回の連続成功回数
- 自己ベスト
- 現在の称号
- 7種類からランダムに選んだイラスト

```js
context.fillText(`${currentStreak}回`, 130, 320);
context.fillText(currentTitle(currentStreak).label, 135, 438);
context.fillText(`自己ベスト ${bestStreak}回`, 135, 510);
context.drawImage(illustration, 650, 92, 430, 430);
```

毎回同じ画像では結果を見る楽しみが減るため、直前に使ったものを候補から外し、できるだけ連続で同じ絵が出ないようにしました。

## 共有イラストは先に読み込んでおく

Canvasの`drawImage()`は、画像の読み込みが終わる前には描画できません。

共有ボタンを押した瞬間に7枚の読み込みを始めると待ち時間が発生するため、ページ表示時に`Image`オブジェクトを作って先読みしています。

```js
shareIllustrationElements = SHARE_ILLUSTRATIONS.map((source) => {
  const image = new Image();
  image.src = source;
  return image;
});
```

少なくとも1枚が使える状態になるまでは、画像付き共有ボタンを無効にしています。非同期処理の途中で押されても失敗しないよう、UI側にも準備状態を持たせました。

## Xへの直接投稿と画像付き共有を分ける

今回いちばん分かりにくかったのが、Xへの共有方法でした。

XのWeb Intentを使えば、本文とURLが入った投稿画面を直接開けます。

```js
const params = new URLSearchParams({
  text,
  url: "https://asobi-pinpondash.vercel.app/",
});

window.location.assign(`https://twitter.com/intent/tweet?${params.toString()}`);
```

一方で、ブラウザ内で作った画像ファイルをWeb IntentのURLへ自動添付することはできません。

そこで、結果画面には2つのボタンを置きました。

1. **Xに投稿する**：結果文とリンクを入れたXの投稿画面を直接開く
2. **ランダム結果画像付きで共有**：端末の共有画面を開き、画像ファイルも渡す

スマホの画像付き共有にはWeb Share APIを使います。

```js
const shareData = {
  title: "ピンポンダッシュ",
  text,
  files: [cardFile],
};

if (navigator.share && navigator.canShare?.(shareData)) {
  await navigator.share(shareData);
}
```

共有先でXを選べば、結果画像付きの投稿を作れます。ただし、Webページ側から共有先をXだけに固定することはできません。そのため、ボタンの下に「共有先でXを選んでください」と表示しています。

ファイル共有に対応していない端末では、結果画像をダウンロードします。

```js
const downloadUrl = URL.createObjectURL(cardFile);
const link = document.createElement("a");
link.href = downloadUrl;
link.download = cardFile.name;
link.click();
URL.revokeObjectURL(downloadUrl);
```

「Xを確実に開く操作」と「画像を確実に渡す操作」を1つに詰め込まず、目的ごとに分けたことで挙動が分かりやすくなりました。

## リンクだけの投稿にはOGP画像を出す

画像付き共有を選ばなくても、投稿したリンクが文字だけにならないようにOGPも設定しました。

```html
<meta name="twitter:card" content="summary_large_image" />
<meta
  property="og:image"
  content="https://asobi-pinpondash.vercel.app/og-image.png"
/>
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

OGP画像には、ゲーム本編と同じ三毛猫、玄関、タイミングゲージを配置しました。

結果画像はプレイヤーごとに変わるもの、OGP画像はゲーム自体を紹介する固定のもの、と役割を分けています。

## 自己ベストは`localStorage`へ保存する

保存するデータは最高連続回数の数値1つだけです。

```js
const isNewBest = currentStreak > bestStreak;

if (isNewBest) {
  bestStreak = currentStreak;
  localStorage.setItem(STORAGE_KEY, String(bestStreak));
}
```

ログインやデータベースを用意せず、リロード後も同じ端末なら記録を残せます。端末間では同期されませんが、すぐ遊べる軽さを優先しました。

## 小さなゲームでも、遊んだ後まで設計する

タイミングゲームの中心は、見た目のマーカーではなく「時刻から位置を求める関数」でした。

そこへ、音、猫の動き、称号、自己ベストを足すと、成功した瞬間の手応えが生まれます。さらに、結果画像とOGPを用意すると、ゲームを閉じた後にも記録を持ち出せます。

今回使ったのは、`requestAnimationFrame`、Canvas API、Web Share API、`localStorage`といったブラウザ標準機能です。大がかりな構成ではありません。

それでも、表示と判定の同期、画像の先読み、スマホとPCの共有方法、XのWeb Intentでは画像を添付できない制約など、実際に最後まで触って初めて見える問題がありました。

「押せる」だけではなく、**遊び始めてから結果を共有するまで、迷わずつながっているか**を考えたゲームになりました。

---

🐱 でぶねこ｜猫好きエンジニア
週2ペースでゆるくネタ系Webアプリを作ってます。
良ければXもフォローしてください🐾
▶ X: https://x.com/dev_cat222
