// @ts-nocheck

/**
 * Workflow Extension (ステップ1〜3)
 *
 * アーティファクト駆動の多段ワークフロー:
 *   [1.要件定義(メインセッション)] -> requirements.md
 *   [2.プランニング(/wf-plan)]     -> plan.md      (Kimi K2.7 Code, 月3000回制限)
 *   [3.コーディング(/wf-code)]     -> git diff     (laguna-xs)
 *   [4.レビュー(/wf-review)]       -> PASS/FAIL    (laguna-s)
 *
 * 規約:
 *   .pi/workflow/<runId>/           実行ごとのアーティファクト置き場
 *   .pi/workflow/current.json       現在アクティブな run へのポインタ
 *   .pi/workflow/planner-budget.json プランナー使用回数カウンタ（月間3000回）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const WORKFLOW_DIR = path.join(
  process.cwd(),
  ".pi",
  "workflow",
);
const CURRENT_FILE = path.join(
  WORKFLOW_DIR,
  "current.json",
);
const BUDGET_FILE = path.join(
  WORKFLOW_DIR,
  "planner-budget.json",
);

const PLANNER_MODEL =
  "sakura/preview/Kimi-K2.7-Code:high";
const PLANNER_MONTHLY_LIMIT = 3000;
const CODER_MODEL =
  "pool/poolside/laguna-xs-2.1:off";
const REVIEWER_MODEL =
  "pool/poolside/laguna-s-2.1:medium";

/**
 * plan.md から番号付きチェックリストタスクを抽出する。
 * `- [ ] 3. 見出し` の行をタスク開始とみなし、次の同レベル項目までの行をそのタスクの本文とする。
 */
function extractTasks(
  planText: string,
): Array<{ num: number; text: string }> {
  const tasks: Array<{
    num: number;
    text: string;
  }> = [];
  const startRe =
    /^\s*[-*]\s*\[[ xX]\]\s*(\d+)[.:）)]?\s*/;
  let current: {
    num: number;
    lines: string[];
  } | null = null;
  for (const line of planText.split("\n")) {
    const m = line.match(startRe);
    if (m) {
      if (current)
        tasks.push({
          num: current.num,
          text: current.lines
            .join("\n")
            .trimEnd(),
        });
      current = {
        num: Number(m[1]),
        lines: [line],
      };
    } else if (current) {
      // インデント行・空行・コードフェンスは本文として継続、それ以外はタスク終端
      if (
        /^\s/.test(line) ||
        line.trim() === "" ||
        /^```/.test(line.trim())
      ) {
        current.lines.push(line);
      } else {
        tasks.push({
          num: current.num,
          text: current.lines
            .join("\n")
            .trimEnd(),
        });
        current = null;
      }
    }
  }
  if (current)
    tasks.push({
      num: current.num,
      text: current.lines.join("\n").trimEnd(),
    });
  return tasks;
}

/** "1,3-5" のようなタスク番号指定をパースする */
function parseTaskSpec(
  spec: string,
): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const range = part
      .trim()
      .match(/^(\d+)-(\d+)$/);
    if (range) {
      for (
        let i = Number(range[1]);
        i <= Number(range[2]);
        i++
      )
        out.add(i);
    } else if (/^\d+$/.test(part.trim())) {
      out.add(Number(part.trim()));
    }
  }
  return out;
}

interface RunState {
  runId: string;
  phase:
    | "DISCOVERY"
    | "PLANNING"
    | "CODING"
    | "REVIEW"
    | "DONE";
  baseCommit?: string;
  updatedAt: string;
}

/** Date を日本時間 (UTC+9) の "YYYY-MM-DD-HH-MM-SS" 形式に整形する */
function jst(date: Date): string {
  const d = new Date(
    date.getTime() + 9 * 60 * 60 * 1000,
  );
  const pad = (n: number) =>
    String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`
  );
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8"),
    ) as T;
  } catch {
    return null;
  }
}

function writeJson(
  file: string,
  data: unknown,
): void {
  fs.mkdirSync(path.dirname(file), {
    recursive: true,
  });
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
  );
}

function getRun(): RunState | null {
  return readJson<RunState>(CURRENT_FILE);
}

function runDir(run: RunState): string {
  return path.join(WORKFLOW_DIR, run.runId);
}

function newRun(): RunState {
  const now = new Date();
  return {
    runId: jst(now),
    phase: "DISCOVERY",
    updatedAt: now.toISOString(),
  };
}

/** プランナー予算カウンタを1消費し、残数を返す */
function consumePlannerBudget(): {
  used: number;
  remaining: number;
} {
  const month = new Date()
    .toISOString()
    .slice(0, 7); // YYYY-MM
  let budget = readJson<{
    month: string;
    used: number;
  }>(BUDGET_FILE);
  if (!budget || budget.month !== month) {
    budget = { month, used: 0 };
  }
  budget.used += 1;
  writeJson(BUDGET_FILE, budget);
  return {
    used: budget.used,
    remaining:
      PLANNER_MONTHLY_LIMIT - budget.used,
  };
}

export default function wfWorkflow(
  pi: ExtensionAPI,
) {
  // ---------------------------------------------------------------
  // /wf-new : 新しいワークフロー実行を開始する
  // ---------------------------------------------------------------
  pi.registerCommand("wf-new", {
    description:
      "Start a new workflow run (creates artifact dir)",
    handler: async (_args, ctx) => {
      const run = newRun();
      writeJson(CURRENT_FILE, run);
      fs.mkdirSync(runDir(run), {
        recursive: true,
      });
      ctx.ui.notify(
        `New workflow run started: ${run.runId}\nArtifacts: ${runDir(run)}\nNext: chat to define requirements, then save them and run /wf-plan`,
        "info",
      );
      ctx.ui.setStatus(
        "wf",
        `[${run.runId}] ${run.phase}`,
      );
    },
  });

  // ---------------------------------------------------------------
  // /wf-status : 現在のフェーズとアーティファクト・予算を表示
  // ---------------------------------------------------------------
  pi.registerCommand("wf-status", {
    description:
      "Show workflow phase, artifacts, and planner budget",
    handler: async (_args, ctx) => {
      const lines: string[] = [];

      const run = getRun();
      if (!run) {
        lines.push(
          "No active run. Use /wf-new to start one.",
        );
      } else {
        lines.push(
          `Run:   ${run.runId}  (phase: ${run.phase})`,
        );
        const dir = runDir(run);
        for (const f of [
          "requirements.md",
          "plan.md",
          "review_feedback.md",
        ]) {
          const p = path.join(dir, f);
          if (fs.existsSync(p)) {
            const stat = fs.statSync(p);
            lines.push(
              `  ✓ ${f}  (${jst(stat.mtime)}, ${stat.size} bytes)`,
            );
          } else {
            lines.push(`  ✗ ${f}  (missing)`);
          }
        }
      }

      const budget = readJson<{
        month: string;
        used: number;
      }>(BUDGET_FILE);
      if (budget) {
        lines.push(
          `Planner budget (${budget.month}): ${budget.used}/${PLANNER_MONTHLY_LIMIT} used`,
        );
      } else {
        lines.push(
          `Planner budget: 0/${PLANNER_MONTHLY_LIMIT} used`,
        );
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // ---------------------------------------------------------------
  // /wf-code : コーダー(laguna-xs)をサブプロセスで呼び出す
  //   使い方: /wf-code [タスク番号指定 例: 1,3-5]
  //   - plan.md が必須
  //   - 実行前にベースコミット(stash ref)を作成しレビュー用 diff の基準にする
  //   - タスク指定があれば該当タスクのみ、なければ plan 全文を渡す
  // ---------------------------------------------------------------
  // ---------------------------------------------------------------
  // フェーズガード: CODING 以外のフェーズではメインモデルによる直接編集を禁止する。
  // 「DISCOVERY で対話しているつもりが、いつものようにコードを書かれてしまう」ことを防ぐ。
  // サブプロセスのコーダーは phase=CODING のときに動くため影響を受けない。
  // ---------------------------------------------------------------
  let guardDisabled = false;

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    const run = getRun();
    if (!run || run.phase === "CODING" || guardDisabled) return;

    // ワークフローアーティファクト(.pi/workflow/<runId>/ 配下)への書き込みは許可する。
    // DISCOVERY 中にモデルが requirements.md を書き出せるようにするため。
    const targetPath = path.resolve(
      process.cwd(),
      (event.input as any)?.path ?? (event.input as any)?.file_path ?? "",
    );
    if (targetPath.startsWith(runDir(run) + path.sep)) return;

    return {
      block: true,
      reason:
        `ワークフローフェーズが「${run.phase}」のため、ファイル編集はブロックされました。\n` +
        "このセッションは要件定義・計画フェーズです。コードを変更したい場合は:\n" +
        "- ワークフローに乗る場合: 要件を requirements.md に保存し /wf-plan → /wf-code で実行\n" +
        "- ワークフローを使わない場合: /wf-skip でガードを一時解除できます",
    };
  });

  // ---------------------------------------------------------------
  // /wf-skip : ガードを一時解除してワークフロー外で作業する
  // ---------------------------------------------------------------
  pi.registerCommand("wf-skip", {
    description: "Temporarily disable the workflow edit guard",
    handler: async (_args, ctx) => {
      guardDisabled = true;
      ctx.ui.notify(
        "Workflow edit guard disabled for this session.",
        "warning",
      );
    },
  });

  // ---------------------------------------------------------------
  // DISCOVERY 中のシステムプロンプト注入: 要件が固まったらモデルのほうから
  // requirements.md への書き出しを提案するよう誘導する。
  // ---------------------------------------------------------------
  pi.on("before_agent_start", async (event, ctx) => {
    const run = getRun();
    if (!run || run.phase !== "DISCOVERY" || guardDisabled) return;
    if (fs.existsSync(path.join(runDir(run), "requirements.md"))) return; // 既に書き出し済みなら介入しない
    // 注意: systemPrompt への変更は戻り値で返す必要がある（直接代入は無効）
    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n[ワークフロー: 要件定義フェーズ]\n` +
      `このセッションは現在要件定義フェーズです。コードファイルの編集は禁止されています（.pi/workflow/${run.runId}/ 配下を除く）。\n` +
      `- ユーザーとの対話で目的・機能要件・非機能要件・スコープ外事項を明確にするファシリテーターとして振る舞ってください。\n` +
      `- 1回の応答で質問は最大3つまでに抑え、要約を短く保ってください。\n` +
      `- 対話が進み、これ以上聞くことがないと判断したタイミングで、自ら「要件を requirements.md に書き出しましょうか？」と提案してください。\n` +
      `- 提案が承認されたら、合意した要件を .pi/workflow/${run.runId}/requirements.md に書き出してください（このパスへの write は許可されています）。\n` +
      `- 書き出したら「その後 /wf-plan を実行してください」と案内してください。`,
    };
  });

  // ---------------------------------------------------------------
  // /wf-req : 今の会話から要件ドラフトを requirements.md に書き出させる
  // ---------------------------------------------------------------
  pi.registerCommand("wf-req", {
    description:
      "Have the model summarize the conversation into requirements.md",
    handler: async (_args, ctx) => {
      const run = getRun();
      if (!run) {
        ctx.ui.notify("No active run. Use /wf-new first.", "error");
        return;
      }
      await ctx.sendUserMessage(
        `ここまでの会話内容から要件を整理し、.pi/workflow/${run.runId}/requirements.md に書き出してください。\n` +
          "構成: 目的 / 機能要件 / 非機能要件 / スコープ外事項 / 未確定事項。" +
          "未確定事項は推測で埋めず、そのまま「未確定」と記録してください。" +
          "書き出したら内容を簡潔に報告し、修正点があれば伝えてください。",
      );
      ctx.ui.notify("Asked the model to draft requirements.md.", "info");
    },
  });

  async function createBaseCommit(
    ctx: any,
  ): Promise<string> {
    // 作業ツリー変更＋未追跡ファイルも含めたスナップショットを stash commit として記録する。
    // 履歴には現れずブランチも汚さない。レビュー時は `git diff refs/wf/base-commit` の基準に使う。
    await pi.exec("git", ["add", "-A"]); // untracked を含めるため一旦ステージ
    const res = await pi.exec("git", [
      "stash",
      "create",
    ]);
    await pi.exec("git", ["reset", "--quiet"]); // ステージング状態を元に戻す（作業ツリーは不変）
    const ref = res.stdout?.trim();
    if (!ref)
      throw new Error(
        "failed to create base commit via git stash create",
      );
    await pi.exec("git", [
      "update-ref",
      "refs/wf/base-commit",
      ref,
    ]); // GC 対策で参照を保持
    ctx.ui.notify(
      `Base commit created: ${ref.slice(0, 12)} (refs/wf/base-commit)`,
      "info",
    );
    return ref;
  }

  pi.registerCommand("wf-code", {
    description:
      "Run coder model on plan.md tasks (optionally filtered by task numbers)",
    getArgumentCompletions: (prefix) =>
      prefix
        ? null
        : [
            {
              value: "all",
              label: "all - pass entire plan.md",
            },
          ],
    handler: async (args, ctx) => {
      const run = getRun();
      if (!run) {
        ctx.ui.notify(
          "No active run. Use /wf-new first.",
          "error",
        );
        return;
      }
      const planPath = path.join(
        runDir(run),
        "plan.md",
      );
      if (!fs.existsSync(planPath)) {
        ctx.ui.notify(
          `plan.md not found at ${planPath}. Run /wf-plan first.`,
          "error",
        );
        return;
      }

      const planText = fs.readFileSync(
        planPath,
        "utf8",
      );
      let taskSection: string;
      const spec = parseTaskSpec(args ?? "");
      if (spec.size > 0) {
        const tasks = extractTasks(
          planText,
        ).filter((t) => spec.has(t.num));
        if (tasks.length === 0) {
          ctx.ui.notify(
            `No tasks matched spec "${args}". Found task numbers: ${
              extractTasks(planText)
                .map((t) => t.num)
                .join(", ") || "(none)"
            }`,
            "error",
          );
          return;
        }
        taskSection = tasks
          .map((t) => t.text)
          .join("\n\n");
      } else {
        taskSection = planText;
      }

      try {
        await createBaseCommit(ctx);
      } catch (err) {
        ctx.ui.notify(
          `/wf-code aborted: could not create base commit: ${(err as Error).message}`,
          "error",
        );
        return;
      }

      ctx.ui.setStatus(
        "wf",
        `CODING (${CODER_MODEL.split("/").pop()})...`,
      );

      const prompt = [
        "あなたは実装専用のコーダーです。設計判断や提案は一切せず、以下のタスクを機械的に実装してください。",
        "",
        "厳守事項:",
        "- edit / write ツールを使ってコードを実際に変更すること。",
        "- タスクに書かれていない余計な変更（リファクタ・フォーマット修正等）をしないこと。",
        "- 実装方法に迷った場合は、より単純で安全な側を選ぶこと。",
        "- 最後に、変更したファイルの一覧のみを出力すること（説明文は不要）。",
        "",
        "--- 実装タスク ---",
        taskSection,
      ].join("\n");

      try {
        const result = await pi.exec(
          "pi",
          ["-p", "--model", CODER_MODEL, prompt],
          { timeout: 900_000 },
        );
        if (result.code !== 0) {
          throw new Error(
            result.stderr?.slice(0, 500) ||
              `coder exited with code ${result.code}`,
          );
        }

        run.phase = "REVIEW";
        run.updatedAt = new Date().toISOString();
        writeJson(CURRENT_FILE, run);
        ctx.ui.setStatus(
          "wf",
          `[${run.runId}] REVIEW`,
        );
        ctx.ui.notify(
          `Coding done. Coder output:\n${(result.stdout ?? "").trim().slice(-1000)}\n\nNext: /wf-review`,
          "info",
        );
      } catch (err) {
        ctx.ui.setStatus(
          "wf",
          `[${run.runId}] CODE_FAILED`,
        );
        ctx.ui.notify(
          `/wf-code failed: ${(err as Error).message}\nRollback if needed with: git checkout . && git clean -fd`,
          "error",
        );
      }
    },
  });

  // ---------------------------------------------------------------
  // /wf-plan : プランナー(Kimi K2.7 Code)をサブプロセスで呼び出す
  //   - requirements.md が必須
  //   - 消費前に確認ダイアログ（高額リソースのため人間承認を挟む）
  // ---------------------------------------------------------------
  pi.registerCommand("wf-plan", {
    description:
      "Generate plan.md from requirements.md using the planner model",
    handler: async (_args, ctx) => {
      const run = getRun();
      if (!run) {
        ctx.ui.notify(
          "No active run. Use /wf-new first.",
          "error",
        );
        return;
      }
      const reqPath = path.join(
        runDir(run),
        "requirements.md",
      );
      if (!fs.existsSync(reqPath)) {
        ctx.ui.notify(
          `requirements.md not found at ${reqPath}\nDefine requirements first, then save them there.`,
          "error",
        );
        return;
      }

      const budget = readJson<{
        month: string;
        used: number;
      }>(BUDGET_FILE);
      const usedThisMonth =
        budget &&
        budget.month ===
          new Date().toISOString().slice(0, 7)
          ? budget.used
          : 0;

      // 高価なモデルなので、消費前に必ず人間承認を挟む
      const ok = await ctx.ui.confirm(
        "/wf-plan",
        `Consume 1 planner request?\nModel: ${PLANNER_MODEL}\nMonthly usage: ${usedThisMonth}/${PLANNER_MONTHLY_LIMIT}`,
      );
      if (!ok) return;

      ctx.ui.setStatus(
        "wf",
        "PLANNING (Kimi K2.7 Code)...",
      );

      const prompt = [
        "あなたは超詳細な実装プランを作成するプランナーです。",
        "以下の requirements.md を読み、実装計画 plan.md を Markdown で出力してください。",
        "",
        "厳守事項:",
        "- 実行者は33B params/3B active の小型コーダーモデルです。暗黙の判断は一切できません。",
        "- 各タスクには「対象ファイルのパス」「対象関数/コンポーネント名」「変更理由」を明記すること。",
        "- 可能なら変更前後のコード例を示すこと。",
        "- タスクは番号付きチェックリスト形式にし、各タスクが独立して実行可能な粒度に分割すること。",
        "- コードは書かず、plan.md の内容のみを出力すること（前置き・後書き不要）。",
        "- Astro ブログプロジェクト (Astro v5, Content Collections) 向けの計画であることに注意。",
        "",
        "--- requirements.md ---",
        fs.readFileSync(reqPath, "utf8"),
      ].join("\n");

      try {
        const result = await pi.exec(
          "pi",
          [
            "-p",
            "--model",
            PLANNER_MODEL,
            prompt,
          ],
          { timeout: 600_000 },
        );
        if (
          result.code !== 0 ||
          !result.stdout?.trim()
        ) {
          throw new Error(
            result.stderr?.slice(0, 500) ||
              "empty output from planner",
          );
        }

        const planPath = path.join(
          runDir(run),
          "plan.md",
        );
        fs.writeFileSync(
          planPath,
          result.stdout.trimEnd() + "\n",
        );

        run.phase = "CODING";
        run.updatedAt = new Date().toISOString();
        writeJson(CURRENT_FILE, run);

        const b = consumePlannerBudget();
        ctx.ui.setStatus(
          "wf",
          `[${run.runId}] ${run.phase}`,
        );
        ctx.ui.notify(
          `plan.md written to ${planPath}\nPlanner usage this month: ${b.used}/${PLANNER_MONTHLY_LIMIT}`,
          "info",
        );
      } catch (err) {
        ctx.ui.setStatus(
          "wf",
          `[${run.runId}] PLAN_FAILED`,
        );
        ctx.ui.notify(
          `/wf-plan failed: ${(err as Error).message}`,
          "error",
        );
      }
    },
  });

  // ---------------------------------------------------------------
  // /wf-review : レビュアー(laguna-s)で requirements/plan/差分 を検証する
  //   - 入力: requirements.md, plan.md, git diff refs/wf/base-commit
  //   - 出力: 判定 VERDICT (PASS / FAIL_CODER / FAIL_PLAN / FAIL_REQ)
  //   - FAIL 時は理由と改善指示を review_feedback.md に保存（自動ループはしない）
  // ---------------------------------------------------------------
  pi.registerCommand("wf-review", {
    description:
      "Review the coder's changes and decide PASS or where to send back",
    handler: async (_args, ctx) => {
      const run = getRun();
      if (!run) {
        ctx.ui.notify(
          "No active run. Use /wf-new first.",
          "error",
        );
        return;
      }
      const dir = runDir(run);
      const reqPath = path.join(
        dir,
        "requirements.md",
      );
      const planPath = path.join(dir, "plan.md");
      for (const p of [reqPath, planPath]) {
        if (!fs.existsSync(p)) {
          ctx.ui.notify(
            `${path.basename(p)} not found at ${p}`,
            "error",
          );
          return;
        }
      }

      // ベースコミットからの差分を取得
      const diff = await pi.exec("git", [
        "diff",
        "refs/wf/base-commit",
      ]);
      const diffText = diff.stdout ?? "";
      if (!diffText.trim()) {
        ctx.ui.notify(
          "No diff against refs/wf/base-commit. Coder may not have changed anything — check /wf-code output before reviewing.",
          "error",
        );
        return;
      }

      ctx.ui.setStatus(
        "wf",
        "REVIEW (laguna-s)... (may be slow depending on time of day)",
      );

      const prompt = [
        "あなたは批判的に検証するレビュアーです。以下の3つの成果物の整合性を検証してください。",
        "",
        "検証基準:",
        "- plan 通りに実装されているか（実装漏れ・タイポ・ロジックミスは FAIL_CODER）",
        "- plan 自体に考慮漏れ・矛盾がないか（コーダーが実装できなかった原因がプランなら FAIL_PLAN）",
        "- 要件とコードに致命的なギャップがないか（前提が崩れているなら FAIL_REQ）",
        "問題なければ PASS。",
        "",
        "出力形式（厳守）:",
        "1. 検証結果の説明（日本語、簡潔に）",
        "2. 最終行に必ず次のいずれか1行を含めること:",
        "   VERDICT: PASS",
        "   VERDICT: FAIL_CODER   （コーダーへ差し戻し）",
        "   VERDICT: FAIL_PLAN    （プランナーへ差し戻し）",
        "   VERDICT: FAIL_REQ     （要件定義へ差し戻し）",
        "FAIL の場合は改善指示を具体的に含めること。コードは書かないこと。",
        "",
        "--- requirements.md ---",
        fs.readFileSync(reqPath, "utf8"),
        "",
        "--- plan.md ---",
        fs.readFileSync(planPath, "utf8"),
        "",
        "--- git diff ---",
        diffText,
      ].join("\n");

      try {
        const result = await pi.exec(
          "pi",
          [
            "-p",
            "--model",
            REVIEWER_MODEL,
            prompt,
          ],
          { timeout: 900_000 },
        );
        if (
          result.code !== 0 ||
          !result.stdout?.trim()
        ) {
          throw new Error(
            result.stderr?.slice(0, 500) ||
              "empty output from reviewer",
          );
        }
        const reviewText =
          result.stdout.trimEnd() + "\n";

        const verdictMatch = reviewText.match(
          /^VERDICT:\s*(PASS|FAIL_CODER|FAIL_PLAN|FAIL_REQ)\s*$/m,
        );
        const verdict = verdictMatch?.[1] ?? null;

        let summary = `Review complete.${verdict ? ` Verdict: ${verdict}` : "\n⚠ Could not parse VERDICT line from reviewer output — read the full text below."}\n\n${reviewText.slice(-1500)}`;

        if (verdict === "PASS") {
          run.phase = "DONE";
        } else if (verdict === "FAIL_CODER") {
          run.phase = "CODING";
          fs.writeFileSync(
            path.join(dir, "review_feedback.md"),
            reviewText,
          );
          summary += `\n\nSaved to review_feedback.md. Next: /wf-code （該当タスク番号を指定して再実行）`;
        } else if (verdict === "FAIL_PLAN") {
          run.phase = "PLANNING";
          fs.writeFileSync(
            path.join(dir, "review_feedback.md"),
            reviewText,
          );
          summary += `\n\nSaved to review_feedback.md. Next: /wf-plan （⚠ プランナー予算を1消費します）`;
        } else if (verdict === "FAIL_REQ") {
          run.phase = "DISCOVERY";
          fs.writeFileSync(
            path.join(dir, "review_feedback.md"),
            reviewText,
          );
          summary += `\n\nSaved to review_feedback.md. Next: メインセッションで要件を再検討し requirements.md を更新`;
        }

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
      } catch (err) {
        ctx.ui.setStatus(
          "wf",
          `[${run.runId}] ${run.phase}`,
        ); // フェーズを変更しない
        ctx.ui.notify(
          `/wf-review failed: ${(err as Error).message}`,
          "error",
        );
      }
    },
  });
}
