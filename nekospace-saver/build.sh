#!/bin/bash
# NekoSpace.saver をビルドする。Xcode本体は不要(コマンドラインツールだけで通る)。
#   ./build.sh            → build/NekoSpace.saver ができる
#   ./build.sh --debug    → 画面の隅に状態(描画が回っているか等)を出す診断用ビルド
# 署名はアドホック署名のみ(自分のMacで動かす用)。配布用の署名・公証は README を参照。
set -euo pipefail
cd "$(dirname "$0")"

# macOS標準の bash 3.2 では、空配列の展開が set -u で落ちるので、下では ${SWIFT_FLAGS[@]+...} の形で使う
SWIFT_FLAGS=()
if [ "${1:-}" = "--debug" ]; then
  SWIFT_FLAGS+=(-D NEKOSPACE_DEBUG)
  echo "(診断用ビルド: 画面の隅に状態を表示します)"
fi

# xcrun を経由しない直接パス(サンドボックス内でも動く)
TOOLCHAIN=/Library/Developer/CommandLineTools
SWIFTC="$TOOLCHAIN/usr/bin/swiftc"
LIPO="$TOOLCHAIN/usr/bin/lipo"
SDK="$TOOLCHAIN/SDKs/MacOSX.sdk"

OUT=build
BUNDLE="$OUT/NekoSpace.saver"
CACHE="${TMPDIR:-/tmp}/nekospace-saver-modulecache"

rm -rf "$OUT"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources" "$OUT/obj" "$CACHE"

# どのビルドが動いているか画面/ログで分かるように、ビルド時刻を埋め込む
# (古いビルドを読み込んだままのプロセスが残る事故の見分け用)
cat > "$OUT/BuildInfo.swift" <<SWIFT
enum BuildInfo { static let stamp = "$(date '+%m/%d %H:%M:%S')" }
SWIFT

for arch in arm64 x86_64; do
  echo "==> swiftc ($arch)"
  "$SWIFTC" -O -module-name NekoSpace -emit-library -Xlinker -bundle \
    -target "$arch-apple-macos13.0" -sdk "$SDK" -module-cache-path "$CACHE" \
    -framework ScreenSaver -framework WebKit -framework AppKit \
    ${SWIFT_FLAGS[@]+"${SWIFT_FLAGS[@]}"} \
    -o "$OUT/obj/NekoSpace-$arch" NekoSpaceView.swift "$OUT/BuildInfo.swift"
done

echo "==> lipo (universal)"
"$LIPO" -create "$OUT/obj/NekoSpace-arm64" "$OUT/obj/NekoSpace-x86_64" \
  -output "$BUNDLE/Contents/MacOS/NekoSpace"

cp Info.plist "$BUNDLE/Contents/Info.plist"

# サイト本体を同梱する(セーバーはオフラインで完結させる)。
# 必要なのは表示に使うファイルだけ。blender/ や OGP画像、READMEは入れない。
SITE=../nekospace
DEST="$BUNDLE/Contents/Resources/site"
mkdir -p "$DEST"
cp "$SITE/index.html" "$SITE/script.js" "$SITE/styles.css" "$DEST/"
cp -R "$SITE/assets" "$DEST/assets"
find "$DEST" -name .DS_Store -delete
# 外部(Google Fonts)への参照は同梱版から外す。セーバー表示ではUIを隠すのでフォントは使わない。
sed -i '' '/fonts\.googleapis\.com/d; /fonts\.gstatic\.com/d' "$DEST/index.html"

# システム設定の一覧に出るサムネイル(サイトのOGP画像を縮小したもの。
# 作り直すときは: sips -Z 360 ../nekospace/og-image.png --out thumbnail.png)
cp thumbnail.png "$BUNDLE/Contents/Resources/thumbnail.png"

echo "==> codesign (ad-hoc)"
codesign --force --sign - "$BUNDLE"

rm -rf "$OUT/obj"
echo "==> done: $BUNDLE"
