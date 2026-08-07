---
title: "requestAnimationFrameでピンポンダッシュ風タイミングゲームを作る"
emoji: "🏃"
type: "tech"
topics: ["javascript", "html", "css", "ゲーム制作"]
published: false
---

動くマーカーがセーフゾーンへ入った瞬間にボタンを押す。成功するたびに速くなり、1回外したら終了する。

そんな単純なルールで、**ピンポンダッシュ**というタイミングゲームを作りました。

https://asobi-pinpondash.vercel.app

実際のピンポンダッシュは迷惑なので絶対にできませんが、ブラウザ上なら誰にも怒られません。

この記事では、フレームワークを使わずに次の要素を実装した方法を紹介します。

- `requestAnimationFrame` による滑らかなゲージ
- 0%→100%→0%と往復する三角波
- 連続成功に応じた難易度調整
- `idle`・`running`・`gameover` の状態管理
- クリックとキーボードの共通操作
- 自己ベストの保存

## ゲームを3つの状態に分ける

画面には開始前・プレイ中・失敗後の3状態があります。

```js
let gameState = "idle";
```

状態遷移は次のとおりです。

```text
idle ──開始──> running ──失敗──> gameover
                    │                │
                    └──成功──┐       └──再挑戦──> running
                             └──次のラウンド
```

ボタンを押したときは、プレイ中でなければ何もしません。

```js
function attemptPress() {
  if (gameState !== "running") return;

  // このあと判定処理
}
```

小さなゲームでも、状態を決めずに `hidden` やクラスだけを個別に切り替えると、開始前なのに判定が走るなどの矛盾が起きます。先に状態名を決めておくと、各操作の条件を短く書けます。

## `requestAnimationFrame` でマーカーを動かす

ゲージの描画には `requestAnimationFrame` を使っています。

```js
function renderLoop() {
  if (gameState !== "running") return;

  const percent = getMarkerPercent(Date.now());
  elements.marker.style.left = `${percent}%`;

  animationFrameId = window.requestAnimationFrame(renderLoop);
}
```

`setInterval` と違い、ブラウザの描画タイミングに合わせて呼ばれるため、画面更新を滑らかにしやすい方法です。タブが非表示のときに無駄な描画が減る利点もあります。

ただし、1フレームごとに座標を足してはいません。現在時刻から位置を計算しています。

## 三角波で左右の往復を作る

マーカーは0%から100%へ進み、その後0%へ戻ります。

まず、1往復の経過割合を0〜1へ正規化します。

```js
const elapsed = now - phaseStartedAt;
const t = (elapsed % periodMs) / periodMs;
```

次に、前半は0→1、後半は1→0へ変換します。

```js
const progress = t < 0.5
  ? t * 2
  : 2 - t * 2;

return progress * 100;
```

結果は次のように動きます。

```text
t:        0 ───── 0.5 ───── 1
progress: 0 ─────  1  ───── 0
```

CSSアニメーションでも往復は作れますが、JavaScriptで同じ式を使って描画位置と当たり判定を計算すると、両者がずれません。

## DOMの見た目ではなく、同じ計算式で判定する

押した瞬間にも `getMarkerPercent()` を呼び、現在位置を求めます。

```js
function attemptPress() {
  if (gameState !== "running") return;

  const percent = getMarkerPercent(Date.now());
  const zoneEnd = currentZone.start + currentZone.width;
  const isHit =
    percent >= currentZone.start &&
    percent <= zoneEnd;

  if (isHit) {
    handleSuccess();
  } else {
    handleCaught();
  }
}
```

画面上の `left` を読み取って判定する方法もありますが、描画直前の値だったり、レイアウト計算が発生したりします。

表示と判定の両方を同じ時刻・同じ関数から求めることで、処理を単純にしました。

## セーフゾーンを毎回移動させる

セーフゾーンの幅はパーセントで管理し、収まる範囲から開始位置をランダムに選びます。

```js
function randomizeZone(width) {
  const maxStart = 100 - width;
  const start = Math.random() * maxStart;
  return { start, width };
}
```

`0〜100` から無条件に開始位置を選ぶと、ゾーンの右端がゲージ外へはみ出します。`100 - width` を上限にするのがポイントです。

DOMへ反映する値も同じパーセントを使います。

```js
function applyZoneToDom() {
  elements.safeZone.style.left = `${currentZone.start}%`;
  elements.safeZone.style.width = `${currentZone.width}%`;
}
```

これにより、画面幅が変わっても判定ロジックを変える必要がありません。

## 成功するたびに「速く・狭く」する

難易度は、1往復の時間とセーフゾーンの幅で調整しています。

```js
function getPeriodMs(streak) {
  return Math.max(500, 1700 - streak * 70);
}

function getZoneWidthPercent(streak) {
  return Math.max(6, 24 - streak * 1.1);
}
```

初回は1往復1.7秒、ゾーン幅24%。成功するたびに往復が70ms速くなり、ゾーンが1.1ポイント狭くなります。

どちらにも下限を設けました。際限なく難しくすると、最後は画面性能や入力遅延との勝負になります。上達できる余地を残しながら、ゲームとして成立する範囲に止めています。

## 成功後は位相をリセットする

成功したら新しいゾーンを決め、次の往復を0%から開始します。

```js
function startNewRound(streak) {
  periodMs = getPeriodMs(streak);
  currentZone = randomizeZone(getZoneWidthPercent(streak));
  applyZoneToDom();
  phaseStartedAt = Date.now();
}
```

前ラウンドの途中から突然速度だけ変えると、マーカーが飛んだように見えます。ラウンド単位で位相をリセットすると、ルールを理解しやすくなりました。

## クリックとキーボードを同じ関数へ集める

タイミングゲームは、押しやすさが結果に直結します。画面のボタンだけでなく、SpaceとEnterでも操作できるようにしました。

```js
elements.pingButton.addEventListener("click", attemptPress);

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "Enter") return;
  if (gameState !== "running") return;

  event.preventDefault();
  attemptPress();
});
```

判定処理を `attemptPress()` にまとめているため、入力方法が増えてもゲームルールは1か所だけです。

Spaceにはページスクロールという本来の動作があるので、プレイ中だけ `preventDefault()` しています。

## 自己ベストは数値1つだけ保存する

失敗時に今回の記録と自己ベストを比較します。

```js
const isNewBest = currentStreak > bestStreak;

if (isNewBest) {
  bestStreak = currentStreak;
  localStorage.setItem(STORAGE_KEY, String(bestStreak));
}
```

必要なデータは最高連続回数だけなので、複雑なJSONにはしていません。保存する目的に合わせて、最小の形式を選びました。

## 動きにキャラクターの役割を持たせる

画面には走る猫を置いています。ただ表示するだけではなく、状態に合わせて動きを変えました。

- プレイ中: 小刻みに走る
- 成功時: 一度跳ねる
- 失敗時: 動きを止めて傾く

ゲームの内部状態とキャラクターの動きが一致すると、説明文を読まなくても結果が分かります。装飾を増やすのではなく、既存の状態を伝える役割として使うのが効果的でした。

## まとめ

タイミングゲームの中心は、見た目のマーカーではなく「時刻から位置を求める関数」です。

- `requestAnimationFrame` は描画のきっかけに使う
- 位置は経過時間から計算する
- 描画と判定で同じ計算式を使う
- 難易度には必ず下限を設ける
- 入力方法が違っても判定関数は共通にする

この形にしておくと、ゲージの見た目やボタンの入力方法を変えても、ゲームの芯はそのまま保てます。

ソースコードはこちらです。

https://github.com/chisato410/asobi/tree/main/pinpondash
