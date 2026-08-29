 # plan.md — /wf-review の VERDICT によるフェーズ遷移

## 概要

`.pi/extensions/wf-workflow.ts` の `/wf-review` コマンドで、レビュアー出力の `VERDICT` 行に応じて `.pi/workflow/current.json` の `phase` を遷移させる。

| VERDICT      | 遷移先 phase |
|--------------|--------------|
| PASS         | DONE         |
| FAIL_CODER   | CODING       |
| FAIL_PLAN    | PLANNING     |
| FAIL_REQ     | DISCOVERY    |

---

## タスクリスト

### 1. VERDICT → phase の対応表を追加する

- **対象ファイル**: `.pi/extensions/wf-workflow.ts`
- **対象関数/コンポーネント**: モジュールレベル定数 `VERDICT_TO_PHASE`
- **変更理由**: 判定文字列を `RunState["phase"]` に機械的に変換する単一情報源を作り、小さなコーダーが暗黙の判断をせずに実装できるようにする。

**追加例**:

```ts
const VERDICT_TO_PHASE: Record<
  "PASS" | "FAIL_CODER" | "FAIL_PLAN" | "FAIL_REQ",
  RunState["phase"]
> = {
  PASS: "DONE",
  FAIL_CODER: "CODING",
  FAIL_PLAN: "PLANNING",
  FAIL_REQ: "DISCOVERY",
};
```

---

### 2. `/wf-review` ハンドラで VERDICT 抽出直後にフェーズを更新する

- **対象ファイル**: `.pi/extensions/wf-workflow.ts`
- **対象関数/コンポーネント**: `pi.registerCommand("wf-review", { handler: async (...) })`
- **変更理由**: 現在は `run.phase` を更新せず `REVIEW` のまま `current.json` を上書きしているため、レビュー結果に応じた遷移ができていない。

**変更前**:

```ts
const verdictMatch = reviewText.match(
  /^VERDICT:\s*(PASS|FAIL_CODER|FAIL_PLAN|FAIL_REQ)\s*$/m,
);
const verdict = verdictMatch?.[1] ?? null;

let summary = `Review complete.${verdict ? ` Verdict: ${verdict}` : "\n⚠ Could not parse VERDICT line from reviewer output — read the full text below."}\n\n${reviewText.slice(-1500)}`;
```

**変更後**:

```ts
const verdictMatch = reviewText.match(
  /^VERDICT:\s*(PASS|FAIL_CODER|FAIL_PLAN|FAIL_REQ)\s*$/m,
);
const verdict = verdictMatch?.[1] ?? null;

if (verdict) {
  const nextPhase = VERDICT_TO_PHASE[verdict];
  if (nextPhase) {
    run.phase = nextPhase;
  }
}

let summary = `Review complete.${verdict ? ` Verdict: ${verdict}` : "\n⚠ Could not parse VERDICT line from reviewer output — read the full text below."}\n\n${reviewText.slice(-1500)}`;
```

---

### 3. フェーズ保存・ステータス表示の順序を遷移後に合わせる

- **対象ファイル**: `.pi/extensions/wf-workflow.ts`
- **対象関数/コンポーネント**: 同 `/wf-review` ハンドラ内の `run.updatedAt` 更新〜`ctx.ui.setStatus` まで
- **変更理由**: 遷移後の `run.phase` を `current.json` に永続化し、UI ステータスにも反映させるため。

**変更前**:

```ts
run.updatedAt = new Date().toISOString();
writeJson(CURRENT_FILE, run);
ctx.ui.setStatus(
  "wf",
  `[${run.runId}] ${run.phase}`,
);
ctx.ui.notify(
  summary,
  verdict === "PASS" ? "info" : "warning",
);
```

**変更後**:

```ts
run.updatedAt = new Date().toISOString();
writeJson(CURRENT_FILE, run);
ctx.ui.setStatus(
  "wf",
  `[${run.runId}] ${run.phase}`,
);

const nextAction = !verdict
  ? "\n\nPhase remains REVIEW because VERDICT could not be parsed. Check review_feedback.md."
  : run.phase === "DONE"
    ? "\n\nWorkflow reached DONE."
    : run.phase === "CODING"
      ? "\n\nReturned to CODING. Re-run /wf-code after addressing the feedback."
      : run.phase === "PLANNING"
        ? "\n\nReturned to PLANNING. Re-run /wf-plan after addressing the feedback."
        : "\n\nReturned to DISCOVERY. Update requirements.md, then /wf-plan.";

ctx.ui.notify(
  summary + nextAction,
  verdict === "PASS" ? "info" : "warning",
);
```

---

### 4. VERDICT が未検出/不明な場合の安全なフォールバックを明確にする

- **対象ファイル**: `.pi/extensions/wf-workflow.ts`
- **対象関数/コンポーネント**: 同 `/wf-review` ハンドラ
- **変更理由**: レビュアー出力が正規表現にマッチしない場合に誤って `DONE` 等に進まないよう、phase を `REVIEW` のままにする動作を明示する。

**実装内容**:

- `verdict === null` の場合は `run.phase` を変更しない。
- 通知メッセージに「Phase remains REVIEW...」を含める（タスク 3 の `nextAction` で既に対応）。
- `review_feedback.md` への書き込みは従来通り継続し、レビュー結果を失わない。

---

### 5. （推奨）VERDICT 適用ロジックを小さなヘルパーに切り出す

- **対象ファイル**: `.pi/extensions/wf-workflow.ts`
- **対象関数/コンポーネント**: 新規関数 `applyVerdict(run, verdict)`
- **変更理由**: コーダーが改変箇所を見つけやすくし、将来の判定追加・単体テストを容易にする。

**追加例**:

```ts
function applyVerdict(
  run: RunState,
  verdict: string | null,
): { changed: boolean; nextPhase?: RunState["phase"] } {
  if (!verdict) return { changed: false };
  const nextPhase = VERDICT_TO_PHASE[verdict as keyof typeof VERDICT_TO_PHASE];
  if (!nextPhase) return { changed: false };
  run.phase = nextPhase;
  return { changed: true, nextPhase };
}
```

**呼び出し例**:

```ts
const { changed } = applyVerdict(run, verdict);
// changed が false の場合は phase を REVIEW のままにする
```

---

## 実装上の注意

- `FAIL_PLAN` はユーザーが「PLAN」と表記しているが、内部状態名は `"PLANNING"` なので `VERDICT_TO_PHASE` では `"PLANNING"` にマップすること。
- `FAIL_CODER` も同様に内部状態名 `"CODING"` にマップすること。
- `/wf-review` は `current.json` を直接書き換える唯一の責務を持つ。この変更により `/wf-code` → `/wf-review` → 差し戻し → `/wf-code` / `/wf-plan` の自動ループが可能になる。
