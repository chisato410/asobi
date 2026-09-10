---
title: "入れ物を固定するのをやめる。Vanilla JS + Matter.jsでネコを積むバランスゲームを作る"
emoji: "⚖️"
type: "tech"
topics: ["javascript", "html", "css", "matterjs", "ゲーム制作"]
published: false
---

同じもの同士をくっつけて大きくしていくゲームは、たいてい四角い箱の中で遊びます。上から落として、積んで、あふれたら終わりです。

その箱を、シーソーの皿に置き換えました。落とす場所を決める理由が「どこが空いているか」から「いまどちらが重いか」に変わります。名前は**ねこもり**、6種類のネコを合体させて、最後の「デカネコ」を目指すゲームです。

https://asobi-nekomori.vercel.app

![ねこもりの紹介画像。シーソーの皿の上に積み重なったネコたちと、ねこもりのタイトル](https://asobi-nekomori.vercel.app/og-image.png)

物理エンジンは [matter-js](https://brm.io/matter-js/) 0.20.0 で、それ以外はVanilla JavaScriptです。

作りはじめて最初に詰まったのは、合体の判定ではなく**「皿をどう固定するか」**でした。静的な板は傾いてくれず、自由に動く剛体はネコを1匹乗せた瞬間に回転しながら飛んでいきます。

この記事では、次の仕組みを実装した方法を紹介します。

- 皿を、静的でも自由でもない「バネ付きヒンジ」として自作する
- 見た目の皿と、当たり判定の皿を別に持つ
- 左右対称なネコが皿の端で不自然に立つのを、重心のずらしで直す
- 物理が暴れるのを上限で押さえる
- 合体を、衝突イベントの中でやらない
- 描画はMatterに任せず、DOMを毎フレーム動かす
- 白背景のPNG 1枚から6匹を切り出す（閾値ではなく、外周からの塗りつぶしで）
- 「こぼれた」を3つの条件で判定し、傾きは420ms続いてから終わりにする
- 結果画像は画面を撮らず、同じ状態からもう一度描く

## 箱をシーソーにすると、狙う理由が変わる

このゲームの入れ物は、真ん中の支点で傾く1枚の皿です。壁はありません。ネコは同じ種類同士が触れると1段上のネコに合体し、皿から落ちるか、皿がひっくり返ると終わります。

```js
const CAT_NAMES = ["しまねこ", "まるねこ", "しろふわ", "みけねこ", "のびねこ", "デカネコ"];
const CAT_SPECS = [
  { w: 68, h: 88, art: 103, chamfer: 24, score: 8 },
  { w: 104, h: 60, art: 112, chamfer: 26, score: 22 },
  { w: 124, h: 55, art: 132, chamfer: 26, score: 54 },
  { w: 126, h: 76, art: 140, chamfer: 32, score: 120 },
  { w: 144, h: 72, art: 164, chamfer: 30, score: 260 },
  { w: 124, h: 150, art: 166, chamfer: 52, score: 600 },
];
```

`art` は絵の一辺、`score` は合体したときに入る点数です。当たり判定の形は種類ごとに違うので、寸法は後述の `createCat` に直接書いています。

落ちてくるネコの種類は、重み付き抽選を書かずに配列で持ちました。

```js
const SPAWN_POOL = [0, 0, 0, 0, 1, 1, 1, 2];

function randomSpawnLevel() {
  return SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
}
```

8個の配列から1個引くだけです。確率を調整したいときは要素を足すか消すかで済み、合計を1に保つ計算が要りません。「しまねこ4、まるねこ3、しろふわ1」という比率が、そのまま目で読めます。

壁がないので、真ん中に積み上げるほど安全で、端に置くほど傾きます。同じネコを隣に落として合体させたい気持ちと、左右を釣り合わせたい気持ちが毎回ぶつかる、という設計です。

## 皿は静的でも自由でもない。バネ付きヒンジを自作する

最初に試したのは `isStatic: true` の板でした。ネコは正しく上に積まれますが、皿はまったく傾きません。次に静的をやめて普通の剛体にすると、今度はネコが乗った瞬間に皿が押し下げられ、そのまま回転しながら画面外へ落ちていきました。

欲しかったのは「支点から動かないが、傾くことはできる板」です。matter-js には回転ジョイントの専用APIがないので、**制約（Constraint）で位置を留め、傾きの制御は自分で書く**ことにしました。

```js
plateConstraint = Constraint.create({
  pointA: { x: plateX, y: plateY },
  bodyB: plateBody,
  pointB: { x: plateX - plateBody.position.x, y: plateY - plateBody.position.y },
  length: 0,
  stiffness: 0.98,
  damping: 0.18,
});
```

`pointA` はワールド側の支点、`pointB` は皿のローカル座標での同じ点です。`length: 0` なので2点は重なり続け、皿は支点から離れられません。`stiffness` を1.0ではなく0.98にしているのは、完全に硬い制約だと重いネコが乗った瞬間の反発が皿全体に跳ね返って、細かく震えてしまうためです。わずかに逃げ道を残すと、押されたぶんだけ沈んで戻ります。

制約は位置を留めるだけなので、傾きは `beforeUpdate` で毎フレーム、自分でトルクを足して作ります。

```js
function stabilizePlate() {
  if (!plateBody || state === "gameover") return;
  const angle = plateBody.angle;
  const restoring = -angle * plateBody.mass * 0.0023;
  const damping = -plateBody.angularVelocity * plateBody.mass * 0.048;
  plateBody.torque += restoring + damping;

  if (Math.abs(angle) > 0.4) {
    plateBody.torque += -Math.sign(angle) * (Math.abs(angle) - 0.4) * plateBody.mass * 0.018;
  }
  if (Math.abs(plateBody.angularVelocity) > MAX_PLATE_ANGULAR_SPEED) {
    Body.setAngularVelocity(plateBody, Math.sign(plateBody.angularVelocity) * MAX_PLATE_ANGULAR_SPEED);
  }
  // ...ネコ側の上限は後述
}
```

3段構えです。

1つめの `restoring` は、傾きに比例して水平へ引き戻すバネです。符号が角度の逆なので、傾くほど強く戻ります。2つめの `damping` は角速度に比例したブレーキで、これがないとバネだけが働いて皿が永久に揺れ続けます。バネとブレーキを別々の係数で持てるのが、自分で書く利点でした。

3つめは、0.4ラジアン（約23度）を超えたときだけ足す追加のバネです。`(Math.abs(angle) - 0.4)` の分だけ効くので、浅い傾きには影響しません。「普段はゆるく、危ないときだけ強く」戻したかったのですが、全体のバネを強くすると今度は傾きが浅くなってゲームが簡単になってしまいます。**しきい値の外側にだけ効くバネを重ねる**ことで、遊びやすさと安全弁を両立させました。

最後の角速度クランプは、破綻防止です。大きく育ったネコが端へ転がると、1フレームで皿が反転するほどのトルクが入ります。

```js
const MAX_PLATE_ANGULAR_SPEED = 0.047;
```

この値は、あとから0.055を下げたものです。自分で遊んでいて「気づいたら終わっていた」と感じたとき、原因は角度の上限ではなく**傾きはじめてから終わるまでの速さ**でした。上限を下げると、ひっくり返るまでの猶予が伸びて、あわてて反対側に落として立て直す遊びが成立します。

慣性も足しています。

```js
Body.setInertia(plateBody, plateBody.inertia * 1.75);
```

慣性は「回りにくさ」です。1.75倍にすると、同じトルクでも回りはじめがゆっくりになります。皿を厚くしたり重くしたりしても近いことはできますが、そちらは同時にネコとの衝突の跳ね方まで変わってしまいます。回りにくさだけを触りたいときは、質量ではなく慣性を直接いじるほうが副作用が小さいです。

## 見た目の皿と、当たり判定の皿を分ける

皿の当たり判定は、1枚の矩形ではなく3つの部品の複合ボディです。

```js
const colliderY = plateY - (PLATE_HEIGHT - PLATE_COLLIDER_HEIGHT) / 2;
const plateBase = Bodies.rectangle(plateX, colliderY, plateWidth - PLATE_LIP_RADIUS * 2, PLATE_COLLIDER_HEIGHT, {
  ...plateOptions,
  chamfer: { radius: PLATE_LIP_RADIUS },
});
const leftLip = Bodies.circle(plateX - plateWidth / 2 + PLATE_LIP_RADIUS, colliderY, PLATE_LIP_RADIUS, plateOptions);
const rightLip = Bodies.circle(plateX + plateWidth / 2 - PLATE_LIP_RADIUS, colliderY, PLATE_LIP_RADIUS, plateOptions);
plateBody = Body.create({ parts: [plateBase, leftLip, rightLip], ...plateOptions });
```

両端に円を置いているのは、皿のふちを丸くするためです。矩形のままだと角が立っていて、こぼれかけたネコが端に引っかかったまま止まります。丸いふちなら、越えたネコはそのまま滑って落ちます。「落ちるか落ちないか」が角の1ピクセルで決まらないようにしたかった、という理由です。

高さの数字は2つあります。

```js
const PLATE_HEIGHT = 44;
const PLATE_COLLIDER_HEIGHT = 24;
```

見た目の皿は44px、当たり判定は24pxです。CSSの皿は下側が丸い器の形をしていて、ネコが触るのは上面だけです。見た目どおり44pxの判定を置くと、ネコが皿の絵の中に沈んで見えます。`colliderY` で判定を上寄りに10pxずらしているのは、絵の上面と判定の上面を合わせるためです。

一方で皿の幅は、CSSとJavaScriptの両方に同じ数字が出てきます。

```js
const plateWidth = Math.min(width * (width <= 600 ? 0.76 : 0.64), 650);
```

```css
.plate { width: min(64%, 650px); margin-left: calc(min(64%, 650px) / -2); }
@media (max-width: 600px) {
  .plate { width: 76%; margin-left: -38%; }
}
```

ここは重複を残しました。JavaScriptから幅を書き込めば一元化できますが、皿はページを開いた直後から見えていてほしい要素です。物理の初期化を待って幅が入ると、一瞬だけ細い皿が表示されます。**初期表示に関わる寸法はCSSに置き、物理側は同じ数字を読み直す**という分担にして、幅の定義だけ二重に持つことを許容しました。

なお、DOMの皿を傾ける処理は1行です。

```js
el.plate.style.transform = `rotate(${plateBody.angle}rad)`;
```

matter-js の角度はラジアンなので、`deg` に変換せず `rad` のまま渡せます。

## 左右対称なネコは、皿の端で不自然に立つ

物理が正しく動きはじめてから、見た目の問題が出ました。ネコが皿のふちの上で、**まっすぐ立ったまま止まる**のです。倒れそうで倒れない、鉛筆が芯で立っているような状態が何秒も続きます。

原因は、剛体の重心が形の中心にぴったりあることでした。真下に支点があると、左右のモーメントが完全に釣り合ってしまい、どちらにも倒れません。現実のネコは体をひねるので、こうはなりません。

そこで、**重心だけを数ピクセルずらす**ことにしました。

```js
// A perfectly centered body can balance unnaturally on a narrow edge. Shift
// its physical centre slightly so gravity chooses a natural falling side.
const portrait = level === 0 || level === CAT_SPECS.length - 1;
const centreOffset = portrait
  ? { x: scaled(6) * balanceDirection, y: 0 }
  : { x: 0, y: -scaled(6) };
const cos = Math.cos(body.angle);
const sin = Math.sin(body.angle);
Body.setCentre(body, {
  x: centreOffset.x * cos - centreOffset.y * sin,
  y: centreOffset.x * sin + centreOffset.y * cos,
}, true);
body.artOffset = { x: -centreOffset.x, y: -centreOffset.y };
```

縦長のネコ（しまねことデカネコ）は、重心を左右どちらかへ6pxずらします。`balanceDirection` は生成時に決めたランダムな符号なので、どちら側に倒れるかは毎回変わります。横長のネコは、重心を6px上へ上げます。重心が高いほど倒れやすくなるので、ふちに乗ったときに前後どちらかへ転がります。

`Body.setCentre` の第3引数 `true` は「相対指定」です。渡した値ぶんだけ現在の重心をずらします。ずらす向きは、生成時の傾き `body.angle` ぶん回してから渡します。ネコは落下開始時に `±0.05` ラジアンの傾きを持っているので、回さずに渡すとローカル座標とワールド座標がずれて、傾きの大きい個体だけ意図と違う方向に重心が動きます。

そして重要なのが最後の1行です。`Body.setCentre` を呼ぶと `body.position` は新しい重心を指すようになるので、絵をそのまま `position` に置くと、ずらしたぶんだけ絵が横（または上）へずれます。そこで逆向きのオフセットを覚えておき、描画のときに戻します。

```js
function catVisual(body) {
  const size = CAT_SPECS[body.catLevel].art * (body.catScale || DESKTOP_CAT_SCALE);
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const offset = body.artOffset || { x: 0, y: 0 };
  return {
    x: body.position.x + offset.x * cos - offset.y * sin,
    y: body.position.y + offset.x * sin + offset.y * cos,
    size,
  };
}
```

こちらは毎フレーム、その時点の角度で回して足します。結果として、**物理は少し偏った重心で計算され、絵は形の中心に描かれます**。「見た目は変えず、挙動だけ変える」という切り分けができるのは、描画を物理エンジンに任せていないからです。

## 物理が暴れるのを、上限で押さえる

積み上げるゲームなので、下のほうのネコは常に押されています。この状態で計算が甘いと、ネコがめり込んだり、押し出されて弾け飛んだりします。

まずソルバーの反復回数を上げました。

```js
engine = Engine.create({ enableSleeping: true });
engine.gravity.y = 1.08;
engine.positionIterations = 12;
engine.velocityIterations = 10;
engine.constraintIterations = 4;
```

既定値（6 / 4 / 2）では、5匹ほど積んだ時点で山がゆっくり沈み込みました。反復を増やすと重ねたときの潜り込みが止まります。同時に `enableSleeping: true` で、動きの止まったネコを計算から外します。積み上がるゲームは「もう動かないネコ」が増えていくので、この設定が効きます。

```js
const bodyOptions = {
  label: `cat-${level}`,
  restitution: 0.018,
  friction: 0.96,
  frictionStatic: 1.9,
  frictionAir: 0.015,
  density: CAT_DENSITY,
  slop: 0.025,
  sleepThreshold: 28,
};
```

`restitution`（反発）はほぼ0です。ネコが跳ねると山が崩れます。逆に `friction` と `frictionStatic` は高めにして、傾いた皿の上でもすぐには滑らないようにしています。滑らせたいのは、皿が大きく傾いたときだけです。

それでも、たまに大きな力が入ります。そこで `beforeUpdate` の中で、ネコ側にも上限を置きました。

```js
for (const cat of bodies) {
  if (Math.abs(cat.angularVelocity) > 0.17) {
    Body.setAngularVelocity(cat, Math.sign(cat.angularVelocity) * 0.17);
  }
  const speed = Math.hypot(cat.velocity.x, cat.velocity.y);
  if (speed > 15) Body.setVelocity(cat, { x: cat.velocity.x * 0.82, y: cat.velocity.y * 0.82 });
}
```

角速度は0.17で切り、速度は15を超えたら0.82倍に減衰させます。角速度は硬く切り、速度は掛け算で緩めているのは、狙いが違うためです。ネコがコマのように高速回転するのは絵として見苦しいので上限で止め、落下速度は「速すぎるのを抑える」だけで、落ちてくる勢いそのものは残したい、という区別です。

ネコの密度も、あとから `0.00108` を下げています。

```js
const CAT_DENSITY = 0.00092;
```

密度を下げるとネコが軽くなり、同じ位置に落としても皿の傾きが小さくなります。皿側のバネを強くしても似た結果になりますが、そちらは「傾いた皿が水平に戻る速さ」まで変わってしまいます。**ネコが軽いのか、皿が硬いのか**を分けて考えられるように、遊びやすさの調整はネコの密度で行うことにしました。

## 合体は、衝突イベントの中でやらない

同じ種類のネコが触れたら合体します。判定は `collisionStart` です。

```js
function handleCollisions(event) {
  if (state !== "playing") return;
  for (const pair of event.pairs) {
    const a = pair.bodyA.parent || pair.bodyA;
    const b = pair.bodyB.parent || pair.bodyB;
    if (!bodies.has(a) || !bodies.has(b)) continue;
    if (a.catLevel !== b.catLevel || a.catLevel >= CAT_SPECS.length - 1) continue;
    if (a.isMerging || b.isMerging) continue;

    a.isMerging = true;
    b.isMerging = true;
    window.setTimeout(() => mergeCats(a, b), 70);
  }
}
```

3つ、気をつける点があります。

1つめは `pair.bodyA.parent` です。ネコは「胴の矩形＋頭の円」のような複合ボディなので、衝突イベントで渡ってくるのは部品のほうです。部品のままでは `catLevel` を持っていないので、必ず親を辿ります。matter-jsのボディは既定で `parent` に自分自身が入るので、単一のボディで作った種類（みけねこ）もそのまま親として扱えます。`|| pair.bodyA` は保険です。そのうえで `bodies` に入っているかを確認して、皿や消滅済みのネコを除外します。

2つめは `isMerging` フラグです。1フレームの `event.pairs` には、同じネコの複数の部品同士の衝突が別々のペアとして入ります。フラグを立てずに処理すると、同じ2匹に対して合体が2回走り、ネコが1匹増えます。

3つめが `setTimeout(..., 70)` です。`collisionStart` は物理エンジンの計算途中に発火します。そのハンドラの中で `Composite.remove` と `Composite.add` を呼ぶと、エンジンが今まさに参照している配列を書き換えることになります。70ms待つのは、計算が終わったあとに実行させるためです。同時に、触れた瞬間に消えるのではなく、ぶつかる音と絵が一瞬見えてから合体するので、**遅延がそのまま演出になります**。

合体そのものは、2匹消して1匹作るだけです。

```js
function mergeCats(a, b) {
  if (state !== "playing" || !bodies.has(a) || !bodies.has(b)) return;
  const level = a.catLevel + 1;
  const x = (a.position.x + b.position.x) / 2;
  const y = (a.position.y + b.position.y) / 2;
  const velocity = {
    x: (a.velocity.x + b.velocity.x) * .2,
    y: Math.max(-2.2, Math.min(-0.8, (a.velocity.y + b.velocity.y) * .08 - 1.1)),
  };

  removeCat(a);
  removeCat(b);
  const merged = createCat(level, x, y, { angle: (a.angle + b.angle) / 2 });
  Body.setVelocity(merged, velocity);
  score += CAT_SPECS[level].score;
  updateScore();
  // ...進化表を光らせて、粒子を飛ばして、音を鳴らす
}
```

先頭の再チェックは、70msのあいだに状況が変わる可能性があるためです。待っている最中にゲームが終わったり、片方が先に別の合体で消えていたりします。フラグを立てた時点の判断を、実行時にもう一度確かめています。

速度の受け渡しには手を入れました。横方向は2匹の平均の0.2倍まで落とし、縦方向は必ず上向き（`-2.2` から `-0.8` の範囲）になるようクランプします。落下中のネコ同士が合体したとき、そのまま下向きの速度を引き継ぐと、生まれた大きいネコが山に潜り込みます。上向きに固定すると、合体した瞬間に「ぽんっ」と少し持ち上がってから落ち着きます。物理的に正しい運動量の保存ではありませんが、合体が起きたことが伝わるほうを選びました。

## 描画はMatterのRenderを使わず、DOMを動かす

matter-js には `Matter.Render` が付いていますが、使っていません。ネコは1枚絵で、影を落としたり、CSSのクラスで種類を切り替えたりしたかったので、**物理は計算だけ、描画はDOM**という分担にしました。

`requestAnimationFrame` のループで、ボディの座標をDOMに書き込みます。

```js
for (const body of [...bodies]) {
  const visual = catVisual(body);
  body.art.style.transform = `translate3d(${visual.x - visual.size / 2}px, ${visual.y - visual.size / 2}px, 0) rotate(${body.angle}rad)`;
  // ...こぼれ判定は後述
}
```

`left` / `top` ではなく `transform` にまとめているのは、レイアウトを再計算させないためです。CSS側は絵を敷くだけです。

```css
.physics-cat {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: center;
  filter: drop-shadow(2px 4px 1px rgba(63,41,20,.16));
  will-change: transform;
}
.cat-level-0 { background-image: var(--cat-0); }
.cat-level-1 { background-image: var(--cat-1); }
/* ...5まで */
```

`translate3d` の座標が「絵の左上」なので、中心座標から半分を引いています。`transform-origin: center` にしておくと、`rotate` は絵の中心で回ります。

`bodies` を `[...bodies]` でコピーしているのは、ループの中で `removeCat`（`Set` からの削除）が走る可能性があるためです。

種類の切り替えは、クラスの付け外しだけで済みます。

```js
function updateNext() {
  for (let i = 0; i < CAT_SPECS.length; i += 1) {
    el.nextCat.classList.toggle(`cat-level-${i}`, i === nextLevel);
    el.guideCat.classList.toggle(`cat-level-${i}`, i === nextLevel);
  }
  el.catName.textContent = CAT_NAMES[nextLevel];
}
```

盤面のネコ、次のネコのプレビュー、進化表、スタート画面のイラスト、すべてが同じ `cat-level-N` クラスを使います。画像の指定場所が1か所（CSS変数）に集まるので、絵を差し替えるときにJavaScriptを触りません。

## 白背景のPNG 1枚から、6匹を切り出す

ネコの絵は、6匹が並んだ1536×1024のPNG 1枚として画像生成で用意しました。これをそのまま使うわけにはいきません。透過されていないので背景が白いままで、しかも1枚に6匹入っています。

切り出す位置は、座標で持っています。

```js
const CAT_CROPS = [
  { x: 104, y: 92, w: 286, h: 366 },
  { x: 516, y: 184, w: 392, h: 286 },
  { x: 970, y: 218, w: 542, h: 260 },
  { x: 58, y: 616, w: 418, h: 326 },
  { x: 468, y: 520, w: 508, h: 424 },
  { x: 1020, y: 506, w: 466, h: 470 },
];
```

問題は背景の抜き方でした。最初は「明るいピクセルを透明にする」という閾値方式を書きました。これは3匹目で破綻します。**「しろふわ」は白いネコ**なので、背景と一緒に体まで消えるのです。輪郭線の内側だけを残そうとしても、白い毛の部分と白い紙は、色だけ見れば区別がつきません。

区別できるのは、色ではなく**外周から繋がっているか**でした。そこで、画像の四辺から塗りつぶし（flood fill）を走らせて、そこから辿り着ける明るいピクセルだけを透明にすることにしました。

```js
function isConnectedBackground(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  const darkest = Math.min(red, green, blue);
  const lightest = Math.max(red, green, blue);
  return alpha === 0 || (darkest > 218 && lightest - darkest < 34);
}
```

背景と見なす条件は「すでに透明」か「十分に明るく、かつ色味の偏りが小さい」です。`darkest > 218` で明るさを、`lightest - darkest < 34` で彩度の低さを見ています。生成画像の白い紙にはわずかな色ムラがあるので、真っ白だけを条件にすると縁に汚れが残ります。

塗りつぶしは、外周をすべてキューに入れてから幅優先で広げます。

```js
const visited = new Uint8Array(crop.w * crop.h);
const queue = new Int32Array(crop.w * crop.h);
let head = 0;
let tail = 0;

function enqueue(x, y) {
  if (x < 0 || y < 0 || x >= crop.w || y >= crop.h) return;
  const pixel = y * crop.w + x;
  if (visited[pixel]) return;
  visited[pixel] = 1;
  if (!isConnectedBackground(data, pixel * 4)) return;
  queue[tail] = pixel;
  tail += 1;
}

for (let x = 0; x < crop.w; x += 1) {
  enqueue(x, 0);
  enqueue(x, crop.h - 1);
}
for (let y = 1; y < crop.h - 1; y += 1) {
  enqueue(0, y);
  enqueue(crop.w - 1, y);
}

while (head < tail) {
  const pixel = queue[head];
  head += 1;
  const x = pixel % crop.w;
  const y = Math.floor(pixel / crop.w);
  data[pixel * 4 + 3] = 0;
  enqueue(x - 1, y);
  enqueue(x + 1, y);
  enqueue(x, y - 1);
  enqueue(x, y + 1);
}
```

キューは配列の `shift()` ではなく、`Int32Array` と `head` / `tail` の添字で回しています。最大でも全ピクセル数しか入らないので、長さは最初から確定します。`visited` も `Uint8Array` です。1匹あたり20万ピクセル前後を触るので、ここで通常の配列を使うと6匹ぶんの処理が体感できるほど遅くなります。

`enqueue` の中で `visited` を立ててから背景判定をしているのも、意図があります。背景でないピクセルにも訪問済みの印が付くので、輪郭のピクセルが何度も判定されません。

これで、白いネコの体は外周と繋がっていないため残り、紙の部分だけが消えます。ネコの内側に閉じた白い領域（耳の中など）も同じ理由で残ります。閾値では絶対にできない区別が、**接続性という別の軸を使うだけで**できました。

抜いたあとは、実際の輪郭で切りそろえます。

```js
let minX = crop.w, minY = crop.h, maxX = 0, maxY = 0;
for (let y = 0; y < crop.h; y += 1) {
  for (let x = 0; x < crop.w; x += 1) {
    if (data[(y * crop.w + x) * 4 + 3] < 12) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}

const padding = 8;
```

手で書いた `CAT_CROPS` の余白は、6匹それぞれ違います。そのまま使うと、余白の多い絵だけ小さく見えます。透明でない範囲を測ってから8pxの余白を付けて切り直すことで、どの絵も「枠いっぱいにネコが入った状態」に揃います。落として積むゲームなので、絵の大きさと当たり判定の大きさが揃っていないと、当たっていないのに止まったように見えます。

できあがった画像は、CSS変数として流し込みます。

```js
async function prepareCatArt() {
  try {
    const source = await loadImage(CAT_SOURCE);
    const urls = await Promise.all(CAT_CROPS.map((crop) => extractTransparentCat(source, crop)));
    urls.forEach((url, index) => {
      document.documentElement.style.setProperty(`--cat-${index}`, `url("${url}")`);
    });
    catArtImages = await Promise.all(urls.map((url) => loadImage(url)));
    document.body.classList.add("cats-ready");
  } catch {
    showToast("ネコ画像を読み込めませんでした");
  }
}
```

`toDataURL` ではなく `toBlob` から `URL.createObjectURL` を使っています。data URLにすると1匹で数百KBの文字列がCSSに入るので、6匹ぶんが `style` 属性に並びます。Blob URLなら短い参照だけが入ります。

処理が終わるまでは、絵のある要素すべてを透明にしておきます。

```css
.physics-cat, .preview-cat, .next-cat, .start-cat, .evolution-cat {
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  opacity: 0;
  transition: opacity .18s ease;
}
.cats-ready .physics-cat,
.cats-ready .preview-cat,
.cats-ready .next-cat,
.cats-ready .start-cat,
.cats-ready .evolution-cat { opacity: 1; }
```

`prepareCatArt()` は非同期で、`setupPhysics()` は待たずに走ります。皿とUIは先に出て、ネコの絵だけがあとから0.18秒でふわっと現れます。背景を抜く処理はメインスレッドで動くので、この待ち時間をゼロにはできません。**待ち時間を隠すのではなく、遅れて現れる演出として見せる**ことにしました。

`catArtImages` に読み込み直した `Image` を持っているのは、後述の結果画像をCanvasに描くときに使うためです。

## 「こぼれた」は3つの条件で判定する

ゲームオーバーは、ネコが皿から落ちたときです。単純に「一定の高さより下に来たら」で判定すると、取りこぼしが出ました。

```js
function hasSpilled(body, metrics, stageWidth) {
  const visual = catVisual(body);
  const crossedSpillLine = visual.y > metrics.spillLineY;
  const leftScreen = body.bounds.max.x < 0 || body.bounds.min.x > stageWidth;
  return crossedSpillLine || leftScreen || isOutsidePlateEnd(body, metrics);
}
```

1つめは、画面下から45pxの「こぼれライン」を越えたかどうかです。破線で表示しているので、遊ぶ側にも位置が見えています。

2つめは、画面の左右にはみ出したかどうかです。皿の端で強く弾かれたネコは、ラインより下へ落ちる前に横へ飛んでいきます。この場合、`crossedSpillLine` だけでは検知が遅れます。

3つめが厄介でした。**皿の端を越えたのに、まだラインまで落ちていない**状態です。皿は傾くので、傾いた皿の上端に沿って滑り落ちたネコは、しばらく皿の横にとどまります。この間、遊ぶ側から見れば明らかに「こぼれた」のに、判定はまだ成立しません。

そこで、皿のローカル座標に変換して判定しました。

```js
function isOutsidePlateEnd(body, metrics) {
  if (!plateBody) return false;
  const cos = Math.cos(plateBody.angle);
  const sin = Math.sin(plateBody.angle);
  let minX = Infinity;
  let maxX = -Infinity;
  for (const vertex of body.vertices) {
    const dx = vertex.x - metrics.plateX;
    const dy = vertex.y - metrics.plateY;
    const localX = dx * cos + dy * sin;
    minX = Math.min(minX, localX);
    maxX = Math.max(maxX, localX);
  }

  const visual = catVisual(body);
  const visualDx = visual.x - metrics.plateX;
  const visualDy = visual.y - metrics.plateY;
  const localY = -visualDx * sin + visualDy * cos;
  const halfPlate = metrics.plateWidth / 2;
  const hasClearedEnd = maxX < -halfPlate - 2 || minX > halfPlate + 2;
  return hasClearedEnd && localY > -PLATE_HEIGHT / 2;
}
```

支点を原点にして、皿の角度ぶん逆回転させると、皿はいつでも水平な線として扱えます。この座標系での `localX` を、ネコの全頂点について測ります。頂点の最大値が皿の左端より外、または最小値が右端より外なら、ネコは完全に皿の外です。`- 2` / `+ 2` の余裕は、ふちにぴったり接している状態で判定が揺れないようにするためです。

これだけでは不十分で、`localY` の条件が必要でした。落とすネコは画面上部から落ちてきます。狙いを端に寄せると、落下中のネコは「皿の端より外」を満たしてしまいます。そのままだと、皿の上を通過している途中でゲームオーバーになります。`localY > -PLATE_HEIGHT / 2` を足すと、**皿の面より下に来ている**ことが条件に加わり、空中を落下しているネコは除外されます。

つまり3つ目の条件は、「皿の外側、かつ皿の高さより下」という2軸の判定です。1つの座標系に揃えてしまえば、傾いた皿でも同じ式で書けます。

## 傾きは、420ms続いてから終わりにする

もう1つのゲームオーバーが、皿のひっくり返りです。これを「角度がしきい値を超えたら即終了」にすると、遊べないゲームになりました。合体でネコが大きくなった瞬間、皿は必ず大きく揺れるので、その一瞬で終わってしまいます。

```js
const normalized = Math.max(-1, Math.min(1, plateBody.angle / MAX_TILT));
const abs = Math.abs(normalized);

if (state === "playing" && abs > .93) {
  if (!tiltStartedAt) tiltStartedAt = now;
  if (now - tiltStartedAt > 420) endGame();
} else {
  tiltStartedAt = 0;
}
```

しきい値の93%を超えた時刻を覚えておき、420ms続いたときだけ終了します。途中で戻れば `tiltStartedAt` は0に戻り、猶予はリセットされます。この420msが、反対側にネコを落として立て直す時間です。**危険な状態そのものではなく、危険な状態が続いたこと**を条件にしただけで、揺れが「事故」から「立て直す局面」に変わりました。

同じ正規化した値を、傾きメーターの表示にも使っています。

```js
el.tiltNeedle.style.left = `${50 + normalized * 46}%`;
if (abs < .34) {
  el.tiltLabel.textContent = "あんてい";
  el.tiltLabel.style.color = "var(--moss)";
} else if (abs < .72) {
  el.tiltLabel.textContent = "ゆらゆら";
  el.tiltLabel.style.color = "#bd7a24";
} else {
  el.tiltLabel.textContent = "あぶない！";
  el.tiltLabel.style.color = "#c45c44";
}
```

`MAX_TILT` で割って -1〜1 にしてあるので、針の位置は `50 + normalized * 46`（%）で出せます。46にしているのは、両端でメーターの枠から針がはみ出さないようにするためです。

皿の傾きは絵としても見えていますが、数度の違いは目で読み取れません。「あんてい / ゆらゆら / あぶない！」という3段の言葉にすると、いま落としていいのか、待つべきなのかが判断できます。ゲームオーバーの条件（93%が420ms）と、「あぶない！」の境界（72%）をずらしているのは、赤くなってから終わるまでに気づく余地を持たせるためです。

なお、落とす操作には短いクールダウンを置いています。

```js
window.setTimeout(() => {
  if (state !== "playing") return;
  canDrop = true;
}, 520);
```

連打で同じ場所に積み重ねられると、物理が破綻します。520msは「押した手応えは残るが、連打はできない」あたりでした。

## モバイルは、ネコを小さくして皿を広く感じさせる

スマートフォンでは皿の幅が絶対値として小さくなるので、そのままだと極端に難しくなります。皿を広くする手もありますが、画面の幅に対して皿が占める割合を増やすと、落とす位置を選ぶ余地がなくなります。

そこで、ネコを小さくしました。

```js
const DESKTOP_CAT_SCALE = 0.85;
const MOBILE_CAT_SCALE = 0.7;
const MOBILE_STAGE_MAX = 600;

function catScaleForStage() {
  return stageSize().width <= MOBILE_STAGE_MAX ? MOBILE_CAT_SCALE : DESKTOP_CAT_SCALE;
}
```

皿に対するネコの相対的な大きさが変わるので、載る数が増えて、合体を狙う余裕が生まれます。倍率は生成時に決めて、ボディ自身に覚えさせます。

```js
body.catScale = catScale;
```

描画側（`catVisual`）は、この値を読んで絵の大きさを決めます。ボディに書いておくのは、途中で画面幅が変わっても、すでに存在するネコの絵と当たり判定がずれないようにするためです。倍率をグローバルな関数から毎フレーム読むと、画面を回した瞬間に**その場にいるネコの絵だけが伸縮して、判定と合わなくなります**。

タッチ操作のために `touch-action` が必要です。

```css
.playfield {
  --stage-h: min(66vh, 660px);
  touch-action: none;
  cursor: crosshair;
}
@media (max-width: 600px) {
  .playfield { --stage-h: 58svh; min-height: 430px; }
}
```

これがないと、盤面を縦になぞった時点でブラウザがページのスクロールと解釈し、`pointermove` が来なくなります。狙いを動かそうとするとページが動く、という状態でした。

高さに `svh` を使っているのは、モバイルのアドレスバーが出入りしても盤面の高さが変わらないようにするためです。`vh` だと、スクロールでアドレスバーが隠れた瞬間に盤面が伸び、そのぶん皿の位置（`height - PLATE_Y_OFFSET`）が下がります。

粒子用のCanvasだけは、実寸のピクセル数が必要なので `ResizeObserver` で追従させています。

```js
function resizeEffects() {
  const rect = el.playfield.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  el.effectsCanvas.width = Math.round(rect.width * ratio);
  el.effectsCanvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
```

`devicePixelRatio` を2で打ち止めにしているのは、3倍の端末でCanvasの面積が9倍になるのを避けるためです。`setTransform` で倍率を入れておけば、描画側はCSSピクセルの座標をそのまま渡せます。

## 結果画像は、画面を撮らずに同じ状態から描き直す

ゲームが終わると、そのときの皿の様子を1200×900の画像にして共有できます。DOMをそのまま画像にするライブラリは使わず、**同じ状態からCanvasにもう一度描いています**。

```js
const frame = { x: 54, y: 118, width: 1092, height: 710 };
const sceneScale = Math.min(frame.width / stage.width, frame.height / stage.height);
const sceneX = frame.x + (frame.width - stage.width * sceneScale) / 2;
const sceneY = frame.y + (frame.height - stage.height * sceneScale) / 2;
// ...
shot.translate(sceneX, sceneY);
shot.scale(sceneScale, sceneScale);
```

`translate` と `scale` を先にかけておくと、そのあとの描画は**盤面の座標をそのまま渡せます**。皿の角度、こぼれラインの位置、ネコの座標は、すべて画面と同じ計算式（`stageMetrics` と `catVisual`）から取ります。

```js
for (const body of bodies) {
  const visual = catVisual(body);
  shot.save();
  shot.translate(visual.x, visual.y);
  shot.rotate(body.angle);
  if (!drawContainedImage(shot, catArtImages[body.catLevel], visual.size)) {
    shot.beginPath();
    shot.arc(0, 0, visual.size * .28, 0, Math.PI * 2);
    shot.fillStyle = "#a68c49";
    shot.fill();
  }
  shot.restore();
}
```

`drawContainedImage` は、CSSの `background-size: contain` と同じことをCanvasでやる関数です。

```js
function drawContainedImage(context, image, size) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return false;
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, -width / 2, -height / 2, width, height);
  return true;
}
```

幅と高さそれぞれの倍率のうち、小さいほうを採るので、正方形の枠に長方形の絵が収まります。`false` を返したときは、絵の代わりに丸を描きます。画像の準備が終わる前にゲームが終わった場合でも、皿とネコの配置が分かる画像は出来上がります。

画像の生成は非同期なので、古い結果が後から届く可能性があります。

```js
async function prepareResultImage() {
  const captureId = ++resultCaptureId;
  resultImageBlob = null;
  el.shareResultButtons.forEach((button) => { button.disabled = true; });
  try {
    const blob = await createResultImage();
    if (captureId === resultCaptureId) resultImageBlob = blob;
  } catch {
    if (captureId === resultCaptureId) resultImageBlob = null;
  } finally {
    if (captureId === resultCaptureId) {
      el.shareResultButtons.forEach((button) => { button.disabled = false; });
    }
  }
}
```

`startGame()` でも `resultCaptureId` を進めているので、結果画面から「もういちど」を押した直後に前回の画像が届いても、`captureId` が合わずに捨てられます。共有ボタンは、画像ができるまで `disabled` です。

DOMを撮るライブラリを使わなかった理由は、ネコの絵がBlob URLの `background-image` で、皿がCSSの `border-radius` と `box-shadow` で描かれているからです。これらを正確に再現させるより、**表示に使っている状態をもう一度描く**ほうが確実でした。共有画像には枠と見出しを足したかったので、どちらにしてもCanvasに描く処理は必要でした。

## まとめ

ねこもりで効果があったのは、次の6点でした。

- 皿は静的でも自由でもなく、`Constraint` で位置を留めて、傾きの制御（バネ・ブレーキ・しきい値の外側だけ効く追加のバネ）を `beforeUpdate` で自分で書く
- 見た目と当たり判定を分ける。皿は絵より薄く、ネコの重心は絵の中心からずらして、絵は `artOffset` で元に戻す
- 合体は衝突ハンドラの中でやらず、フラグを立てて70ms後に実行する。遅延はそのまま演出になる
- 背景の抜き方は、色ではなく外周からの接続性で決める。閾値では白いネコが消える
- ゲームオーバーは「皿の外側」と「皿の面より下」を、皿のローカル座標に揃えて判定する
- 危険な状態そのものではなく、危険な状態が420ms続いたことを終了条件にする

一番効いたのは、皿の制御を物理エンジンに任せなかったことでした。ヒンジの挙動を自分で書いたおかげで、「揺れやすさ」と「戻りやすさ」と「限界の硬さ」を別々の数字として持てました。入れ物を固定するのをやめると、遊びの手応えはほとんどその3つの数字で決まります。物理エンジンは正しさを計算してくれますが、面白さのつまみは自分で用意するものだったのだと思います。
