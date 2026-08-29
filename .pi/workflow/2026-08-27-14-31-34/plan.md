 ```markdown
# 実装プラン

## 1. 背景・問題

`src/content/posts/dummy-article.mdx` 内で、Markdown リンク構文 `[表示テキスト]({frontmatter.xxxUrl})` を使うと、MDX は URL 部分をリテラル文字列として扱い、`frontmatter.xxxUrl` の JSX 式が評価されません。その結果、リンク先が `https://...` ではなく `{frontmatter.xxxUrl}` のまま出力されます。

修正方針は、Markdown リンク構文を JSX の `<a>` 要素に置き換え、`href={frontmatter.xxxUrl}` とすることです。

---

## 2. 対象ファイル

- **ファイルパス**: `src/content/posts/dummy-article.mdx`
- **対象関数/コンポーネント名**: 該当なし（MDX コンテンツ本体）

---

## 3. タスク一覧

> **補足**: requirements.md では `]({frontmatter.fanzaUrl})` を 2 箇所と記載していますが、実ファイルには 4 箇所存在します。  
> 本プランでは「URL が文字列化される」不具合を残さないよう、該当する **すべての Markdown リンク** を修正します。

### タスク 1: 引用ブロック内の FANZA リンクを修正

- **変更箇所**: `>` 引用ブロック内「【初回無料】公式 FANZA TV でフル本編を今すぐ見る」リンク
- **変更理由**: Markdown リンク内の `{frontmatter.fanzaUrl}` が評価されない

**変更前**
```mdx
> 👉 **[【初回無料】公式FANZA TVでフル本編を今すぐ見る]({frontmatter.fanzaUrl})**
```

**変更後**
```mdx
> 👉 **[<a href={frontmatter.fanzaUrl}>【初回無料】公式FANZA TVでフル本編を今すぐ見る</a>]**
```

---

### タスク 2: 作品概要セクションの videoUrl リンクを修正

- **変更箇所**: 「無料サンプル」リスト項目内のリンク
- **変更理由**: Markdown リンク内の `{frontmatter.videoUrl}` が評価されない

**変更前**
```mdx
- **無料サンプル**: [無料動画ギャラリーで見る]({frontmatter.videoUrl})
```

**変更後**
```mdx
- **無料サンプル**: <a href={frontmatter.videoUrl}>無料動画ギャラリーで見る</a>
```

---

### タスク 3: FANZA TV 3 大メリットセクションの FANZA リンクを修正

- **変更箇所**: 「【実質 0 円】今すぐ FANZA TV でフル動画を快適に視聴する」リンク
- **変更理由**: Markdown リンク内の `{frontmatter.fanzaUrl}` が評価されない

**変更前**
```mdx
👉 **[【実質0円】今すぐFANZA TVでフル動画を快適に視聴する]({frontmatter.fanzaUrl})**
```

**変更後**
```mdx
👉 **[<a href={frontmatter.fanzaUrl}>【実質0円】今すぐFANZA TVでフル動画を快適に視聴する</a>]**
```

---

### タスク 4: 登録 3 ステップセクションの FANZA リンクを修正

- **変更箇所**: 番号付きリスト「FANZA TV 公式ページ」リンク
- **変更理由**: Markdown リンク内の `{frontmatter.fanzaUrl}` が評価されない

**変更前**
```mdx
1. **[FANZA TV公式ページ]({frontmatter.fanzaUrl})**へアクセス
```

**変更後**
```mdx
1. **[<a href={frontmatter.fanzaUrl}>FANZA TV公式ページ</a>]**へアクセス
```

---

### タスク 5: ダイジェスト動画セクションの videoUrl リンクを修正

- **変更箇所**: 「ダイジェスト・サンプル動画を再生する」リンク
- **変更理由**: Markdown リンク内の `{frontmatter.videoUrl}` が評価されない

**変更前**
```mdx
👉 **[ダイジェスト・サンプル動画を再生する（外部ギャラリー）]({frontmatter.videoUrl})**
```

**変更後**
```mdx
👉 **[<a href={frontmatter.videoUrl}>ダイジェスト・サンプル動画を再生する（外部ギャラリー）</a>]**
```

---

### タスク 6: まとめセクションの FANZA リンクを修正

- **変更箇所**: 「【完全無料】... を FANZA TV でフル視聴する」リンク
- **変更理由**: Markdown リンク内の `{frontmatter.fanzaUrl}` が評価されない

**変更前**
```mdx
👉 **[【完全無料】『{frontmatter.title}』をFANZA TVでフル視聴する]({frontmatter.fanzaUrl})**
```

**変更後**
```mdx
👉 **[<a href={frontmatter.fanzaUrl}>【完全無料】『{frontmatter.title}』をFANZA TVでフル視聴する</a>]**
```

> 注意: リンクテキスト内の `{frontmatter.title}` は表示テキストなので、そのまま `<a>` 要素内に残してください。

---

### タスク 7: 修正漏れの確認

- **対象ファイルのパス**: `src/content/posts/dummy-article.mdx`
- **確認内容**: Markdown リンク構文内に `{frontmatter.fanzaUrl}` や `{frontmatter.videoUrl}` が残っていないこと
- **実行コマンド例**
  ```bash
  grep -n ']({frontmatter\.' src/content/posts/dummy-article.mdx
  ```
- **期待結果**: 上記コマンドから何も出力されない
```
