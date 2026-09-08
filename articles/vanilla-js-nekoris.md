---
title: "「解ける盤面」を探すのをやめる。Vanilla JSで猫を箱に詰めるパズルを作る"
emoji: "📦"
type: "tech"
topics: ["javascript", "html", "css", "canvas", "ゲーム制作"]
published: false
---

猫は液体、という言い方があります。丸いざるに入れれば丸くなり、四角い箱に入れれば四角くなる。

その性質をそのままパズルにしました。寝相の違う猫を、段ボール箱のマスへすきまなく詰めるゲームです。名前は**ネコリス**、全10ステージで、箱は4×3から7×6まで大きくなります。

https://asobi-nekoris.vercel.app

![ネコリスの紹介画像。段ボール箱の中に、パズルのピースのようにぴったり収まっている猫たち](https://asobi-nekoris.vercel.app/ogp-game.png)

作りはじめて最初に詰まったのは、置けるかどうかの判定ではなく**「解ける盤面をどう用意するか」**でした。くぼんだ箱の形を先に描いて、そこへ猫を並べようとすると、たいてい1マスだけ余ります。

この記事では、Vanilla JavaScriptで次の仕組みを実装した方法を紹介します。

- 盤面を解答から逆算して、必ず解ける箱を作る
- 形を座標の配列で持ち、回転のたびに原点へ寄せ直す
- 12枚の猫の絵を、11種類の形と4方向へ割り当てる
- 回転した絵をCanvasで焼き直して、マスの縦横に合わせる
- 生成画像の半透明の縁を落として、余白を切りそろえる
- リサイズを監視せずに盤面を伸縮させる
- 猫のいないマスまで覆っているボタンの当たり判定

## 「解ける盤面」を先に描くと、1マス余る

最初は、箱の形を先に決めていました。7×6のマスのうち、ここは使う、ここは使わない、という凹凸を手で塗って、そこへ猫を詰められるように並べ方を探す、という順番です。

これがまったく進みませんでした。4〜5マスのピースで埋められる形は限られていて、面積が合っていても、隅に1マスだけ孤立したくぼみが残れば、その盤面はもう解けません。しかも解けないことは盤面を眺めても分からず、何度も並べ替えてようやく分かります。10ステージ分をこの方法で作るのは無理だと、2つめで気づきました。

## 盤面は、解答の和集合として作る

そこで順番を逆にしました。**先に解答を書き、盤面はそこから作る**ことにしました。

ステージのデータが持っているのは、箱の縦横のマス数と、猫のリストです。猫それぞれには、形と、最後に収まるべき位置と向き（`solution`）を書いてあります。

```js
{
  name: "はじめての箱",
  cols: 4, rows: 3,
  pieces: [
    // piece(id, 表示名, 形, 絵番号の名残, x, y, 回転)
    piece("maru", "まるまり", "square", 1, 0, 0, 0),
    piece("suya", "すやすや", "domino", 2, 2, 0, 1, { pose: "long" }),
    piece("choko", "ちょこん", "domino", 0, 3, 0, 1, { pose: "choko" }),
    piece("nobi", "のびーる", "long4", 4, 0, 2, 0, { pose: "nobi" }),
  ],
}
```

そして、埋めるべきマスの集合は、この解答をすべて重ねた和集合として求めます。

```js
function buildTarget(level) {
  const cells = new Set();
  level.pieces.forEach((item) => {
    rotatedCells(item.shape, item.solution.rotation).forEach(([x, y]) =>
      cells.add(key(item.solution.x + x, item.solution.y + y)),
    );
  });
  return cells;
}
```

この `target` に入っていないマスは、箱の外側として斜線で塗ります。

```css
.target-cell.is-void {
  background: repeating-linear-gradient(
    135deg,
    rgba(86, 55, 28, 0.08) 0 4px,
    rgba(86, 55, 28, 0.02) 4px 9px
  );
  border: 0;
}
```

この順番にすると、**解けない盤面は原理的に作れません**。盤面が解答から生まれているので、少なくとも1つの並べ方が必ず存在します。ステージ作りも「くぼみを塗って祈る」から「猫を好きに並べて、その外側を箱の外にする」に変わりました。

置けるかどうかの判定も短く済みます。埋めるべきマスの中にあり、かつまだ誰も使っていない、という2つを全マスについて確かめるだけです。

```js
function canPlace(item, x, y, rotation) {
  const used = occupiedCells(item.id);
  return rotatedCells(item.shape, rotation).every(
    ([dx, dy]) =>
      target.has(key(x + dx, y + dy)) && !used.has(key(x + dx, y + dy)),
  );
}
```

`occupiedCells(ignoreId)` で自分自身を除いているのは、置き直しのときに自分の影を踏まないためです。

出す順番は、データの並びと切り離しました。手が止まるのは猫の数ではなく置ける場所の候補が多いときだったので、遊んで違和感のあったステージを、数字の並べ替えだけで前後させられるようにしています。

```js
// 少ないピース数のまま、候補配置と先読みの枝分かれが増える順に並べる。
const LEVELS = [0, 3, 6, 1, 4, 2, 7, 8, 5, 9].map(
  (index) => LEVEL_DESIGNS[index],
);
```

## 形は座標の配列、回転は原点へ寄せ直す

猫の形は、埋めるマスの相対座標の配列で持っています。全11種類です。

```js
const SHAPES = {
  square: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  domino: [
    [0, 0],
    [1, 0],
  ],
  long4: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  corner3: [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  zig4: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  plus5: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  // ...long3, tee4, ell4, cup5, stair5
};
```

回転は、各座標に `[x, y] → [-y, x]` を掛けるだけです。画面の座標系は下が正なので、これで時計回りに90度回ります。ただし、掛けたままでは使えません。

```js
function rotatedCells(shape, turns) {
  let cells = shape.map(([x, y]) => [x, y]);
  for (let i = 0; i < ((turns % 4) + 4) % 4; i += 1)
    cells = cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
```

回した結果には、マイナスの座標が出てきます。`corner3` の `[[0,0],[1,0],[1,1]]` を1回まわすと `[[0,0],[0,1],[-1,1]]` になり、この状態で「x=0 に置く」と言われると `-1` のマスが箱の左外へはみ出します。

そこで、回したあとに最小値を引いて、形をもう一度原点へ寄せ直しています。こうしておくと、`placement.x` はどの向きでも「形の左上の角」を指す一つの意味になり、回転しても置いた猫が横へずれません。最後の `sort` は、同じ形なら回転回数によらず同じ順番の配列が返るようにするためです。

はみ出しの判定は書いていません。`canPlace` が「埋めるべきマスの集合に入っているか」だけを見るので、箱の外も盤面の外も同じ理由で弾かれます。境界のチェックを別に持つと、盤面の端と箱の凹凸で二重に条件を書くことになります。

## 12枚の絵を、11種類の形へ割り当てる

猫の絵は12枚のPNGです。11種類の形と4方向を掛けると44通りになりますが、回転はあとで機械的にかけられるので、必要なのは形ごとの1枚です。

どの形にどの絵を使うかは、`poseFor` が決めます。

```js
function poseFor(item, rotation) {
  const turns = ((rotation % 4) + 4) % 4;
  const shapePose = {
    zig4: "zig",
    ell4: "ell",
    plus5: "plus",
    cup5: "cup",
    stair5: "stair",
  }[item.shapeName];
  if (shapePose) return { name: shapePose, turns };
  if (item.pose === "vertical")
    return { name: "vertical", turns: (turns + 3) % 4 };
  if (item.pose) return { name: item.pose, turns };
  if (item.shapeName === "square") return { name: "square", turns: 0 };
  if (item.shapeName === "corner3") return { name: "corner", turns };
  if (item.shapeName === "tee4") return { name: "tee", turns };
  return { name: "long", turns };
}
```

形を見れば絵が一つに決まるものは形から、そうでなければデータの `pose` から、どちらもなければ形から推測します。同じ `domino` でも「すやすや」は伸びた猫、「ちょこん」は座った猫にしたいので、そこはデータ側で指定します。形が同じでも寝相は別、という分け方です。

例外が2つあります。`vertical` の絵は最初から縦向きに描いてあるので、形と同じだけ回すと横になります。そこで絵側の回転を1つ戻して `(turns + 3) % 4` にしています。もう1つは `square` で、2×2の丸まった猫は回しても輪郭が変わらないため、絵まで回すと90度ごとに横倒しになります。形の回転は許して、絵の回転だけ `turns: 0` で止めました。

パズルとしての回転と、絵としての向きは、必ずしも一致しなくてよい、という切り分けです。

## CSSのrotateでは、絵がマスに収まらない

回転した絵の描画は、最初は `transform: rotate(90deg)` で済ませようとしました。うまくいきませんでした。

`<img>` の枠は形の外接矩形に合わせてあります。`long4` を縦に立てると枠は1マス幅×4マス高になりますが、元のPNGは4マス幅×1マス高の横長です。`object-fit: contain` は横長の絵を縦長の枠に収めようとするので、絵は枠の幅に合わせて極端に小さくなります。そこへ `rotate` をかけても、小さいまま縦になるだけです。

CSSの `rotate` はピクセルを回しますが、レイアウトの箱は回してくれません。そこで、**回転を画像そのものに焼き込む**ことにしました。

```js
function catSprite(item, rotation) {
  const pose = poseFor(item, rotation);
  const cacheKey = `${pose.name}:${pose.turns}`;
  if (poseSprites.has(cacheKey)) return poseSprites.get(cacheKey);
  const source = poseImages.get(pose.name);
  if (!source) return "";
  const turns = pose.turns;
  const canvas = document.createElement("canvas");
  canvas.width = turns % 2 ? source.height : source.width;
  canvas.height = turns % 2 ? source.width : source.height;
  const context = canvas.getContext("2d");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  const url = canvas.toDataURL("image/png");
  poseSprites.set(cacheKey, url);
  return url;
}
```

肝は `turns % 2` でCanvasの縦横を入れ替えているところです。奇数回の回転では出力の幅が元の高さになるので、できあがったPNG自体が縦長になり、`contain` がそのまま枠を埋めます。作った画像は `pose:turns` をキーに `Map` へ入れるので、同じ猫がトレイと箱の中に同時に出ていても `toDataURL` は1回だけです。

`catSprite` は、元の画像が読み込み済みでなければ空文字を返します。`prepareArt()` は非同期なので、起動直後の `loadLevel(0)` はまだ絵のない状態で走ります。最初はここで `<img>` を出さない実装にしていて、回線が細い端末では合計11MBのPNGが揃うまでトレイが空の四角に見えていました。

```js
const sprite = catSprite(item, rotation);
const src = sprite || CAT_ASSETS[pose.name];
const fallbackRotation =
  !sprite && pose.turns
    ? ` style="transform:rotate(${pose.turns * 90}deg)"`
    : "";
```

さきほど「収まらない」と書いた方法を、あえて仮の姿として使っています。縦長の枠に横長の絵が小さく入る状態にはなりますが、猫がいることは伝わります。スプライトが焼き上がると `renderTray()` が走って、正しい大きさに差し替わります。トレイは選ぶための場所なので、完成形を待つより、崩れた形でも先に見せるほうを選びました。

## 生成画像の半透明の縁を落として、余白を切りそろえる

猫の絵は画像生成で用意しました。背景は透過で書き出しているのですが、そのまま貼ると2つ困ることがありました。

1つは、輪郭のまわりに薄い半透明のピクセルが残ることです。白い紙の上では気づきませんが、段ボール色の箱に置くと猫の周りが白く霞みます。もう1つは、余白の量が絵ごとに違うことです。同じ2マス分の猫でも、余白の多い絵は小さく見えます。マスに詰めるゲームなので、大きさが揃っていないと「ぴたっと入った」感じになりません。

そこで、読み込んだ画像を一度Canvasへ通して、透明度を整えてから切り抜くことにしました。

```js
const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
const { data } = imageData;
let minX = canvas.width,
  minY = canvas.height,
  maxX = 0,
  maxY = 0;

for (let y = 0; y < canvas.height; y += 1)
  for (let x = 0; x < canvas.width; x += 1) {
    const offset = (y * canvas.width + x) * 4;
    const alpha = data[offset + 3];
    if (alpha < 172) data[offset + 3] = 0;
    else data[offset + 3] = Math.min(255, Math.round((alpha - 172) * 3.1));
    if (data[offset + 3] > 20) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
// ...putImageData して、求めた範囲で切り抜く
```

透明度172を境にして、それより薄いピクセルは完全に透明へ落とします。残ったほうは `(alpha - 172) * 3.1` で引き伸ばし、172〜255の範囲を0〜255へ広げ直します。単純に閾値で切るだけでは輪郭がぎざぎざになりますが、境界の上側を引き伸ばして戻しているので、霞は消えたまま縁のなめらかさは残ります。

同じループの中で、透明でないピクセルの範囲も測っています。これが猫の実際の輪郭なので、その範囲に少しだけ余白を足して切り抜きます。

```js
const pad = Math.round(Math.min(canvas.width, canvas.height) * 0.035);
```

余白を短辺の3.5%にしているのは、影の一番外側が切れないようにするためです。12枚それぞれの元の余白がどうであれ、切り抜いたあとは猫が枠いっぱいに入った状態に揃います。`getImageData` を呼ぶので、コンテキストは `willReadFrequently: true` で取っています。

## 盤面のリサイズはCSSに任せる

盤面は、ステージごとに縦横のマス数が変わります。マスの大きさを毎回JavaScriptで計算し直しても動きますが、そうすると `resize` を監視することになります。代わりに、マス数をCSS変数として渡しました。

```js
el.board.style.setProperty("--cols", level.cols);
el.board.style.setProperty("--rows", level.rows);
```

```css
.board {
  width: min(100%, 570px);
  aspect-ratio: var(--cols) / var(--rows);
}
.target-grid,
.placed-layer,
.placement-preview {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  grid-template-rows: repeat(var(--rows), 1fr);
}
```

`aspect-ratio` にマス数の比を入れているので、幅が決まれば高さが決まり、マスは常に正方形になります。マスを敷く3枚のレイヤーも同じ変数を使うので、盤面と目盛りがずれません。箱に置いた猫も、ピクセルではなく百分率で絶対配置しています。

```js
node.style.left = `${(placement.x / level.cols) * 100}%`;
node.style.width = `${(size.w / level.cols) * 100}%`;
```

逆向きの変換、つまり画面の座標からマスの番号を出す処理だけは、その場で測ります。

```js
function boardCellFromPoint(clientX, clientY) {
  const rect = el.board.getBoundingClientRect();
  const level = LEVELS[levelIndex];
  return {
    x: Math.floor(((clientX - rect.left) / rect.width) * level.cols),
    y: Math.floor(((clientY - rect.top) / rect.height) * level.rows),
  };
}
```

イベントが起きた瞬間に `getBoundingClientRect()` を読むので、ウィンドウを引き伸ばしている最中でも、指を置いた場所のマスが返ります。結果として、このゲームには `resize` のリスナーが1つもありません。

## 置いた猫のボタンは、猫のいないマスも覆っている

箱に入れた猫は、押すとトレイへ戻ります。この戻す操作で、原因の分かりにくい誤操作が出ました。猫を選んで箱の空きマスを押したのに、**別の猫が箱から出てくる**ことがあるのです。

理由は、置いた猫が外接矩形の `<button>` になっているからでした。「すみっこ」の `ell4` は2マス幅×3マス高の矩形に4マスぶんしか入っていません。残る2マスは絵も入っていない空きマスですが、ボタンの当たり判定には入っています。

矩形を猫の形に切り抜く手もありますが、押した場所がどのマスかは `boardCellFromPoint` で分かります。そこで、押されたマスがその猫自身のマスかどうかで分岐しました。

```js
node.addEventListener("click", (event) => {
  const cell = boardCellFromPoint(event.clientX, event.clientY);
  const ownCells = new Set(
    cells.map(([dx, dy]) => key(placement.x + dx, placement.y + dy)),
  );
  if (selectedId && !ownCells.has(key(cell.x, cell.y)))
    placeSelected(cell.x, cell.y);
  else returnPiece(id);
});
```

猫を選んでいて、かつ押したマスがこの猫のマスでないなら置く操作、それ以外は戻す操作です。ボタンの形は矩形のまま、判定だけをマス単位にしました。

レイヤーの重なりも整理が必要でした。置いた猫を載せる層は盤面全体を覆っているので、そのままだと下の盤面が押せません。

```css
.placed-layer {
  pointer-events: none;
}
.placed-piece {
  pointer-events: auto;
}
.jelly-cat {
  pointer-events: none;
}
```

層は素通り、猫のボタンだけ反応、絵は素通り、という3段です。絵を素通りにしているのは、`event.target` を常にボタンにして `closest()` の判定を単純にするためです。

## タップと持ち上げを7pxで見分ける

猫を箱へ入れる方法は2つあります。押して選んでから箱のマスを押す方法と、箱までドラッグする方法です。同じカードで両方を受けるので、押しただけなのか持ち上げたのかを見分ける必要があります。指はタップでも数ピクセル動くため、`pointermove` が来た時点でドラッグと決めるわけにはいきません。

```js
function onDragMove(event) {
  if (!drag) return;
  if (
    !drag.moved &&
    Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7
  )
    return;
  drag.moved = true;
  if (selectedId !== drag.id) selectPiece(drag.id);
  if (!drag.ghost) {
    drag.ghost = document.createElement("div");
    drag.ghost.className = "drag-ghost";
    drag.ghost.innerHTML = pieceMarkup(drag.item, rotations.get(drag.id) || 0);
    document.body.append(drag.ghost);
  }
  // ...ghost を指の位置へ動かし、盤面の上ならプレビューを出す
}
```

しきい値を超えるまで `moved` は立たず、指に付いてくる猫（`drag-ghost`）も作りません。タップで終わった操作では、DOMが1つも増えません。`pointerup` は `{ once: true }` で登録し、`onDragEnd` の先頭で `pointermove` を外すので、どこで指を離してもリスナーが残りません。

スマートフォンでは、これに `touch-action` を足す必要があります。

```css
.cat-card {
  touch-action: none;
}
.board {
  touch-action: none;
}
```

これを書かないと、カードを縦に引っぱった時点でブラウザがページのスクロールと解釈し、`pointermove` が来なくなります。猫を持ち上げようとするとページが動く、という状態でした。

## ヒントは、解答をそのまま見せるだけでいい

ヒント機能は、盤面を解答から作った副産物です。ソルバーは要りません。答えは最初からデータに入っています。

```js
function giveHint() {
  const item = LEVELS[levelIndex].pieces.find(
    (entry) => !placements.has(entry.id),
  );
  if (!item) return;
  selectedId = item.id;
  rotations.set(item.id, item.solution.rotation);
  renderTray();
  updateSelected();
  showPreview(item.solution.x, item.solution.y);
  // ...盤面を光らせて、1900msでプレビューを消す
}
```

まだ置いていない猫を1匹選び、その猫の向きを解答の向きに合わせてから、解答の位置にプレビューを出します。向きまで合わせているので、ヒントを見たあとはそのままマスを押せば入ります。

ただし、これは作った側が想定した並べ方です。別の並べ方で埋めている途中だと、ヒントの位置がすでに埋まっていることがあります。プレビューは置けるかどうかを毎回 `canPlace` で見ているので、そのときは枠が赤くなり、「ここが正解だが、いまは置けない」が伝わります。

## 「猫は液体」を、つぶれる動きで見せる

このゲームの題は「猫は液体」です。マスにはまった瞬間に、それが伝わってほしいところでした。

```css
.jelly-cat {
  transform-origin: 50% 76%;
}
.placed-piece.is-squishing .jelly-cat {
  animation: cat-squish 0.62s cubic-bezier(0.18, 0.86, 0.23, 1.32);
}
@keyframes cat-squish {
  0% {
    transform: scale(0.68, 1.25);
    opacity: 0.42;
    filter: saturate(1.25) blur(2px) drop-shadow(...);
  }
  42% {
    transform: scale(1.12, 0.88);
  }
  68% {
    transform: scale(0.96, 1.06);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

細く縦に伸びてぼやけた状態から始めて、横につぶれ、少し戻りすぎて収まります。`transform-origin` を下寄りの76%にしているのは、上端ではなく箱の底に着地するように見せるためです。イージングの最後の値が1を超えているので、収まる直前にわずかに跳ねます。

このクラスは、あとから付けるのではなく**生成時に焼き込んでいます**。

```js
function renderPlaced(squishId = null) {
  el.placedLayer.replaceChildren();
  placements.forEach((placement, id) => {
    const node = document.createElement("button");
    node.className = `placed-piece${id === squishId ? " is-squishing" : ""}`;
    // ...
  });
}
```

`renderPlaced` は毎回 `replaceChildren()` で層を作り直します。要素そのものが新しいので、クラスが最初から付いていればアニメーションは必ず再生され、同じ要素にクラスを付け直すときの一手間が要りません。

一方、盤面の光り方（`hint-flash`）は要素が作り直されないので、そちらでは必要です。

```js
el.board.classList.remove("hint-flash");
void el.board.offsetWidth;
el.board.classList.add("hint-flash");
```

`void el.board.offsetWidth` を挟まないと、外して付け直す操作がまとめて処理され、2回目以降のヒントで光らなくなります。要素を作り直しているかどうかで、書き方が変わる部分です。

## まとめ

ネコリスで効果があったのは、次の6点でした。

- 盤面を先に描かず、解答の和集合として作る。解けることとヒントが同時に手に入る
- 形は座標の配列で持ち、回転のたびに原点へ寄せ直して、位置の意味を1つにする
- 回転はCSSではなくCanvasへ焼き込み、`pose:turns` をキーにキャッシュする
- 生成した絵は、閾値と自動トリミングで揃えてから使う
- 盤面の寸法はCSS変数と `aspect-ratio` に預けて、JavaScriptからリサイズを見ない
- 矩形のボタンの中でも、当たり判定はマス単位で決める

一番効いたのは、やはり最初の1点でした。「解ける盤面を探す」から「解答から盤面を作る」へ順番を変えただけで、ステージ作りが探索から並べ替えに変わり、ヒントまで無料で付いてきました。パズルの難しさは遊ぶ人が引き受けるもので、作る側が引き受けるものではない、という切り分けだったのだと思います。
