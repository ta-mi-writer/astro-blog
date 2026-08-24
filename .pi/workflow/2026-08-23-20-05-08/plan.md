 ```markdown
# 実装計画: `src/pages/posts/[id].astro` へのヘッダー追加

## 概要
`src/pages/posts/[id].astro`（個別記事ページ）に、**CSS スタイルを一切適用せず**、純粋な HTML 要素のみで構成されたヘッダーを追加する。  
ヘッダーには以下を含む。

- サイト名（ホーム `/` へのリンク）
- カテゴリー一覧

カテゴリー情報は Content Collections のスキーマ・フロントマターから取得する。

---

## 前提確認

- Astro v5 + Content Collections を使用。
- 対象ファイル: `src/pages/posts/[id].astro`
- スコープ外:
  - CSS/Tailwind 適用
  - Layout コンポーネント化
  - 検索フォーム等の追加要素

---

## タスク一覧

### 1. `src/content.config.ts` に `categories` フィールドを追加する

**対象ファイル**: `src/content.config.ts`  
**対象関数/コンポーネント**: `posts` コレクションの `schema` 定義  
**変更理由**: カテゴリー一覧を表示するため、各投稿にカテゴリー情報を持たせる必要がある。

#### 変更前
```ts
const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string().optional(),
    thumbnailUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    fanzaUrl: z.string().url().optional(),
  }),
});
```

#### 変更後
```ts
const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string().optional(),
    thumbnailUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    fanzaUrl: z.string().url().optional(),
    categories: z.array(z.string()).optional(),
  }),
});
```

---

### 2. 既存記事のフロントマターに `categories` を追加する

**対象ファイル**:

- `src/content/posts/hello-world.md`
- `src/content/posts/dummy-article.mdx`

**対象関数/コンポーネント**: 各ファイルの frontmatter  
**変更理由**: スキーマに追加した `categories` に実際の値を設定し、ヘッダーのカテゴリー一覧に表示できるようにする。

#### `src/content/posts/hello-world.md` 変更前
```yaml
---
title: 'Hello World'
pubDate: 2024-01-15
description: 'Welcome to my new blog!'
---
```

#### `src/content/posts/hello-world.md` 変更後
```yaml
---
title: 'Hello World'
pubDate: 2024-01-15
description: 'Welcome to my new blog!'
categories: ['general']
---
```

#### `src/content/posts/dummy-article.mdx` 変更前
```yaml
---
title: "【Tube Corporate】注目の新作ダミー作品レビュー"
pubDate: 2025-01-20
description: "FANZA TVで配信中のTube Corporate傘下ダミー作品を紹介します。"
thumbnailUrl: "https://awsimgsrc.dmm.co.jp/dig_white/digital/video/jul00664/jul00664jp-1.jpg"
videoUrl: "https://txxx.com/videos/21751727/535-deezeoo-touy-roo-hez/"
fanzaUrl: "https://tv.dmm.co.jp/vod/?content=jul00664"
---
```

#### `src/content/posts/dummy-article.mdx` 変更後
```yaml
---
title: "【Tube Corporate】注目の新作ダミー作品レビュー"
pubDate: 2025-01-20
description: "FANZA TVで配信中のTube Corporate傘下ダミー作品を紹介します。"
thumbnailUrl: "https://awsimgsrc.dmm.co.jp/dig_white/digital/video/jul00664/jul00664jp-1.jpg"
videoUrl: "https://txxx.com/videos/21751727/535-deezeoo-touy-roo-hez/"
fanzaUrl: "https://tv.dmm.co.jp/vod/?content=jul00664"
categories: ['review', 'dummy']
---
```

---

### 3. `src/pages/posts/[id].astro` でカテゴリー一覧データを生成する

**対象ファイル**: `src/pages/posts/[id].astro`  
**対象関数/コンポーネント**: ファイル先頭の frontmatter（`---` 内）  
**変更理由**: 全投稿からユニークなカテゴリー一覧を取り出し、テンプレートで使用する。

#### 変更前
```astro
---
import {
  getCollection,
  render,
} from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;

const { Content } = await render(post);

const currentYear = new Date().getFullYear();
---
```

#### 変更後
```astro
---
import {
  getCollection,
  render,
} from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;

const { Content } = await render(post);

const currentYear = new Date().getFullYear();

const allPosts = await getCollection("posts");
const categories = [
  ...new Set(
    allPosts.flatMap((p) => p.data.categories ?? []),
  ),
].sort();
---
```

**補足**:

- `p.data.categories ?? []` を使い、`categories` が未設定の投稿があってもエラーにならないようにする。
- `Set` で重複を除去し、`sort()` でアルファベット順に並べる。

---

### 4. `src/pages/posts/[id].astro` の `<body>` 内にヘッダーを追加する

**対象ファイル**: `src/pages/posts/[id].astro`  
**対象関数/コンポーネント**: テンプレート部分の `<body>`  
**変更理由**: 機能要件にある「サイト名（ホームへのリンク）」と「カテゴリー一覧」をページ上部に表示する。

#### 追加位置
`<body>` の開始直後、`<article>` の前。

#### 変更前
```astro
  <body>
    <article>
      <h1>{post.data.title}</h1>
```

#### 変更後
```astro
  <body>
    <header>
      <a href="/">Laguna Blog</a>

      {
        categories.length > 0 && (
          <nav aria-label="カテゴリー一覧">
            <ul>
              {categories.map((category) => (
                <li>{category}</li>
              ))}
            </ul>
          </nav>
        )
      }
    </header>

    <article>
      <h1>{post.data.title}</h1>
```

**補足**:

- サイト名は `index.astro` の `<title>` / `<h1>` と一致させるため、`Laguna Blog` とする。
- カテゴリーは現在存在しないカテゴリー個別ページへのリンクではなく、純粋なテキスト一覧として表示する。
- `class` 属性や `style` 属性は一切付与しない。
- カテゴリーが 0 件の場合は `<nav>` ごと非表示にする。

---

### 5. 型チェックとビルド検証を行う

**対象ファイル**: プロジェクト全体  
**対象関数/コンポーネント**: なし（検証タスク）  
**変更理由**: スキーマ変更とテンプレート変更が正しく反映され、ビルドが通ることを確認する。

#### 実行コマンド
```bash
npx astro check
npx astro build
```

#### 確認項目
- `astro check` で TypeScript / 型エラーが出ないこと。
- `astro build` で静的ファイル生成が成功すること。
- 生成された `dist/posts/<id>/index.html` に `<header>`、サイト名リンク、カテゴリー一覧が含まれていること。
- ヘッダー内に CSS クラスやスタイル属性が含まれていないこと。

---

## 変更対象ファイルまとめ

| ファイル | 変更内容 |
|---|---|
| `src/content.config.ts` | `categories` フィールド追加 |
| `src/content/posts/hello-world.md` | `categories: ['general']` 追加 |
| `src/content/posts/dummy-article.mdx` | `categories: ['review', 'dummy']` 追加 |
| `src/pages/posts/[id].astro` | カテゴリー一覧生成 + ヘッダー HTML 追加 |
```
