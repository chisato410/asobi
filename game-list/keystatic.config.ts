import { config, fields, collection } from '@keystatic/core';

// Keystatic の管理画面(/keystatic)の設定。
// ここで定義したフォームで入力した内容が、そのまま
// src/content/games/*.md に書き込まれる(Content Collections と同じ場所・同じ形)。
//
// storage.kind: 'local' は「自分のPCで `npm run dev` しているときだけ
// 保存できる」モード。ファイルはこのリポジトリの中に直接書き込まれるので、
// あとは普段どおり git commit / push すれば公開サイトにも反映される。
// (デプロイ後の本番サイト上で直接編集したくなったら、GitHub 連携の
// storage に切り替える方法もあるので、必要になったら相談してください)
export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    games: collection({
      label: 'ゲーム',
      slugField: 'title',
      path: 'src/content/games/*',
      format: { contentField: 'body' },
      entryLayout: 'form',
      schema: {
        title: fields.slug({
          name: {
            label: 'タイトル',
            validation: { isRequired: true },
          },
        }),
        description: fields.text({
          label: '一覧カードの説明(一行〜二行)',
          multiline: true,
          validation: { isRequired: true },
        }),
        tag: fields.text({
          label: '操作方法(例: クリック／ドラッグ)',
          validation: { isRequired: true },
        }),
        accentColor: fields.select({
          label: 'アクセントカラー',
          options: [
            { label: 'オレンジ', value: 'orange' },
            { label: 'テラコッタ', value: 'terracotta' },
            { label: 'コーラルピンク', value: 'coral' },
            { label: 'ブラウン', value: 'brown' },
            { label: 'セージグリーン', value: 'sage' },
          ],
          defaultValue: 'orange',
        }),
        playUrl: fields.url({
          label: '遊べるページの URL',
          validation: { isRequired: true },
        }),
        thumbnail: fields.image({
          label: 'サムネイル画像(任意)',
          directory: 'public/images/games',
          publicPath: '/images/games/',
        }),
        order: fields.integer({
          label: '並び順(小さいほど先頭)',
          defaultValue: 999,
        }),
        body: fields.markdoc({
          label: 'メモ(一覧には表示されません、任意)',
        }),
      },
    }),
  },
});
