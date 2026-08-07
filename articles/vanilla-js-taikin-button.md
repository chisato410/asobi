---
title: "退勤ボタンを『押すだけ』で終わらせず、タイムカード画像まで作った"
emoji: "🕔"
type: "tech"
topics: ["javascript", "html", "css", "canvas"]
published: false
---

仕事を終えたとき、勤怠システムとは別に「今日はもう終わり」と区切りをつけられるものが欲しくなりました。

そこで作ったのが、**1日1回だけ押せる退勤ボタン**です。

https://asobi-seven.vercel.app

![退勤前の画面。大きな退勤ボタンと卓上タイムレコーダーを並べたUI](/images/taikin/taikin-before.jpg)

押しても実際の勤怠には連携されません。ただ、ボタンが沈み、打刻音が鳴り、タイムカードに退勤時刻と肉球のハンコが押されます。

最初は本当に「ボタンを押すだけ」の小さなサイトでした。そこからデザインを見直し、退勤後のコメントを増やし、最後にはその日のタイムカードを画像にしてXへ共有できるところまで作りました。

この記事では、HTML・CSS・Vanilla JavaScriptだけで作った退勤ボタンと、実装中に意外と苦労した「画像付き共有」について紹介します。

## 今回作ったもの

現在の退勤ボタンには、次の機能があります。

- 退勤ボタンは1日1回だけ押せる
- リロードしても退勤時刻とメッセージが残る
- 押すと打刻音とアニメーションが再生される
- 20種類の退勤メッセージから1つが表示される
- タイムカードに肉球の「退勤済」ハンコが押される
- 退勤時刻入りの画像をその場で生成できる
- スマホでは共有画面、PCでは画像コピー後にXを開く

フレームワークもバックエンドも使っていません。構成はHTML、CSS、JavaScript、`localStorage`、Canvas API、Web Share APIです。

## デザインを「画面」ではなく「退勤の道具」から考える

以前のUIは、要素をカードに分けた一般的なWebアプリ風の見た目でした。機能は伝わるものの、「退勤するためだけのボタン」としては少し整いすぎていました。

そこで、画面全体を**卓上のタイムレコーダー**として組み直しました。

- 現在時刻を表示する暗い窓
- 機械に差し込まれた紙のタイムカード
- しっかり押し込めそうな大きいボタン
- 少しくすんだ水色、クリーム色、朱色
- 打刻を見守る猫

猫は背景画像として大きく見せるのではなく、タイムレコーダーの横から顔を出すように配置しました。飾りを置くというより、退勤を見届ける係にしています。

PCとスマホでは余白の使い方が大きく変わるため、猫のサイズと位置は画面幅ごとに調整しました。特にスマホでは、小さく隅に置くよりも、退勤ボタンの右下に少し大きく見えるバランスにしています。

## 退勤後のひと言を20種類に増やす

毎日同じ文章が出ると、数回で結果を見なくなってしまいます。そこで、退勤時のコメントを20種類用意し、押した瞬間にランダムで1つ選ぶようにしました。

```js
const CLOCK_OUT_MESSAGES = [
  "今日のあなたは、もう自由です。",
  "本日のタスク、ここで閉店です。",
  "PCより先に、心をスリープさせましょう。",
  "続きは明日の自分に任せます。",
  // ...全20種類
];

const message = CLOCK_OUT_MESSAGES[
  Math.floor(Math.random() * CLOCK_OUT_MESSAGES.length)
];
```

ここで大事なのは、時刻だけでなく**選ばれたメッセージも保存すること**でした。

```js
const record = {
  date: dateKey(now),
  timestamp: now.toISOString(),
  message,
};

localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
```

メッセージを保存しないと、リロードするたびに表示内容が変わり、共有画像にも別の文章が入ってしまいます。その日に出たひと言を退勤記録の一部として扱うことで、画面と共有画像を一致させました。

## 肉球を「飾り」ではなくハンコにする

猫らしさは欲しいものの、猫の画像を画面中に増やしたいわけではありませんでした。

そこで、猫要素の一部を肉球のハンコとして機能に組み込みました。退勤すると、カードの退勤欄に時刻が入り、その横に肉球付きの「退勤済」印が押されます。

![退勤後の画面。タイムカードに退勤時刻と肉球のハンコが入り、結果と共有ボタンが表示される](/images/taikin/taikin-after.jpg)

画面上の肉球はCSSで作っています。

```css
.stamp-paw::before {
  border-radius: 55% 55% 48% 48%;
  background: currentColor;
}

.stamp-paw::after {
  border-radius: 50%;
  background: currentColor;
  box-shadow:
    5px -5px 0 currentColor,
    11px -5px 0 currentColor,
    16px 0 0 currentColor;
}
```

1つの大きな肉球と4つの指を、疑似要素と`box-shadow`で描いています。画像を使わないので色や大きさを調整しやすく、ハンコが押されるアニメーションにもそのまま使えます。

## 共有画像をCanvasでその場で作る

退勤結果をXで共有するとき、最初は文章とサイトURLだけを渡していました。しかし、このゲームで見せたいのはリンク先よりも「何時に退勤したかが刻まれたカード」です。

OGPのサムネイルを固定で表示する案もありましたが、それでは時刻やその日のメッセージを画像に反映できません。最終的に、共有ボタンを押した時点でCanvasを使ってタイムカード画像を生成する形にしました。

画像サイズは、横長で扱いやすい`1200 × 630`です。

```js
const canvas = document.createElement("canvas");
canvas.width = 1200;
canvas.height = 630;

const context = canvas.getContext("2d");
context.fillStyle = "#d7cdbb";
context.fillRect(0, 0, canvas.width, canvas.height);
```

Canvas上には、次の情報を描画しています。

- 退勤した日付
- 退勤時刻
- その日に選ばれたメッセージ
- 肉球付きの「退勤済」ハンコ

画面のカードと共有画像で印象が変わらないように、色、文字、ハンコの角度まで揃えました。肉球はCanvasの`ellipse()`を組み合わせて描いています。

```js
function drawCanvasPaw(context, centerX, centerY, scale = 1) {
  context.beginPath();
  context.ellipse(
    centerX,
    centerY + 10 * scale,
    19 * scale,
    15 * scale,
    0,
    0,
    Math.PI * 2
  );
  context.fill();

  // 4つの指もellipse()で描画する
}
```

完成したCanvasはPNGへ変換し、共有できる`File`にしています。

```js
const dataUrl = canvas.toDataURL("image/png");
const [, encoded] = dataUrl.split(",");
const bytes = Uint8Array.from(
  window.atob(encoded),
  (character) => character.charCodeAt(0)
);

const file = new File(
  [bytes],
  "taikin-time-card.png",
  { type: "image/png" }
);
```

これなら利用者が画像を一度保存し、投稿画面で選び直す必要はありません。

## Xの投稿画面を開くだけでは画像を添付できない

今回いちばん悩んだのがここでした。

XのWeb Intentへ本文を渡すことは簡単です。

```js
const params = new URLSearchParams({ text });
window.location.assign(
  `https://twitter.com/intent/tweet?${params.toString()}`
);
```

一方、ブラウザで生成した画像ファイルをWeb IntentのURLへ付けることはできません。URLパラメーターだけで、ローカルの画像を投稿欄へ自動添付する仕組みは用意されていないためです。

そこで、スマホとPCで共有方法を分けました。

### スマホ：Web Share APIへ画像ファイルを渡す

スマホでは、端末の共有画面を開き、本文と生成したPNGを一緒に渡します。

```js
const shareData = {
  title: "退勤ボタン",
  text,
  files: [timeCard],
};

if (navigator.share && navigator.canShare?.(shareData)) {
  await navigator.share(shareData);
}
```

共有先にXを選べば、画像付きの投稿を作れます。

### PC：画像をコピーしてからXを開く

PCではClipboard APIを使い、生成した画像をクリップボードへコピーします。その後、Xの投稿画面へ移動します。

```js
const clipboardItem = new ClipboardItem({
  "image/png": timeCard,
});

await navigator.clipboard.write([clipboardItem]);
```

投稿画面が開いたら、利用者が`⌘V`または`Ctrl+V`で貼り付けます。

本当は貼り付けまで自動化したくなりますが、別サイトの入力欄をこちらのJavaScriptから操作することはできません。ブラウザの安全上必要な境界なので、「画像のコピーまでを自動化する」という着地点にしました。

## 「共有がずっと終わらない」「Xが開かない」への対処

実装後、PCでも端末共有を優先してしまい、共有処理が長く待ち続けるケースがありました。また、コピー完了後に別ウィンドウでXを開こうとすると、非同期処理の後なのでポップアップとして遮断されることがありました。

対策は2つです。

1. Web Share APIによるファイル共有はスマホ環境だけで使う
2. Xは新しいウィンドウではなく、現在のタブで開く

```js
function isMobileShareEnvironment() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent)
      && navigator.maxTouchPoints > 1);
}
```

`navigator.share`が存在するかだけで分岐すると、デスクトップ環境でも端末共有へ入ることがあります。今回は、ファイル共有能力の確認に加えて、スマホ・タブレット環境かも確認しました。

また、Xを開く処理は`window.open()`から`window.location.assign()`へ変更しました。

```js
window.location.assign(
  `https://twitter.com/intent/tweet?${params.toString()}`
);
```

同じタブで移動する代わりに、ポップアップブロックの影響を受けず、共有ボタンを押したのに何も起きない状態を避けられます。

共有機能では、APIが存在するかだけでなく、**その端末で最後まで自然に操作できるか**まで含めて分岐を考える必要がありました。

## 1日1回の状態はlocalStorageで管理する

退勤済みかどうかは、利用者のローカル日付から作った`YYYY-MM-DD`形式のキーで判定しています。

```js
function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
```

サーバー保存にするとログインやデータベースが必要になりますが、このサイトで必要なのは「この端末で今日押したか」だけです。

`localStorage`なら、リロードやブラウザの再起動後も記録を残しつつ、静的サイトのまま完結できます。別端末との同期はできませんが、「押すだけ」の軽さを優先しました。

## 小さなサイトほど、体験のつながりが大事だった

今回作ってみて感じたのは、共有機能は最後に足すおまけではないということです。

ボタンを押す、音が鳴る、カードに肉球のハンコが押される、そのカードを持ち帰るように共有する。ここまでがつながると、「退勤ボタン」という小さな遊びにひとつの流れが生まれました。

技術的には、`localStorage`、Canvas API、Clipboard API、Web Share APIというブラウザ標準機能の組み合わせです。大がかりな構成ではありません。それでも、PCとスマホの差、共有先サイトの制約、ポップアップブロックなど、実際に触って初めて見える問題がいくつもありました。

機能を増やすこと以上に、**押した人が気持ちよく仕事を終え、その結果を持って帰れるか**を考えたアップデートになりました。

ソースコードはこちらです。

https://github.com/chisato410/asobi/tree/main/taikin
