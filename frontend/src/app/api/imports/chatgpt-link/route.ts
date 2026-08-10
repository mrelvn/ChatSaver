import { NextResponse } from "next/server";
import { readChatGptShareLink } from "@/lib/import/chatgpt-share.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const url =
      typeof body === "object" && body !== null && "url" in body && typeof body.url === "string"
        ? body.url
        : "";

    if (!url || url.length > 512) {
      return NextResponse.json({ error: "Paste a valid ChatGPT shared link." }, { status: 400 });
    }

    const conversation = await readChatGptShareLink(url);
    return NextResponse.json({ conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The shared chat could not be read.";
    const status = message.includes("temporarily refused") ? 502 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
