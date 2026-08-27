 # 実装プラン: dummy-article.mdx 構文ミス修正

## 1. 現状確認

- **対象ファイル**: `src/content/posts/dummy-article.mdx`
- **問題箇所**: 以下の Markdown リンク＋画像構文

```md
[![サムネイル画像]({frontmatter.thumbnailUrl})]({frontmatter.fanzaUrl})
```

- **問題の本質**: Markdown / MDX では `![alt](url)` や `[text](url)` の URL 部分に JSX 式 `{frontmatter.thumbnailUrl}` を直接埋め込むことができません。Astro v5（MDX）でこの構文を解釈しようとすると、`frontmatter.thumbnailUrl` の解決に失敗し、インポート/参照エラーまたはパースエラーが発生します。

## 2. 修正方針

Markdown 構文をやめて、JSX 式を使える HTML/JSX タグ（`<a>` + `<img>`）に置き換えます。これにより `frontmatter.thumbnailUrl` と `frontmatter.fanzaUrl` を正しく参照できます。

## 3. 実装タスク

### タスク 1: Astro MDX 構文をドキュメントで確認する

- **対象**: ドキュメント調査（ファイル変更なし）
- **確認内容**: Astro v5 の MDX で frontmatter 変数を JSX 式として使う方法、および Markdown 画像リンク内で JSX 式が使えない制約
- **参考ドキュメント**: Astro Docs「Markdown in Astro」「Template expressions reference」
- **理由**: 要件に「`astro_docs_search` で確認してから修正」とあるため、修正前に公式ドキュメントで正しい構文を確認する
- **完了条件**: JSX 式 `{frontmatter.xxx}` は `<a>` や `<img>` などの JSX 要素属性内で使用可能であることを確認する

### タスク 2: `dummy-article.mdx` の不正な Markdown 画像リンクを JSX に置き換える

- **対象ファイル**: `src/content/posts/dummy-article.mdx`
- **対象箇所**: 先頭付近のサムネイル画像リンク（1 行）
- **変更理由**: Markdown 構文 `![alt]({式})` は MDX パーサーで正しく解釈されず、`frontmatter.thumbnailUrl` の参照に失敗する
- **変更前コード例**:

```md
[![サムネイル画像]({frontmatter.thumbnailUrl})]({frontmatter.fanzaUrl})
```

- **変更後コード例**:

```mdx
<a href={frontmatter.fanzaUrl}>
  <img src={frontmatter.thumbnailUrl} alt="サムネイル画像" />
</a>
```

- **注意点**:
  - 他の `{frontmatter.title}` や `{frontmatter.fanzaUrl}` の利用箇所は見出しや本文中の JSX 式として正しく動作するため、原則として変更しない
  - 本タスクではサムネイル画像リンクのみを修正する（スコープ外の他記事は修正しない）

### タスク 3: 修正後にビルド/型チェックで構文エラーが解消したか確認する

- **対象**: プロジェクト全体の検証（ファイル変更なし）
- **実行コマンド例**:

```bash
npx astro check
```

または

```bash
npx astro build
```

- **理由**: 修正によって `dummy-article.mdx` の構文エラーが解消し、他のファイルに影響がないことを確認する
- **完了条件**: `src/content/posts/dummy-article.mdx` に関するエラーが出力されなくなること

## 4. スコープ外

- 他の記事（例: `src/content/posts/hello-world.md` など）の修正
- `src/content.config.ts` のスキーマ変更
- スタイル・レイアウトの変更
