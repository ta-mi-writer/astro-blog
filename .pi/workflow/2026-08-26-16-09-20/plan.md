 # 実装計画: dummy-article.mdx のタイトル下に日本語 pubDate を追加

## 1. 現状確認

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/content/posts/dummy-article.mdx` |
| フレームワーク | Astro v5 + Content Collections |
| 既存の `pubDate` | `pubDate: 2025-01-20`（frontmatter に存在） |
| スキーマ | `src/content.config.ts` で `pubDate: z.coerce.date()` として定義済み |

## 2. 実装タスク

### タスク 1: frontmatter に `pubDate` が存在するか確認する
- **対象ファイル**: `src/content/posts/dummy-article.mdx`
- **対象箇所**: ファイル先頭の YAML frontmatter
- **変更理由**: 記事タイトル下に表示する日付のソースデータを保証するため。
- **変更前**:
  ```yaml
  ---
  title: "【高画質フル】注目の新作作品レビュー＆無料視聴ガイド"
  description: "本作のフル動画を安全・高画質で無料視聴する方法を解説！…"
  ---
  ```
- **変更後**:
  ```yaml
  ---
  title: "【高画質フル】注目の新作作品レビュー＆無料視聴ガイド"
  pubDate: 2025-01-20
  description: "本作のフル動画を安全・高画質で無料視聴する方法を解説！…"
  ---
  ```

### タスク 2: タイトル直下に日本語表記の pubDate を追加する
- **対象ファイル**: `src/content/posts/dummy-article.mdx`
- **対象コンポーネント/要素**: `# {frontmatter.title}` 見出しの直下
- **変更理由**: 要件に基づき「2025年1月20日」のような日本語表記で投稿日をタイトル下に表示するため。
- **変更前**:
  ```mdx
  # {frontmatter.title}

  <a href={frontmatter.fanzaUrl}>
  ```
- **変更後**:
  ```mdx
  # {frontmatter.title}

  <p>{new Date(frontmatter.pubDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</p>

  <a href={frontmatter.fanzaUrl}>
  ```

### タスク 3: 日本語日付の出力形式を検証する
- **対象ファイル**: `src/content/posts/dummy-article.mdx`
- **対象式**: `{new Date(frontmatter.pubDate).toLocaleDateString('ja-JP', ...)}`
- **変更理由**: `pubDate: 2025-01-20` を「2025年1月20日」と表示できることを確認するため。
- **期待出力**:
  ```html
  <p>2025年1月20日</p>
  ```

### タスク 4: ビルド・動作確認を行う
- **対象コマンド**: `astro build` または `astro dev --background`
- **確認対象**: `http://localhost:4321/posts/dummy-article`（実際のパスは `src/pages/posts/[id].astro` のルーティングに依存）
- **確認項目**:
  1. ページがエラーなくレンダリングされる
  2. `<h1>` 直下に `<p>2025年1月20日</p>` が存在する
  3. 他のコンテンツ（サムネイル、本文、リンク）がそのまま表示される

## 3. スコープ外（実施しないこと）

| 対象 | 理由 |
|------|------|
| `src/pages/posts/[id].astro` の編集 | 要件で対象外とされているため |
| `src/content.config.ts` の編集 | `pubDate` フィールドは既にスキーマ定義済みのため |
| CSS/スタイルの変更 | 要件で「デザイン変更はスコープ外」とされているため |
| 他の記事ファイル（`hello-world.md` 等）の編集 | 対象ファイルが `dummy-article.mdx` のみのため |

## 4. 完了条件

- [ ] タスク 1 が完了している（`pubDate: 2025-01-20` が frontmatter に存在）
- [ ] タスク 2 が完了している（タイトル直下に日本語日付の `<p>` が追加されている）
- [ ] タスク 3 が完了している（`2025年1月20日` と表示される）
- [ ] タスク 4 が完了している（ビルド/表示が正常）
