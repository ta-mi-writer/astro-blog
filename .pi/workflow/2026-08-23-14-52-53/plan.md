 # 実装計画: コピーライト年の動的化

## 概要
`src/pages/posts/[id].astro` のフッター内にあるコピーライト表示「© 2025 ダミーサイト名 All rights reserved.」について、ハードコードされた年「2025」を、ビルド時のシステム日付から動的に取得した現在の年に置き換える。

---

## タスク一覧

### 1. 現在の年を取得する変数をフロントマターに追加

- **対象ファイル:** `src/pages/posts/[id].astro`
- **対象関数/コンポーネント名:** トップレベルのコンポーネントスクリプト（`---` で囲まれるフロントマター）
- **変更理由:** ビルド時に `new Date().getFullYear()` を実行し、テンプレートで利用できる年の値を保持する。Astro のコンポーネントスクリプトはサーバー/ビルド時に実行されるため、SSG の静的出力に適する。
- **変更前のコード例:**
  ```astro
  const { post } = Astro.props;

  // ② post を render() に渡して <Content /> コンポーネントを取り出す
  const { Content } = await render(post);
  ```
- **変更後のコード例:**
  ```astro
  const { post } = Astro.props;

  // ② post を render() に渡して <Content /> コンポーネントを取り出す
  const { Content } = await render(post);

  // ビルド時のシステム日付から現在の年を取得
  const currentYear = new Date().getFullYear();
  ```
- **実行手順:**
  1. `src/pages/posts/[id].astro` を開く。
  2. `const { Content } = await render(post);` の直後に `const currentYear = new Date().getFullYear();` を追加する。
  3. インデントやセミコロンを周辺コードと揃える。

---

### 2. フッターのコピーライト表示を動的な年に置き換え

- **対象ファイル:** `src/pages/posts/[id].astro`
- **対象関数/コンポーネント名:** フッター（`<footer>`）内のコピーライト `<small>` 要素
- **変更理由:** ハードコードされた「2025」を、タスク 1 で取得した `currentYear` 変数に置き換え、ビルド時に静的な HTML として出力する。クライアントサイド JavaScript は使用せず、Astro のテンプレート式を利用する。
- **変更前のコード例:**
  ```astro
  <p>
    <small
      >&copy; 2025 ダミーサイト名 All rights
      reserved.</small
    >
  </p>
  ```
- **変更後のコード例:**
  ```astro
  <p>
    <small
      >&copy; {currentYear} ダミーサイト名 All rights
      reserved.</small
    >
  </p>
  ```
- **実行手順:**
  1. `<footer>` 内の `<small>` 要素を探す。
  2. テキストノード内の `2025` を `{currentYear}` に置き換える。
  3. 他の文字列（`&copy;`、サイト名、All rights reserved.）は変更しない。

---

### 3. ビルド出力で年が動的に埋め込まれていることを確認

- **対象ファイル:** `src/pages/posts/[id].astro`（およびビルド成果物 `dist/posts/*/index.html`）
- **対象関数/コンポーネント名:** `getStaticPaths` 生成後の静的 HTML 出力
- **変更理由:** 本変更が SSG として正しく機能し、HTML に静的なテキストとして年が含まれていることを検証する。クライアントサイドスクリプトが追加されていないことも確認する。
- **確認手順:**
  1. プロジェクトルートで以下のコマンドを実行し、静的ビルドを行う。
     ```bash
     astro build
     ```
  2. `dist/posts/<任意のid>/index.html` を開き、フッター部分に `&copy; 2025 ダミーサイト名 All rights reserved.` ではなく、例えば `&copy; 2025 ダミーサイト名 All rights reserved.`（実行年）が含まれていることを確認する。
  3. 該当 HTML 内に `<script>` タグによるクライアントサイドの年更新処理が含まれていないことを確認する。
- **期待する出力例:**
  ```html
  <p>
    <small>© 2025 ダミーサイト名 All rights reserved.</small>
  </p>
  ```
  （注: `2025` の部分は実行時の年に応じて変化する。）

---

## 補足

- 本計画の対象は `src/pages/posts/[id].astro` のみとする。他のページや共通レイアウト（`src/layouts/` 等）に同様の表記があっても、本タスクでは変更しない。
- `new Date().getFullYear()` はコンポーネントスクリプト内で呼び出すため、ビルド時に 1 回評価され、各投稿ページの HTML に同じ年が埋め込まれる。動的ルートの各ページごとに異なる値になることはない。
