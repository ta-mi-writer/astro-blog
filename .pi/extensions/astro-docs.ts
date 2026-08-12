// @ts-nocheck
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MCP_URL =
  "https://mcp.docs.astro.build/mcp";
const MCP_PROTOCOL_VERSION = "2024-11-05";

// インメモリキャッシュ（セッション内のみ有効）
const cache = new Map<
  string,
  { data: unknown; timestamp: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

// SSEイベントパース
function parseSSE(text: string): Array<{
  event?: string;
  data: string;
  id?: string;
}> {
  const events: Array<{
    event?: string;
    data: string;
    id?: string;
  }> = [];
  let currentEvent: {
    event?: string;
    data: string;
    id?: string;
  } = { data: "" };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (currentEvent.data) {
        events.push(currentEvent);
        currentEvent = { data: "" };
      }
      continue;
    }
    if (trimmed.startsWith(":")) continue; // コメント
    if (trimmed.startsWith("event:")) {
      currentEvent.event = trimmed
        .slice(6)
        .trim();
    } else if (trimmed.startsWith("data:")) {
      currentEvent.data +=
        (currentEvent.data ? "\n" : "") +
        trimmed.slice(5).trim();
    } else if (trimmed.startsWith("id:")) {
      currentEvent.id = trimmed.slice(3).trim();
    }
  }
  if (currentEvent.data)
    events.push(currentEvent);
  return events;
}

// MCPリクエスト送信（一括読み込みによる高速化版）
async function mcpRequest(
  method: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: requestId,
    method,
    params,
  });

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept:
        "application/json, text/event-stream",
      "MCP-Protocol-Version":
        MCP_PROTOCOL_VERSION,
    },
    body,
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `MCP HTTP error: ${response.status} ${response.statusText}`,
    );
  }

  // レスポンス全体をテキストとしてまとめて受信
  const responseText = await response.text();

  // 1. 通常の JSON-RPC レスポンスの場合
  try {
    const json = JSON.parse(responseText);
    if (json.error) {
      throw new Error(
        `MCP error: ${json.error.message} (code: ${json.error.code})`,
      );
    }
    if (json.result !== undefined)
      return json.result;
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.startsWith("MCP error:")
    )
      throw e;
  }

  // 2. SSE（Server-Sent Events）形式の場合
  const events = parseSSE(responseText);
  for (const event of events) {
    if (event.data) {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.id === requestId) {
          if (parsed.error) {
            throw new Error(
              `MCP error: ${parsed.error.message} (code: ${parsed.error.code})`,
            );
          }
          return parsed.result;
        }
      } catch (e) {
        if (
          e instanceof Error &&
          e.message.startsWith("MCP error:")
        )
          throw e;
      }
    }
  }

  throw new Error("MCP response not received");
}

// MCP初期化
async function initializeMCP(
  signal?: AbortSignal,
): Promise<void> {
  await mcpRequest(
    "initialize",
    {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "pi-astro-docs",
        version: "1.0.0",
      },
    },
    signal,
  );
}

// ツール一覧取得
async function listTools(
  signal?: AbortSignal,
): Promise<
  Array<{
    name: string;
    description: string;
    inputSchema: unknown;
  }>
> {
  const result = (await mcpRequest(
    "tools/list",
    {},
    signal,
  )) as {
    tools: Array<{
      name: string;
      description: string;
      inputSchema: unknown;
    }>;
  };
  return result.tools;
}

// ツール呼び出し
async function callTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return mcpRequest(
    "tools/call",
    { name, arguments: args },
    signal,
  );
}

// キャッシュ設定・取得関数
function getCacheKey(
  query: string,
  limit: number,
): string {
  return `${query}|${limit}`;
}

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (
    Date.now() - entry.timestamp >
    CACHE_TTL_MS
  ) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(
  key: string,
  data: unknown,
): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export default function (pi: ExtensionAPI) {
  let initialized = false;

  async function ensureInitialized(
    signal?: AbortSignal,
  ): Promise<void> {
    if (initialized) return;
    await initializeMCP(signal);
    const tools = await listTools(signal);
    const hasSearch = tools.some(
      (t) => t.name === "search_astro_docs",
    );
    if (!hasSearch) {
      throw new Error(
        "MCP server does not provide 'search_astro_docs' tool",
      );
    }
    initialized = true;
  }

  pi.registerTool({
    name: "astro_docs_search",
    label: "Search Astro Docs",
    description:
      "Search the latest Astro documentation via the official MCP server. Use this when answering questions about Astro or writing Astro code to get up-to-date information.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "Search query (e.g., 'content collections', 'astro add tailwind', 'middleware')",
      }),
      limit: Type.Optional(
        Type.Number({
          description:
            "Maximum number of results (1-20)",
          default: 5,
          minimum: 1,
          maximum: 20,
        }),
      ),
    }),
    async execute(
      toolCallId,
      params,
      signal,
      onUpdate,
      ctx,
    ) {
      const { query, limit = 5 } = params;

      const cacheKey = getCacheKey(query, limit);
      const cached = getCached(cacheKey);
      if (cached) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                cached,
                null,
                2,
              ),
            },
          ],
          details: { cached: true },
        };
      }

      try {
        await ensureInitialized(signal);

        const result = (await callTool(
          "search_astro_docs",
          { query, limit },
          signal,
        )) as {
          content: Array<{
            type: "text";
            text: string;
          }>;
        };

        const formattedResults =
          result.content.map((c) => {
            try {
              return JSON.parse(c.text);
            } catch {
              return { text: c.text };
            }
          });

        setCache(cacheKey, formattedResults);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                formattedResults,
                null,
                2,
              ),
            },
          ],
          details: {
            query,
            count: formattedResults.length,
            cached: false,
          },
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error searching Astro docs: ${message}`,
            },
          ],
          details: { error: message },
          isError: true,
        };
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(
      "Astro Docs MCP extension loaded",
      "info",
    );
  });
}
