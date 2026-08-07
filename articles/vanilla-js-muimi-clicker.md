---
title: "モグラ叩きとカップ麺タイマーを合体させた無意味クリッカーの実装"
emoji: "🐾"
type: "tech"
topics: ["javascript", "html", "css", "ゲーム制作"]
published: false
---

カップ麺の完成を待つ3分間は、短いようで長いです。

そこで、待っている間だけ無心で叩けるモグラ叩きと、3分・5分のカップ麺タイマーを同じページに置きました。名前は**無意味クリッカー**です。

https://asobi-clicker.vercel.app

この記事では、Vanilla JavaScriptで次の仕組みを実装した方法を紹介します。

- `setTimeout` を使ったランダムな出現ループ
- 時間とともに速くなる難易度
- 操作感を悪くしない220msの判定猶予
- 実時間を基準にしたカウントダウン
- クリック座標へ残るCSS製の肉球スタンプ

## 画面に2つの時間を共存させる

このページでは、別々の時間が同時に進みます。

1. モグラが出現・退場する短い時間
2. カップ麺が完成するまでの長い時間

両方を1つの大きなループで管理すると、処理が読みにくくなります。そこで、モグラ側は `setTimeout`、カップ麺側は `setInterval` と役割を分けました。

## `setInterval` ではなく `setTimeout` で出現させる

モグラの出現間隔は毎回変えたいので、1回ごとに次の予定を作ります。

```js
function scheduleNextMole() {
  const delay = getSpawnDelayMs(getElapsedGameSeconds());
  moleSpawnTimeoutId = window.setTimeout(spawnMole, delay);
}

function spawnMole() {
  const hole = pickRandomHole(activeMoleHole);
  activeMoleHole = hole;
  hole.classList.add("is-up");

  const visibleDuration = getVisibleDurationMs(
    getElapsedGameSeconds()
  );

  moleHideTimeoutId = window.setTimeout(() => {
    hole.classList.remove("is-up");
    activeMoleHole = null;
    scheduleNextMole();
  }, visibleDuration);
}
```

`setInterval` で固定周期にすると、出現と退場の処理が重なりやすくなります。`setTimeout` をつないでいく方法なら、「今回が終わったら次を予約する」という順序を保てます。

## 時間経過で難しくする

プレイ開始からの経過秒数を使い、待ち時間と表示時間を少しずつ短くします。

```js
function getSpawnDelayMs(elapsedSeconds) {
  const base = Math.max(450, 1300 - elapsedSeconds * 3);
  return base * (0.7 + Math.random() * 0.6);
}

function getVisibleDurationMs(elapsedSeconds) {
  return Math.max(500, 1100 - elapsedSeconds * 2);
}
```

完全な等間隔では機械的に見えるので、出現待ちには70〜130%の揺らぎを入れました。

一方、速さには下限を設けています。難易度を上げ続けて押せない速さにしても、上達ではなく理不尽さが増えるだけだからです。

## 消えた直後のクリックを成功にする

見た目では間に合ったのに、内部処理では数ミリ秒遅れて失敗になることがあります。反射神経ゲームでは、このズレがかなり気になります。

そこで、モグラが消えてから220msだけ「猶予中の穴」として保持しています。

```js
const MOLE_HIT_GRACE_MS = 220;
let graceMoleHole = null;

graceMoleHole = hole;
window.clearTimeout(moleGraceTimeoutId);

moleGraceTimeoutId = window.setTimeout(() => {
  if (graceMoleHole === hole) graceMoleHole = null;
}, MOLE_HIT_GRACE_MS);
```

クリック時は、表示中の穴だけでなく猶予中の穴も判定します。

```js
if (hole === activeMoleHole) {
  registerHit();
  scheduleNextMole();
  return;
}

if (hole === graceMoleHole) {
  graceMoleHole = null;
  registerHit();
}
```

判定を厳密にするより、利用者が「押せた」と感じた操作を成功にするほうが、このゲームには合っていました。

## カップ麺タイマーは経過時間から逆算する

カウントダウン表示は250msごとに更新します。ただし、表示のたびに残り秒数を1ずつ減らしてはいません。

```js
function tickCupTimer() {
  const elapsedSeconds = (Date.now() - cupStartedAt) / 1000;
  const remainingSeconds = cupDurationSeconds - elapsedSeconds;

  if (remainingSeconds <= 0) {
    elements.countdownValue.textContent = "00:00";
    window.clearInterval(cupIntervalId);
    openCheckModal();
    return;
  }

  elements.countdownValue.textContent = formatCountdown(remainingSeconds);
}
```

ブラウザのタイマー処理は、タブが非表示になったときなどに遅れることがあります。回数を数える方式では、その遅れが積み重なります。

開始時刻と現在時刻の差から毎回計算すれば、更新が一時的に遅れても、次の描画で正しい残り時間へ戻せます。

## 完成後に「いやまだ」を選べるようにする

3分経っても、麺が好みの硬さとは限りません。タイマー終了時には確認画面を出し、次の2つを選べるようにしました。

- 「できた」: 結果を確定する
- 「いやまだ」: カウントアップへ切り替える

「いやまだ」以降は、残り時間ではなく実際に待った時間を表示します。同じ `cupStartedAt` を基準にしているため、カウントダウンからカウントアップへの切り替えでも時間が途切れません。

## クリック地点へ肉球の跡を残す

猫の画像を画面に置くのではなく、操作の結果にだけ猫らしさを残したいと考えました。

そこで、クリックイベントの座標を盤面内の座標へ変換し、その場所へ肉球を追加しています。

```js
function addPawPrint(event, hole) {
  const fieldRect = elements.moleField.getBoundingClientRect();
  const holeRect = hole.getBoundingClientRect();
  const hasPointerPosition = event.detail > 0;

  const x = hasPointerPosition
    ? event.clientX - fieldRect.left
    : holeRect.left + holeRect.width / 2 - fieldRect.left;

  const y = hasPointerPosition
    ? event.clientY - fieldRect.top
    : holeRect.top + holeRect.height / 2 - fieldRect.top;

  const pawPrint = document.createElement("span");
  pawPrint.className = "paw-print";
  pawPrint.style.left = `${x}px`;
  pawPrint.style.top = `${y}px`;
  elements.moleField.append(pawPrint);
}
```

キーボードでボタンを押した場合はポインター座標がないため、穴の中央を使います。

肉球自体は画像ではなく、疑似要素と `box-shadow` で作りました。

```css
.paw-print::before {
  width: 21px;
  height: 18px;
  border-radius: 52% 52% 45% 45%;
  background: currentColor;
}

.paw-print::after {
  width: 7px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  box-shadow:
    9px -8px 0 currentColor,
    19px -8px 0 currentColor,
    28px 0 0 currentColor;
}
```

跡は消さずに残しますが、DOMが増え続けないよう新しい24個だけを保持しています。リセットボタンを押すと、スコアと一緒に跡も消えます。

## 状態をリセットするときはタイマーも止める

スコアだけを0にしても、古い `setTimeout` が残っていると、前のモグラが突然消えたり、次の出現が二重になったりします。

そのためリセット時は、関連するタイマーをすべて止めてからループを再開します。

```js
function restartMoleLoop() {
  window.clearTimeout(moleSpawnTimeoutId);
  window.clearTimeout(moleHideTimeoutId);
  window.clearTimeout(moleGraceTimeoutId);

  if (activeMoleHole) {
    activeMoleHole.classList.remove("is-up");
    activeMoleHole = null;
  }

  graceMoleHole = null;
  scheduleNextMole();
}
```

タイマーを使うUIでは、開始処理よりも終了・再開処理を先に設計したほうが不具合を減らせます。

## まとめ

このゲームで特に効果があったのは、次の3点でした。

- 固定周期ではなく、終了後に次を予約する
- 見た目と判定のズレを短い猶予で吸収する
- タイマーの回数ではなく、実時間から表示を計算する

機能としてはモグラ叩きとタイマーを並べただけですが、「カップ麺を待つ」という状況を決めたことで、2つを同じ画面に置く理由ができました。

ソースコードはこちらです。

https://github.com/chisato410/asobi/tree/main/clicker
