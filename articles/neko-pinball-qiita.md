<!--
Qiitaタイトル: Canvasピンボールでボールが詰まる問題を解く：円・線分の衝突判定と導線設計
推奨タグ: JavaScript / Canvas / ゲーム制作 / HTML5 / 個人開発
-->

HTML、CSS、Vanilla JavaScriptだけで、猫仕様のピンボールを作りました。

https://asobi-pinball.vercel.app/

![日本の夜祭りに輝く、茶トラ猫のピンボール台](https://asobi-pinball.vercel.app/assets/og-neko-pinball.png)

Canvasでボールを動かし、円形バンパー、レール、フリッパー、回転する猫型スピナーなどと衝突させています。

実装自体は比較的早く進みましたが、時間がかかったのは「ボールの導線」でした。

- レールのつなぎ目で止まる
- 見た目には隙間があるのに、ボールが通れない
- 発射レーンへ戻って落ちる
- 障害物を減らすと、今度は簡単すぎる
- 必ず落ちる穴が、遊びではなくストレスになる

この記事では、ピンボールに限らず、Canvas上で円形オブジェクトを動かすときに再利用できる形で、詰まりの原因と解決方法をまとめます。

## ライブラリなしで、どこまでやるか

今回は1画面で完結する小さなゲームです。起動を軽くし、URLを開いたらすぐ遊べるものにしたかったため、物理エンジンは使わず、必要な衝突判定だけを実装しました。

扱う形状を大きく分けると、次の2種類です。

- ボールと円：バンパー、ポスト、猫の障害物
- ボールと線分：レール、フリッパー、スリングショット、猫風車

曲線も最終的に短い線分の集合にすることで、主要な衝突処理を2つに絞っています。

## 1. 円と円の衝突判定

ボールとバンパーの中心間距離が、半径の合計より短ければ衝突です。

```js
function circleCollision(obj, restitution = 1.2, boost = 0) {
  const dx = ball.x - obj.x;
  const dy = ball.y - obj.y;
  const minDist = ball.r + obj.r;
  const d2 = dx * dx + dy * dy;

  if (d2 >= minDist * minDist || d2 === 0) return false;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;

  // まず重なりを解消する
  ball.x = obj.x + nx * minDist;
  ball.y = obj.y + ny * minDist;

  // 面の法線方向の速度を反射する
  const rel = ball.vx * nx + ball.vy * ny;
  if (rel < 0) {
    ball.vx -= (1 + restitution) * rel * nx;
    ball.vy -= (1 + restitution) * rel * ny;
  }

  // バンパーなどは追加で押し出す
  if (boost) {
    ball.vx += nx * boost;
    ball.vy += ny * boost;
  }

  return true;
}
```

大事なのは、速度を反射する前に、ボールの位置を衝突面の外側へ戻すことです。

位置を戻さないと、次のフレームでもめり込んだ状態から衝突し、小刻みに振動したり、対象の中に吸い込まれたりします。

`restitution`は反発の強さ、`boost`はバンパー固有の弾きです。物理的な正しさより、遊んだときの手応えを調整しやすいよう分けています。

## 2. 円と線分の衝突判定

レールとフリッパーは、太さを持つ線分として扱います。

ボールの中心から線分上の最寄り点を求め、その距離で衝突を判定します。

```js
function segmentCollision(x1, y1, x2, y2, radius = 3, restitution = .82) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;

  let t = ((ball.x - x1) * dx + (ball.y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const ox = ball.x - px;
  const oy = ball.y - py;
  const minDist = ball.r + radius;
  const d2 = ox * ox + oy * oy;

  if (d2 >= minDist * minDist || d2 === 0) return false;

  const d = Math.sqrt(d2);
  const nx = ox / d;
  const ny = oy / d;

  ball.x = px + nx * minDist;
  ball.y = py + ny * minDist;

  const rel = ball.vx * nx + ball.vy * ny;
  if (rel < 0) {
    ball.vx -= (1 + restitution) * rel * nx;
    ball.vy -= (1 + restitution) * rel * ny;
  }

  return true;
}
```

`t`を`0〜1`に制限するのがポイントです。制限しないと、線分の延長線にも衝突してしまいます。

## 3. 1フレームを4回に分ける

速いボールは、1フレームの間に細いレールの手前から向こう側へ移動します。この場合、フレームごとの座標だけを見ると、衝突した瞬間を検出できません。

今回は物理更新を4つの小さなステップに分けました。

```js
const steps = 4;
const step = dt / steps;

for (let s = 0; s < steps; s++) {
  ball.vy += gravity * step;
  ball.x += ball.vx * step;
  ball.y += ball.vy * step;

  rails.forEach(rail => segmentCollision(...rail));
  bumpers.forEach(bumper => circleCollision(bumper));
}
```

連続衝突判定ほど厳密ではありませんが、小規模なゲームで「レールをすり抜ける」問題を減らすには有効でした。

## 4. 見た目の隙間と、ボールが通れる隙間は違う

一番分かりにくかったのが、棒と棒の隙間でボールが止まる問題です。

たとえば、ボールの半径が`10px`、両側の棒の衝突半径が`8px`と`3px`だとします。ボールの中心が通れるには、棒の中心線同士に少なくとも次の幅が必要です。

```text
2 * ボール半径 + 棒Aの半径 + 棒Bの半径
= 2 * 10 + 8 + 3
= 31px
```

画面上では隙間が見えても、中心線の間隔が`26px`しかなければボールは通れません。それでも速度があると少し入り込み、両側から押し戻されて止まることがあります。

ここでは中途半端に広げるのではなく、ピンクのスリングショットを黄色の外周レールまで延ばし、入口そのものを閉じました。

```js
const slingshots = [
  // ...
  {
    segments: [
      [492, 526, 398, 606],
      [398, 606, 361, 625]
    ]
  }
];
```

ゲームでは、すべての隙間を通路にする必要はありません。**通れるなら余裕を持って通れる、通さないなら完全に閉じる**という設計にすると、詰まりを避けやすくなります。

## 5. 曲線ガイドとフリッパーの「段差」をなくす

外周からフリッパーまでは、3次ベジェ曲線を使っています。

```js
const lowerGuides = [
  {
    start: [30, 646],
    control1: [30, 682],
    control2: [92, 712],
    end: [150, 712]
  },
  {
    start: [492, 646],
    control1: [492, 682],
    control2: [458, 712],
    end: [410, 712]
  }
];
```

曲線を18分割し、短い線分として衝突判定します。ただし、すべての線分を同じ太さにすると、半径`13px`のフリッパーとの接続部に段差ができます。

そこで、ガイドの衝突半径を`3px`から`13px`まで滑らかに太くしました。

```js
const radii = points.map((_, i) => {
  const t = i / (points.length - 1);
  const eased = t * t * (3 - 2 * t);
  return 3 + eased * 10;
});
```

描画側でも同じ`points`と`radii`を使い、左右の輪郭を作って埋めます。

```js
points.forEach((point, i) => {
  const before = points[Math.max(0, i - 1)];
  const after = points[Math.min(points.length - 1, i + 1)];
  const dx = after[0] - before[0];
  const dy = after[1] - before[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  left.push([
    point[0] + nx * radii[i],
    point[1] + ny * radii[i]
  ]);
  right.push([
    point[0] - nx * radii[i],
    point[1] - ny * radii[i]
  ]);
});
```

見た目と衝突判定が同じ形状データを使うため、「つながって見えるのに引っかかる」状態を防げます。

## 6. 発射レーンへ戻るボールを止める

ボールは右側の発射レーンから盤面へ入ります。しかし、口を開けたままにすると、プレイ中のボールが再び発射レーンへ落ち、下まで戻ってしまいます。

発射時は通し、盤面に出た後だけ口をゲートとして扱います。

```js
if (
  !ball.inShooterLane &&
  ball.vy > 0 &&
  ball.y < shooterGate.y1 + ball.r + 5 &&
  segmentCollision(
    shooterGate.x1,
    shooterGate.y1,
    shooterGate.x2,
    shooterGate.y2,
    4,
    .86
  )
) {
  ball.vx = -Math.max(260, Math.abs(ball.vx) * .82);
  ball.vy = -Math.max(280, Math.abs(ball.vy));
}
```

`ball.inShooterLane`は、発射用の通路にいるかを表すフラグです。通過した後だけ反射することで、一方通行のような挙動を作っています。

## 7. 必ず失敗する穴を、ランダムワープに変える

最初は盤面に落とし穴を追加しました。しかし、入った瞬間にボールを失うだけでは、難しいというより理不尽に感じました。

そこで、穴をランダムな位置へ飛ばすワープに変えました。

```js
const target = warpTargets[
  Math.floor(Math.random() * warpTargets.length)
];

ball.x = target.x + (Math.random() - .5) * 18;
ball.y = target.y + (Math.random() - .5) * 14;

const angle = -Math.PI + .35 + Math.random() * (Math.PI - .7);
const speed = 360 + Math.random() * 220;

ball.vx = Math.cos(angle) * speed;
ball.vy = Math.sin(angle) * speed;
```

移動後すぐに別の穴へ入ってワープを繰り返さないよう、すべての穴に`1.15秒`のクールダウンを入れています。

```js
warpHoles.forEach(hole => {
  hole.cooldown = Math.max(hole.cooldown, 1.15);
});
```

ペナルティだった穴が、先を読めないギミックに変わりました。「どこ!?」と文字が出るのは、その予測できなさを説明ではなく反応にしたかったためです。

## 8. 「下まで来ない」は重力だけでは解決しない

重力を強くすればボールは下へ来ますが、フリッパー周辺まで動きが重くなります。

そこで、発射から1.3秒後、上部にいる間だけ、少しずつ下方向の加速を追加しています。

```js
const descentAssist = !ball.inShooterLane && ball.y < 640
  ? Math.min(360, Math.max(0, playfieldTime - 1.3) * 180)
  : 0;

ball.vy += (GRAVITY + descentAssist) * step;
```

フリッパー付近では追加加速を切り、プレイヤーが打ち返す操作感を残します。

これは現実の物理を正確に再現するためではなく、長い上部ループを避け、遊びの中心であるフリッパーまで定期的にボールを届けるための調整です。

## テストプレイで確認したこと

ピンボールは、画面が正しく描画されているだけでは動作確認になりません。自分と上司で繰り返し遊び、次のポイントを見ました。

- 一定時間内にボールがフリッパーまで来るか
- 必ず失敗する導線がないか
- 細い隙間やつなぎ目で静止しないか
- 発射が弱すぎたとき、ボールを失わずやり直せるか
- 難しくするための仕掛けが、理不尽になっていないか
- 見た目と実際の当たり判定がずれていないか

特に、「落ちないようにする」と「簡単すぎないようにする」は同じではありません。

失敗をなくすのではなく、理由の分からない失敗をなくす。落とし穴をワープに変えたり、シューターレーンへの逆流を防いだりしたのは、そのためです。

## まとめ

Canvasのピンボールで詰まりを減らすには、衝突判定の式だけでなく、衝突形状同士の接続を設計する必要がありました。

- 重なりを解消してから速度を反射する
- 高速移動はサブステップですり抜けを減らす
- 通路はボールと両側の衝突半径まで含めて計算する
- 通さない隙間は完全に閉じる
- 描画と衝突判定で同じ形状データを使う
- 曲線とフリッパーの半径を滑らかにつなぐ
- 難易度と理不尽さを分けて考える

ゲーム制作では、「動いた」から「不自然な導線がない」までの距離が長いです。その距離を埋めるのは、数式と同じくらい、繰り返しのテストプレイでした。

