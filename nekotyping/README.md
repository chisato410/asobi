# ねこタイプ

猫種、毛柄、猫のからだ・しぐさだけが出てくるPC向けタイピングゲームです。90秒・60秒・30秒の3レベルから選べます。

ローマ字は `shi/si`、`chi/ti`、`ji/zi` など音が同じ入力を受け付けます。長音の「ー」は、省略・ハイフン・母音を重ねる入力に対応しています。

## 起動

静的サイトなので `index.html` を直接開くか、このディレクトリでHTTPサーバーを起動します。

```sh
python3 -m http.server 4173
```

## Wikipedia API

正解した言葉の補足を日本語版WikipediaのMediaWiki Action APIから取得します。`origin=*` を付けた未認証CORSリクエストです。取得できない場合は内蔵の短い説明へフォールバックし、ゲーム自体はオフラインでも動作します。

## 共有とOGP

結果画面から、スコア入り画像またはリンクだけをXへ共有できます。公開URLとOGPは `https://asobi-nekotyping.vercel.app/` を参照します。OGP画像は1200×630pxの `og-image.png` です。
