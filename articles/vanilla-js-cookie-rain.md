---
title: "Cookie同意UIを文字どおりに受け取って、クッキーが降るサイトをVanilla JSで作った"
emoji: "🍪"
type: "tech"
topics: ["javascript", "html", "css", "webapi", "個人開発"]
published: false
---

Webサイトを開くと、よく「すべてのCookieを受け入れますか？」と聞かれます。

そこで、受け入れたら本当にクッキーが降ってくるサイトを作りました。

https://asobi-cookiee.vercel.app/

![たくさんのクッキーと、喜ぶ猫・犬・レッサーパンダ](https://asobi-cookiee.vercel.app/og-image.png?v=2)

「すべて受け入れる」を押すと、画面の上から58枚のクッキーが降り、下から猫、犬、レッサーパンダが喜びながら出てきます。「ひとつだけにする」を押すと、本当に1枚だけ降ります。

構成はHTML、CSS、Vanilla JavaScriptだけです。小さな一発ネタですが、作ってみると次のような論点がありました。

- 1枚の画像から、毎回違うクッキーの雨を作る
- 大量の要素を一度に追加して、アニメーション後に片付ける
- クッキーと動物の登場タイミングを合わせる
- 動きを減らす設定でも、結果が分かるようにする
- 画面が派手に動いていても、フォーカスと読み上げを置き去りにしない

この記事では、特に実装で考えた部分を紹介します。

## 「同意」を、結果が起きるボタンにする

画面はCookieバナーに見えますが、実際のCookieは保存しません。最初の2つのボタンは、そのまま演出の分岐になっています。

```js
elements.acceptButton.addEventListener("click", () => showResult("all"));
elements.singleButton.addEventListener("click", () => showResult("single"));
```

結果の違いは、主に降らせる枚数です。

```js
if (acceptedAll) {
  showerCookies(prefersReducedMotion.matches ? 7 : 58);
} else {
  showerCookies(1);
}
```

「ひとつだけ」という選択肢を、断るボタンにはしませんでした。拒否と受け入れの対立にするより、**どちらを押しても小さなオチがある**ほうが、このサイトの空気に合うためです。

文章も分岐させています。「すべて」なら「みんなで、たっぷりお届けします」、「ひとつ」なら「3匹で、大切に見守ります」。枚数だけでなく、結果画面の言葉まで選択に反応させると、押した手応えが残ります。

## JavaScriptは値を決め、CSSに降らせてもらう

クッキーはCanvasではなく、透過PNGを`img`要素として追加しています。

```js
function makeCookie(index, total, isSingle = false) {
  const cookie = document.createElement("img");
  const size = isSingle ? 112 : randomBetween(44, 104);
  const spread = isSingle ? 0 : randomBetween(-95, 95);
  const rotation = randomBetween(-70, 70);

  cookie.src = "./assets/cookie.png";
  cookie.alt = "";
  cookie.className = "falling-cookie";
  cookie.style.setProperty("--x", `${randomBetween(-4, 96)}vw`);
  cookie.style.setProperty("--size", `${size}px`);
  cookie.style.setProperty("--delay", `${randomBetween(0, 1.05)}s`);
  cookie.style.setProperty("--duration", `${randomBetween(1.9, 3.65)}s`);
  cookie.style.setProperty("--drift", `${spread}px`);
  cookie.style.setProperty("--rotation", `${rotation}deg`);
  cookie.style.setProperty("--spin", `${rotation + randomBetween(260, 820)}deg`);

  return cookie;
}
```

JavaScriptで決めているのは、開始位置、大きさ、遅延、落下時間、横への流れ、回転量です。実際に落とす処理はCSSに任せています。

```css
.falling-cookie {
  position: absolute;
  top: -160px;
  left: var(--x);
  width: var(--size);
  opacity: 0;
  animation:
    cookie-fall var(--duration)
    cubic-bezier(0.28, 0.52, 0.48, 0.96)
    var(--delay) forwards;
}

@keyframes cookie-fall {
  0% {
    opacity: 0;
    transform: translate3d(0, -10vh, 0) rotate(var(--rotation));
  }
  8% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform:
      translate3d(var(--drift), calc(100vh + 300px), 0)
      rotate(var(--spin));
  }
}
```

この分担にすると、ランダム性はJavaScriptで作りつつ、ブラウザが得意な`transform`のアニメーションを使えます。動きの調整も、JavaScriptのループではなくCSSのイージングを触るだけです。

クッキーは1枚ずつDOMへ追加せず、`DocumentFragment`へまとめてから一度に挿入します。

```js
function showerCookies(amount) {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < amount; index += 1) {
    fragment.append(makeCookie(index, amount, amount === 1));
  }

  elements.cookieLayer.append(fragment);
}
```

アニメーションが終わった要素は残しません。

```js
cookie.addEventListener(
  "animationend",
  () => cookie.remove(),
  { once: true }
);
```

58枚程度ならDOMでも十分扱えます。ただし、押すたびに要素を残すとリプレイするほど増えていきます。**生成と削除を同じ関数の中でセットにする**のが大事でした。

## 3匹は「全身を見せない」ほうが飛び出して見える

クッキーと同時に出てくるのは、少しぽっちゃりした猫、犬、レッサーパンダです。3匹を別々に動かすのではなく、透過背景の1枚の画像としてまとめました。

```css
.animal-celebration {
  position: fixed;
  bottom: -64px;
  left: 50%;
  width: min(760px, 96vw);
  transform: translate3d(-50%, 112%, 0) scale(0.92);
  visibility: hidden;
}

.animal-celebration.is-cheering {
  visibility: visible;
  animation: animals-pop 3.1s cubic-bezier(0.2, 0.86, 0.32, 1) both;
}
```

ポイントは`bottom: -64px`です。足を少し画面外へ隠すことで、完成した立ち絵を置くのではなく、**本当に下から顔を出しているように見せています**。

外側の要素で登場と退場を動かし、内側の画像には小さな上下運動を付けました。

```css
.animal-celebration.is-cheering img {
  animation: happy-bounce 430ms ease-in-out 420ms 4 alternate;
}

@keyframes happy-bounce {
  from { transform: translateY(0) rotate(-0.7deg); }
  to { transform: translateY(-13px) rotate(0.7deg); }
}
```

登場と喜びを1本のアニメーションに詰め込むより、親と子へ分けるほうが調整しやすくなります。

## 派手な演出ほど、動きを減らす設定が必要になる

`prefers-reduced-motion`が有効なときは、通常の落下をやめています。

```js
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

if (prefersReducedMotion.matches) {
  cookie.classList.add("is-static");
  cookie.style.setProperty("--bottom", `${randomBetween(2, 12)}vh`);
}
```

完全に何も表示しないのではなく、クッキーが画面下へ短く現れる状態にしました。また、「すべて」を選んだ場合も58枚から7枚へ減らします。

このサイトの結果は「何枚降ったか」によって伝わるので、アニメーションを止めるだけでは意味まで消えてしまいます。**動きを減らしながら、結果の差は残す**ようにしています。

画面を見ていない人には、`aria-live`で結果を文章として伝えます。

```js
elements.announcement.textContent =
  "すべて受け入れました。3匹の動物が喜び、" +
  "たくさんのクッキーが降っています。";
```

演出後は次に操作できるボタンへフォーカスを移し、キーボード操作でも迷わず進めるようにしました。

## それでもAstroにしなかった理由

記事の題材を増やすためにAstroへ移行する案も考えましたが、今回はVanilla JavaScriptのままにしました。

このサイトは、次の条件に当てはまります。

- 1ページで完結する
- 記事や商品など、繰り返し生成するページがない
- 共通レイアウトを使う別ページがない
- サーバー側の処理やデータ取得がない
- 依存パッケージがなく、静的ファイルをそのまま配信できる

この状態でAstroへ移すと、コンポーネント分割より先にビルド設定と依存関係が増えます。今回の面白さはフレームワークの構成ではなく、クッキーの雨と動物の登場演出にあります。

一方、`asobi`の作品一覧、共通ヘッダー、作品データ、制作記事まで同じサイト内で管理するならAstro化する価値が出ます。その段階なら、次のように役割を分けられます。

- 共通レイアウトとメタ情報を`Layout.astro`へまとめる
- 作品カードをコンポーネント化する
- 作品情報をContent Collectionsで管理する
- クッキーの演出だけをクライアント側のJavaScriptとして残す

**小さいからフレームワークを使わないのではなく、繰り返しや境界がまだ生まれていないから使わない**、という判断です。

## 小さな一発ネタにも、実装の判断は詰まっている

クッキーが降るだけのサイトでも、実際にはDOM生成、CSSアニメーション、画像アセット、レスポンシブ対応、アクセシビリティまで触ることになりました。

特に大事だったのは、JavaScriptですべてを動かそうとしなかったことです。JavaScriptはクッキーごとのランダムな値と画面の状態を決め、実際の動きはCSSへ渡す。動物は3匹を1枚にまとめ、登場と喜びの動きだけを親子の要素へ分ける。役割を小さく分けることで、演出の調整がしやすくなりました。

そして、動きを減らす設定では演出を消すのではなく、結果の意味が残る別の見せ方に切り替えました。派手さを足すことと、誰でも結果を受け取れることは両立できます。

一発ネタは短く遊べますが、作る側にとっては案外、学べる場所の多い題材でした。

## あわせて読みたい

同じ`asobi`シリーズで、Vanilla JavaScriptを使って作った小さなゲームやツールの制作記です。

- [「解ける盤面」を探すのをやめる。Vanilla JSで猫を箱に詰めるパズルを作る](https://zenn.dev/devnekoo/articles/681623976973bc) — ランダム生成ではなく、完成形から逆算して必ず解ける盤面を作った話です。

- [「shi」でも「si」でも正解にする。Vanilla JSでタイピングゲームの入力判定を作る](https://zenn.dev/devnekoo/articles/2f14a7d02f0378) — 正解文字列を1本に決めず、入力途中の候補を残しながら判定する方法を紹介しています。

- [カップ麺を待つ3分をモグラ叩きにした。Vanilla JSで2つの時間を扱う](https://zenn.dev/devnekoo/articles/6dd5c0bd51ee21) — ゲームの残り時間とカップ麺の待ち時間を、別々の時計として扱った話です。

- [退勤ボタンを「押すだけ」で終わらせず、タイムカード画像まで作った](https://zenn.dev/devnekoo/articles/f8339aadeadd02) — 1日1回だけ押せるボタンを、記録・演出・画像生成まで育てた制作記です。

[ほかの記事も見る](https://zenn.dev/devnekoo)
