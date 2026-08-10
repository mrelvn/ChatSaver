const PREFERRED_TEXT_KEYS = [
  "text",
  "parts",
  "content",
  "value",
  "output_text",
  "result",
  "caption",
] as const;

const METADATA_KEYS = new Set([
  "id",
  "type",
  "content_type",
  "asset_pointer",
  "metadata",
  "status",
  "model",
]);

function labelFor(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function extractPlainText(value: unknown, seen: WeakSet<object>, depth: number): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined || depth > 12) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => extractPlainText(item, seen, depth + 1))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  if (typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  const record = value as Record<string, unknown>;

  for (const key of PREFERRED_TEXT_KEYS) {
    if (!(key in record)) continue;
    const text = extractPlainText(record[key], seen, depth + 1);
    if (text) return text;
  }

  const contentType = typeof record.content_type === "string" ? record.content_type : "";
  if (contentType.includes("image")) return "[Image attachment]";
  if (contentType.includes("audio")) return "[Audio attachment]";

  return Object.entries(record)
    .filter(([key]) => !METADATA_KEYS.has(key))
    .map(([key, child]) => {
      const text = extractPlainText(child, seen, depth + 1);
      return text ? `${labelFor(key)}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function removeMarkdownFormatting(value: string): string {
  return value
    .replace(/^\s*```[^\n]*\n?/gm, "")
    .replace(/^\s*~~~[^\n]*\n?/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,!?;:]|$)/g, "$1$2")
    .replace(/<[^>]+>/g, "")
    .replace(/[•◦▪▫◆◇►▶→⇒✓✔✅❌⚠★☆]+/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toPlainText(value: unknown): string {
  const extracted = extractPlainText(value, new WeakSet<object>(), 0).replace(/\r\n?/g, "\n");
  return removeMarkdownFormatting(extracted);
}
