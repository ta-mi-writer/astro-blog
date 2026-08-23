 ```markdown
# 実装計画: ブログ記事詳細ページへのフッター追加

## 対象

- `src/pages/posts/[id].astro` のページテンプレート部分

## 概要

`[id].astro` の既存マークアップ（`<article>` 終了後、`</body>` 直前）に、アフィリエイトブログ向け最小構成のフッターを静的 HTML として追加する。将来 `src/components/Footer.astro` へ切り出しやすいよう、`<footer>` 要素で囲んだ構造にする。スタイル、JavaScript、Hydration 指令は一切使用しない。

---

## タスク一覧

### 1. `<footer>` 要素の追加位置を確保する

- **対象ファイル**: `src/pages/posts/[id].astro`
- **対象コンポーネント/領域**: ページレイアウトのテンプレート部分（`<article>` 終了タグ直後）
- **変更理由**: 要件で指定された配置先にフッターを追加し、かつ記事コンテンツ（`<article>`）とフッターというセマンティックな分離を保つため。

#### 変更前のコード例

```astro
      <section>
        <Content />
      </section>
    </article>
  </body>
</html>
```

#### 変更後のコード例

```astro
      <section>
        <Content />
      </section>
    </article>

    <footer>
      <!-- タスク2・3・4 で追加する内容 -->
    </footer>
  </body>
</html>
```

---

### 2. 免責事項 / プライバシーポリシーへのリンクを追加する

- **対象ファイル**: `src/pages/posts/[id].astro`
- **対象コンポーネント/領域**: タスク1 で追加した `<footer>` 内
- **変更理由**: アフィリエイトブログ向け最小構成として、法的・運用上重要なページへのリンクを設置するため（URL は要件通りダミー）。

#### 変更前のコード例

```astro
    <footer>
      <!-- タスク2・3・4 で追加する内容 -->
    </footer>
```

#### 変更後のコード例

```astro
    <footer>
      <nav aria-label="フッターナビゲーション">
        <ul>
          <li><a href="/disclaimer/">免責事項</a></li>
          <li><a href="/privacy/">プライバシーポリシー</a></li>
        </ul>
      </nav>
    </footer>
```

---

### 3. ホームに戻るリンクを追加する

- **対象ファイル**: `src/pages/posts/[id].astro`
- **対象コンポーネント/領域**: タスク1 で追加した `<footer>` 内（ナビゲーションリンクの近傍）
- **変更理由**: 記事詳細ページからトップページへ戻る導線を提供するため。将来的に共通フッターコンポーネント化しても再利用可能な要素。

#### 変更前のコード例

```astro
      <nav aria-label="フッターナビゲーション">
        <ul>
          <li><a href="/disclaimer/">免責事項</a></li>
          <li><a href="/privacy/">プライバシーポリシー</a></li>
        </ul>
      </nav>
```

#### 変更後のコード例

```astro
      <nav aria-label="フッターナビゲーション">
        <ul>
          <li><a href="/disclaimer/">免責事項</a></li>
          <li><a href="/privacy/">プライバシーポリシー</a></li>
          <li><a href="/">ホームに戻る</a></li>
        </ul>
      </nav>
```

---

### 4. コピーライト表記を追加する

- **対象ファイル**: `src/pages/posts/[id].astro`
- **対象コンポーネント/領域**: タスク1 で追加した `<footer>` 内の最下部
- **変更理由**: アフィリエイトブログ向け最小構成として、サイト名と年号を含むコピーライト表記を追加するため（サイト名・年号は要件通りダミー）。

#### 変更前のコード例

```astro
      <nav aria-label="フッターナビゲーション">
        <ul>
          <li><a href="/disclaimer/">免責事項</a></li>
          <li><a href="/privacy/">プライバシーポリシー</a></li>
          <li><a href="/">ホームに戻る</a></li>
        </ul>
      </nav>
```

#### 変更後のコード例

```astro
      <nav aria-label="フッターナビゲーション">
        <ul>
          <li><a href="/disclaimer/">免責事項</a></li>
          <li><a href="/privacy/">プライバシーポリシー</a></li>
          <li><a href="/">ホームに戻る</a></li>
        </ul>
      </nav>
      <p><small>&copy; 2025 ダミーサイト名 All rights reserved.</small></p>
```

---

### 5. クライアントサイド JavaScript / Hydration 指令が混入していないか確認する

- **対象ファイル**: `src/pages/posts/[id].astro`
- **対象コンポーネント/領域**: ファイル全体（特に `<footer>` 周辺と Frontmatter）
- **変更理由**: 非機能要件として「ビルド後に静的な HTML のみになるようにする」ため、`<script>` タグおよび `client:*` 系ディレクティブを一切追加しないことを保証する。

#### 確認事項

- `<footer>` 内に `<script>` タグがないこと
- `<footer>` 内またはファイル全体に `client:load` / `client:idle` / `client:visible` / `client:media` / `client:only` / `client:transition` がないこと
- Frontmatter に CSR 用の import を追加していないこと

---

### 6. ビルド結果でフッターが静的 HTML として含まれていることを確認する

- **対象ファイル**: ビルド生成物（例: `dist/posts/*/index.html`）
- **対象コンポーネント/領域**: 各記事詳細ページのフッター部分
- **変更理由**: 実装が正しく反映され、HTML としてレンダリングされることを検証するため。

#### 実行コマンド例

```bash
astro build
```

#### 確認事項

- `dist/posts/<id>/index.html` 内に以下の文字列が含まれること
  - `免責事項`
  - `プライバシーポリシー`
  - `ホームに戻る`
  - `&copy; 2025 ダミーサイト名 All rights reserved.`
- フッター部分に `<script>` タグや `client:*` 属性が注入されていないこと
```
