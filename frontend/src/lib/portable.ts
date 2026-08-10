import type { Note, NoteBlock, VaultBackup } from "@/domain/models";
import { toPlainText } from "@/lib/plain-text";

function safeFilename(value: string): string {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 90);
  return normalized || "untitled-note";
}

export function noteToPlainText(note: Note, blocks: NoteBlock[]): string {
  const separator = "=".repeat(72);
  const sections = [...blocks]
    .sort((left, right) => left.position - right.position)
    .map((block, index) => {
      const question = toPlainText(block.question) || "Untitled question";
      const answer = toPlainText(block.answer) || "No answer yet.";
      return [
        `QUESTION ${index + 1}`,
        question,
        separator,
        `ANSWER ${index + 1}`,
        answer,
        separator,
      ].join("\n\n");
    });

  const title = toPlainText(note.title) || "Untitled note";

  return [
    separator,
    title,
    separator,
    "",
    `Exported from ChatSaver on ${new Date().toLocaleDateString()}.`,
    "",
    separator,
    "",
    ...sections.flatMap((section, index) => (index ? ["", section] : [section])),
    "",
  ].join("\n");
}

export function downloadTextFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadNoteText(note: Note, blocks: NoteBlock[]): void {
  downloadTextFile(
    `${safeFilename(note.title)}.txt`,
    noteToPlainText(note, blocks),
    "text/plain;charset=utf-8",
  );
}

export async function shareNoteOffline(
  note: Note,
  blocks: NoteBlock[],
): Promise<"shared" | "downloaded"> {
  const plainText = noteToPlainText(note, blocks);
  const filename = `${safeFilename(note.title)}.txt`;
  const file = new File([plainText], filename, { type: "text/plain" });
  const isWindows = /Windows/i.test(navigator.userAgent);

  if (
    !isWindows &&
    navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    await navigator.share({ files: [file] });
    return "shared";
  }

  downloadTextFile(filename, plainText, "text/plain;charset=utf-8");
  return "downloaded";
}

export function downloadVaultBackup(backup: VaultBackup): void {
  const day = backup.exportedAt.slice(0, 10);
  downloadTextFile(
    `chatsaver-vault-${day}.json`,
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8",
  );
}
