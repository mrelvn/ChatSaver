import "server-only";

import { unflatten } from "devalue";
import type { NormalizedConversation } from "@/domain/models";
import { normalizeChatGptConversation } from "@/lib/import/chatgpt";

const MAX_PAGE_BYTES = 12 * 1024 * 1024;
const SHARE_PATH = /^\/share\/([a-zA-Z0-9_-]{16,128})\/?$/;
const STREAM_CHUNK =
  /__reactRouterContext\.streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeShareUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Paste a complete ChatGPT shared link.");
  }

  if (parsed.protocol !== "https:" || !["chatgpt.com", "www.chatgpt.com"].includes(parsed.hostname)) {
    throw new Error("Use a public link beginning with https://chatgpt.com/share/.");
  }

  const match = SHARE_PATH.exec(parsed.pathname);
  if (!match) {
    throw new Error("This is not a ChatGPT shared-conversation link.");
  }

  return new URL(`https://chatgpt.com/share/${match[1]}`);
}

function decodeRouterPayload(serialized: string): unknown {
  const flat: unknown = JSON.parse(serialized);
  if (!Array.isArray(flat)) throw new Error("Invalid shared conversation payload.");

  const keyTable = [...flat];
  for (let index = 0; index < flat.length; index += 1) {
    const value = flat[index];

    // ChatGPT streams unresolved telemetry promises as self-referencing P markers.
    // They are unrelated to the shared conversation and cannot be revived by devalue.
    if (Array.isArray(value) && value[0] === "P") {
      flat[index] = null;
      continue;
    }

    if (!isObject(value)) continue;
    const decoded: JsonObject = Object.create(null) as JsonObject;

    for (const [encodedKey, child] of Object.entries(value)) {
      const keyReference = /^_(\d+)$/.exec(encodedKey);
      const referencedKey = keyReference ? keyTable[Number(keyReference[1])] : undefined;
      const key = typeof referencedKey === "string" ? referencedKey : encodedKey;
      if (key === "__proto__") throw new Error("Unsafe shared conversation payload.");
      Object.defineProperty(decoded, key, {
        value: child,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }

    flat[index] = decoded;
  }

  return unflatten(flat);
}

function findConversation(root: unknown): JsonObject | undefined {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  const visited = new Set<object>();
  let inspected = 0;

  while (queue.length && inspected < 20_000) {
    const next = queue.shift();
    if (!next || next.depth > 18 || !next.value || typeof next.value !== "object") continue;
    if (visited.has(next.value)) continue;
    visited.add(next.value);
    inspected += 1;

    if (
      isObject(next.value) &&
      isObject(next.value.mapping) &&
      typeof next.value.title === "string"
    ) {
      return next.value;
    }

    for (const child of Object.values(next.value)) {
      queue.push({ value: child, depth: next.depth + 1 });
    }
  }

  return undefined;
}

function conversationFromHtml(html: string): NormalizedConversation | undefined {
  for (const match of html.matchAll(STREAM_CHUNK)) {
    let chunk: string;
    try {
      chunk = JSON.parse(match[1]) as string;
    } catch {
      continue;
    }
    if (!chunk.trimStart().startsWith("[")) continue;

    try {
      const conversation = findConversation(decodeRouterPayload(chunk));
      if (!conversation) continue;
      const normalized = normalizeChatGptConversation(conversation);
      if (normalized && normalized.messages.length > 0) return normalized;
    } catch {
      continue;
    }
  }

  return undefined;
}

export async function readChatGptShareLink(input: string): Promise<NormalizedConversation> {
  const shareUrl = normalizeShareUrl(input);
  const response = await fetch(shareUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(18_000),
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
  });

  if (response.status === 404) {
    throw new Error("That shared chat no longer exists or is not public.");
  }
  if (!response.ok || response.headers.get("cf-mitigated") === "challenge") {
    throw new Error("ChatGPT temporarily refused the shared link. Try again in a moment.");
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PAGE_BYTES) throw new Error("This shared chat is too large to import.");

  const html = await response.text();
  if (html.length > MAX_PAGE_BYTES) throw new Error("This shared chat is too large to import.");

  const conversation = conversationFromHtml(html);
  if (!conversation) {
    throw new Error(
      "ChatSaver could not read this link. Confirm it opens publicly without signing in.",
    );
  }

  return conversation;
}
