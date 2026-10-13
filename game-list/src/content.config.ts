import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ここが「ゲーム一覧」のデータ定義。
// Keystatic の管理画面 (/keystatic) で入力した内容は、この形の
// Markdown ファイルとして src/content/games/ に保存される。
// schema に書いた通りの型でチェックされるので、項目が抜けていたり
// 型が違うファイルがあるとビルド時にエラーで教えてくれる。
const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: z.object({
    // カードに表示するタイトル
    title: z.string(),
    // 一覧カードの一行説明
    description: z.string(),
    // 「操作: ○○」に出す操作方法
    tag: z.string(),
    // カードのアイコン・ボタンに使うアクセントカラー(ブランドカラーから選択)
    accentColor: z.enum(['orange', 'terracotta', 'coral', 'brown', 'sage']),
    // 実際に遊べるページの URL
    playUrl: z.string().url(),
    // 一覧のサムネイル画像(public/ 以下のパス)。まだ無いゲームは省略可
    thumbnail: z.string().optional(),
    // 並び順。小さい数字ほど先頭に表示。省略時は末尾側に回る
    order: z.number().default(999),
  }),
});

export const collections = { games };
