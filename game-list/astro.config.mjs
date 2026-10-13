// @ts-check
import { defineConfig } from 'astro/config';
import keystatic from '@keystatic/astro';

// ローカル開発中だけ Keystatic を有効にする。
// 公開用ビルドはゲーム一覧を静的HTMLにして、どこでも配信できるようにする。
export default defineConfig({
  output: 'static',
  integrations: process.env.NODE_ENV === 'development' ? [keystatic()] : [],
});
