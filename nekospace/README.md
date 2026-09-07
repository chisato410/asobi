# ネコスペース

宇宙空間をふわふわ漂う、まるっとした猫たちで遊ぶだけのサイトです。Three.js で描画し、猫モデルは Blender の Python スクリプトで生成しています。

## 操作

- タップ / クリック: 猫を軽くつついて弾き飛ばす
- 長押し: 猫を捕まえてくるくる遊ばせる
- ドラッグ: 掴んだまま動かし、離すと勢いよく放り投げる
- ホバー: カーソルを近づけると気づいてリアクションする

## 猫モデルについて

`assets/models/cats.glb` が読み込めない場合は、`script.js` 内のプロシージャル生成（Three.js のジオメトリのみで組み立てたフォールバック猫）が自動的に使われます。

現在の `cats.glb` は、支給された `Cat.obj`(+`Cat.mtl`)を `blender/import_custom_cat.py` で取り込んだもの(黒猫・白/ピンクのアクセント、1種類)。再取り込みする場合:

```bash
blender --background --python blender/import_custom_cat.py
```

スクリプト内の `OBJ_PATH` / `KEEP_NAME` を実際のファイルパスとオブジェクト名に合わせて書き換えてから実行してください。

以前の自作ローポリ猫(4色・タブ柄)を作るスクリプトは `blender/build_cats.py` に残してあります:

```bash
blender --background --python blender/build_cats.py
```

`nekospace/assets/models/cats.glb` に書き出されます。出力先を変えたい場合は末尾に `-- /path/to/out.glb` を付けてください。

## 技術メモ

- 依存ライブラリは `assets/vendor/` にローカル配置（three.module.js / GLTFLoader.js）。ビルド不要、`index.html` を開くかそのまま静的ホスティングするだけ。
- 当たり判定はスクリーン座標への射影距離で判定（ジオメトリの複雑さに影響されない軽量な方式）。
