# asobi ゲーム一覧

「asobi」シリーズのミニゲームをまとめる一覧サイト。Astro + Keystatic で作っています。

## セットアップ

このプロジェクトのフォルダで、初回だけ依存パッケージをインストールします。

```sh
npm install
```

## 開発サーバーを起動する

```sh
npm run dev
```

`http://localhost:4321/` が一覧ページ、`http://localhost:4321/keystatic` が管理画面です。

## ゲームを追加する

1. `npm run dev` を起動した状態で `http://localhost:4321/keystatic` を開く
2. 「ゲーム」コレクションから「Create」を選び、タイトル・説明・操作方法・アクセントカラー・遊べるURL・サムネイル画像を入力して保存する
3. `src/content/games/` の中に Markdown ファイルが自動で作られる(サムネイル画像は `public/images/games/` に保存される)
4. いつも通り `git add` → `git commit` → `push` すれば、一覧ページにも反映される

管理画面を使わず、`src/content/games/` に直接 `.md` ファイルをコピペして書き換える形でも追加できます(既存のファイルが書き方の見本になります)。

## ビルド

```sh
npm run build
npm run preview
```

`dist/` に静的サイトが出力されます。Vercel にデプロイする場合は、このフォルダ(`game-list/`)をプロジェクトルートとして指定してください。
