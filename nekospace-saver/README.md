# ネコスペース スクリーンセーバー

[ネコスペース](https://asobi-nekospace.vercel.app/) の猫たちが、放置中のMacの画面を漂うスクリーンセーバーです。

サイトのファイル(`../nekospace/`)をそのまま `.saver` の中に同梱していて、`WKWebView` で `?saver` モード(UIなし・操作なし・猫が勝手にぶつかり合う)を全画面表示します。

- **ネット接続は要りません**(オフラインで完結)。本番サイトの状態にも左右されません。
- 触れません(マウスやキーに触れるとセーバーが終わります)。
- バッテリー節約のため、描画は約30fpsです。
- サイト側を更新しても、セーバーには自動では反映されません。`./build.sh` で作り直してください。

## ビルド

Xcode本体は不要です(コマンドラインツールだけで通ります)。

```bash
cd nekospace-saver
./build.sh
```

`build/NekoSpace.saver`(約2MB)ができます。arm64 + x86_64 のユニバーサルで、アドホック署名です。

画面の隅に状態(WebKitが「見えている」と判断しているか、描画が毎秒何フレーム回っているか等)を出す**診断用ビルド**も作れます。黒い画面のままのときの原因調べ用です。同じ内容は `NSLog` にも出ます。

```bash
./build.sh --debug
```

## 自分のMacに入れて確認する

```bash
cp -R build/NekoSpace.saver ~/Library/Screen\ Savers/
```

1. 「システム設定 → スクリーンセーバー」を開き、一覧(「その他」の中など)から **NekoSpace** を選びます。
2. 選んだあと、次のコマンドで今すぐ全画面で起動できます。

```bash
open -a ScreenSaverEngine
```

### 確認してほしいこと

- [ ] 一覧にNekoSpaceが出て、サムネイルが付いている
- [ ] 全画面で、猫が星空を漂っている(**黒い画面のまま**になっていないか)
- [ ] 見出しなどのUIが出ていない
- [ ] ときどき猫が別の猫にぶつかって、光って火花が散る
- [ ] マウスを動かす/キーを押すと、すぐ終了する
- [ ] 終了後、Activity Monitorで `legacyScreenSaver` がCPUを使い続けていない
- [ ] (外部ディスプレイがあれば)全画面にそれぞれ表示される

動作がおかしいとき(止まらない・重いなど)は、セーバーを動かす裏のプロセスを強制終了できます。

```bash
killall -9 legacyScreenSaver
```

すでに入れているものを**入れ替える**ときは、古いものを消して入れ直し、**裏のプロセスを必ず終了します**。`legacyScreenSaver` は読み込んだセーバーを覚えたまま動き続けるので、ファイルを入れ替えただけでは**古いビルドのまま動きます**(実際、これで「対策を入れたのに変わらない」という事故が起きました)。

```bash
rm -rf ~/Library/Screen\ Savers/NekoSpace.saver
cp -R build/NekoSpace.saver ~/Library/Screen\ Savers/
killall -9 legacyScreenSaver
pgrep -l legacyScreenSaver || echo "OK: 古いプロセスは残っていません"
```

**通常の `killall legacyScreenSaver`(終了要求)では終わらないことがあります**(システム側が接続を保持していて、終了を保留するため。実際に2回、古いプロセスが生き残りました)。必ず `-9`(強制終了)を付けてください。裏の拡張プロセスなので、必要になればシステムが起動し直します。

診断ビルド(`./build.sh --debug`)なら、画面の左下に `build=月/日 時:分:秒` が出るので、**いまどのビルドが動いているか**が分かります。

消すときは `~/Library/Screen Savers/NekoSpace.saver` を削除してください。

## 黒い画面になる原因と対策(macOS 14.5 で確認)

最初のビルドは、実機で**真っ黒**になりました。ログを調べると、`WebContent` プロセスは起動し、ページの読み込みも完了していましたが、**起動の約0.6秒後にバックグラウンドへ降格**していました。WebKit が、セーバーのウィンドウを「他に隠れている/表示されていない」と判断し、ページを非表示扱いにして `requestAnimationFrame`(描画ループ)を止めるためです。クラッシュでも、ネットワークでも、サンドボックス拒否でもありません。

対策として、`WKWebView` の「ウィンドウの遮蔽判定」を無効にしています(`NekoSpaceView.swift` の `disableOcclusionDetection`)。**非公開API**(`_setWindowOcclusionDetectionEnabled:`)なので、将来のmacOSで効かなくなる可能性があります。存在しない環境では呼ばずにスキップします。

画面外のウィンドウで試した結果は、対策なし=`visibility: hidden`・描画0回、対策あり=`visible`・約30fpsでした。ただし、本物のスクリーンセーバー環境で効くかは、実機で確かめる必要があります。

## 人に配るとき(未実施・要Apple Developerアカウント)

このビルドはアドホック署名なので、**自分のMacでは動きますが、ダウンロードした人のMacでは Gatekeeper に止められます**(「開発元を確認できません」)。ちゃんと配るには、Developer ID での署名と公証が必要です。アカウントや証明書に触れる作業なので、手順だけ書いておきます(まだ実行していません)。

```bash
# 1. Developer ID で署名(証明書名はご自身のものに)
codesign --force --options runtime --timestamp \
  --sign "Developer ID Application: あなたの名前 (TEAMID)" build/NekoSpace.saver

# 2. zip にして公証へ提出(事前に notarytool の認証情報を登録しておく)
ditto -c -k --keepParent build/NekoSpace.saver NekoSpace.zip
xcrun notarytool submit NekoSpace.zip --keychain-profile "プロファイル名" --wait

# 3. 公証結果を貼り付け
xcrun stapler staple build/NekoSpace.saver
```

公証したものを、あらためて zip にして配布します。署名・公証したセーバーが実際に macOS 上で問題なく動くかは、未確認です。

署名せずに試してもらう場合は、受け取った人が次を実行すれば開けます。

```bash
xattr -dr com.apple.quarantine NekoSpace.saver
```

**猫のモデルについて**: 同梱している `cats.glb` は、支給された `Cat.obj` から作ったものです。配る前に、元のモデルの配布条件(再配布やクレジット表記)を確認してください。

## 動作確認の状況

| 確認内容 | 状況 |
|---|---|
| ビルド(arm64 + x86_64)、署名の整合性、Info.plist | 確認済み |
| バンドルを読み込んで `NekoSpaceView` を解決・初期化 | 確認済み |
| 同梱サイトの読み込み(独自スキーム、全ES Modules、`cats.glb`)、JSエラーなし、WebGLコンテキスト生成 | 確認済み(画面外ウィンドウで検証) |
| `startAnimation()` で WebView を作り、`stopAnimation()` で破棄 | 確認済み |
| 実機の `legacyScreenSaver` で、最初のビルドは**真っ黒**だった(原因は上記のページ非表示扱い) | 確認済み(ログで原因を特定) |
| 遮蔽判定を無効にすると、描画ループが回って猫が描かれる(画面外ウィンドウでの検証) | 確認済み(`visible`・約30fps・猫を描画) |
| 対策後に、実機の `legacyScreenSaver` で猫が描画されて動く | **確認済み**(macOS 14.5 / Apple M3、診断ログで `vis=visible`・平均約28fps、約3分半) |
| 複数ディスプレイ | 確認済み(1920×1080 と 1470×956 の2画面がどちらも描画) |
| 実機でのコマ落ち | 約2分13秒後から約1分間、両画面で約1〜2秒の停止と13〜19fpsへの低下を観測。その時間帯はマシン全体が高負荷(Docker の仮想マシン、`kernel_task` が126%など)だったため、システム負荷の可能性が高いが、**原因は特定できていない** |
| 終了後の挙動(マウス/キーで終了、裏のプロセスが居残らない) | マウス/キーでの終了はユーザーが確認。裏の `legacyScreenSaver` は終了後も残るが、CPU上位には出ていない(これは macOS 標準の挙動) |
