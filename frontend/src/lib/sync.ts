import type {
  Conversation,
  Message,
  Note,
  NoteBlock,
  OutboxMutation,
} from "@/domain/models";
import { db } from "@/lib/db/database";

const API_ROOT = "";

export interface AccountUser {
  id: string;
  email: string;
  displayName?: string;
}

export interface AuthSession {
  user: AccountUser;
  accessToken: string;
  expiresAt: string;
}

export interface RegistrationChallenge {
  email: string;
  expiresAt: string;
}

export interface VaultSocketMessage {
  type: "vault.changed";
  cursor: number;
  occurredAt: string;
}

interface SocketTicket {
  ticket: string;
  expiresAt: string;
}

interface VaultSnapshot {
  conversations: Conversation[];
  messages: Message[];
  notes: Note[];
  noteBlocks: NoteBlock[];
  deleted: {
    conversations: string[];
    messages: string[];
    notes: string[];
    noteBlocks: string[];
  };
  cursor: number;
}

function deviceId(email: string): string {
  const accountKey = email.trim().toLocaleLowerCase();
  const key = `chatsaver-device-id:${accountKey}`;
  const current = localStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new Error(
      API_ROOT
        ? "ChatSaver could not reach its server. Make sure the backend is running and try again."
        : "Account sync is not configured for this deployment yet.",
    );
  }
  const responseText = await response.text();
  if (!response.ok) {
    const body = (() => {
      try {
        return responseText ? JSON.parse(responseText) as { detail?: string; message?: string } : null;
      } catch {
        return null;
      }
    })();
    throw new Error(body?.detail ?? body?.message ?? `Request failed (${response.status}).`);
  }
  if (!responseText) return undefined as T;
  return JSON.parse(responseText) as T;
}

export function requestRegistration(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<RegistrationChallenge> {
  return request("/api/v1/auth/register/request", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      deviceId: deviceId(input.email),
      deviceName: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser",
    }),
  });
}

export function verifyRegistration(input: { email: string; code: string }): Promise<AuthSession> {
  return request("/api/v1/auth/register/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginAccount(input: { email: string; password: string }): Promise<AuthSession> {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      deviceId: deviceId(input.email),
      deviceName: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser",
    }),
  });
}

export function refreshAccount(): Promise<AuthSession> {
  return request("/api/v1/auth/refresh", { method: "POST", body: "{}" });
}

export function logoutAccount(): Promise<void> {
  return request("/api/v1/auth/logout", { method: "POST", body: "{}" });
}

export async function openVaultSocket(accessToken: string): Promise<WebSocket> {
  const issued = await request<SocketTicket>("/api/v1/realtime/socket-ticket", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: "{}",
  });
  const configuredRoot = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
  const httpRoot = configuredRoot
    || (process.env.NODE_ENV === "production" ? window.location.origin : "http://localhost:8080");
  const socketRoot = httpRoot
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:")
    .replace(/\/$/, "");
  return new WebSocket(`${socketRoot}/ws/sync?ticket=${encodeURIComponent(issued.ticket)}`);
}

export function parseVaultSocketMessage(value: unknown): VaultSocketMessage | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const message = JSON.parse(value) as Partial<VaultSocketMessage>;
    if (
      message.type !== "vault.changed"
      || !Number.isSafeInteger(message.cursor)
      || typeof message.occurredAt !== "string"
    ) {
      return undefined;
    }
    return message as VaultSocketMessage;
  } catch {
    return undefined;
  }
}

export function eraseSyncedVault(accessToken: string): Promise<void> {
  return request("/api/v1/sync/vault", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function synchronizeVault(
  accessToken: string,
  userId: string,
): Promise<{ pushed: number; pulled: number }> {
  const pending = (await db.outbox.toArray()).sort((left, right) => {
    const orderDifference = mutationSyncOrder(left) - mutationSyncOrder(right);
    if (orderDifference !== 0) return orderDifference;
    return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  });
  let pushed = 0;

  for (let offset = 0; offset < pending.length; offset += 100) {
    const batch = pending.slice(offset, offset + 100);
    try {
      await pushMutations(accessToken, batch);
    } catch (error) {
      if (
        !(error instanceof Error)
        || !error.message.includes("A related record has not been synced yet.")
      ) {
        throw error;
      }

      const repairs = await relatedRecordRepairs(batch);
      if (repairs.length === 0) throw error;
      for (let repairOffset = 0; repairOffset < repairs.length; repairOffset += 100) {
        await pushMutations(accessToken, repairs.slice(repairOffset, repairOffset + 100));
      }
      await pushMutations(accessToken, batch);
    }
    await deleteUnchangedMutations(batch);
    pushed += batch.length;
  }

  const cursorKey = `server-cursor:${userId}`;
  const syncMetadata = await db.syncMetadata.get(cursorKey);
  const after = syncMetadata && Number.isSafeInteger(syncMetadata.value) ? syncMetadata.value : 0;
  const snapshot = await request<VaultSnapshot>(`/api/v1/sync/snapshot?after=${after}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await applySnapshot(snapshot, cursorKey);
  return {
    pushed,
    pulled:
      snapshot.conversations.length
      + snapshot.messages.length
      + snapshot.notes.length
      + snapshot.noteBlocks.length,
  };
}

function pushMutations(
  accessToken: string,
  mutations: OutboxMutation[],
): Promise<{ accepted: number }> {
  return request<{ accepted: number }>("/api/v1/sync/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ mutations }),
  });
}

async function relatedRecordRepairs(batch: OutboxMutation[]): Promise<OutboxMutation[]> {
  const batchKeys = new Set(batch.map((item) => `${item.entityType}:${item.entityId}`));
  const repairs = new Map<string, OutboxMutation>();

  async function addConversation(conversationId: string): Promise<void> {
    const key = `conversation:${conversationId}`;
    if (batchKeys.has(key) || repairs.has(key)) return;
    const conversation = await db.conversations.get(conversationId);
    if (conversation) repairs.set(key, repairMutation("conversation", conversation));
  }

  async function addNote(noteId: string): Promise<void> {
    const key = `note:${noteId}`;
    if (batchKeys.has(key) || repairs.has(key)) return;
    const note = await db.notes.get(noteId);
    if (!note) return;
    if (note.conversationId) await addConversation(note.conversationId);
    repairs.set(key, repairMutation("note", note));
  }

  for (const mutation of batch) {
    if (
      mutation.operation === "delete"
      || typeof mutation.payload !== "object"
      || mutation.payload === null
    ) {
      continue;
    }
    const payload = mutation.payload as Record<string, unknown>;
    if (
      (mutation.entityType === "message" || mutation.entityType === "note")
      && typeof payload.conversationId === "string"
    ) {
      await addConversation(payload.conversationId);
    }
    if (mutation.entityType === "noteBlock" && typeof payload.noteId === "string") {
      await addNote(payload.noteId);
    }
  }

  return [...repairs.values()].sort(
    (left, right) => mutationSyncOrder(left) - mutationSyncOrder(right),
  );
}

function repairMutation(
  entityType: OutboxMutation["entityType"],
  entity: Conversation | Note,
): OutboxMutation {
  return {
    id: crypto.randomUUID(),
    entityType,
    entityId: entity.id,
    operation: "create",
    payload: entity,
    createdAt: entity.createdAt,
    attempts: 0,
  };
}

function mutationSyncOrder(mutation: OutboxMutation): number {
  if (mutation.operation === "delete") {
    return {
      noteBlock: 3,
      message: 3,
      note: 4,
      conversation: 5,
    }[mutation.entityType];
  }

  return {
    conversation: 0,
    message: 1,
    note: 1,
    noteBlock: 2,
  }[mutation.entityType];
}

async function deleteUnchangedMutations(sent: OutboxMutation[]): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const mutation of sent) {
      const current = await db.outbox.get(mutation.id);
      if (current && JSON.stringify(current.payload) === JSON.stringify(mutation.payload)) {
        await db.outbox.delete(mutation.id);
      }
    }
  });
}

async function applySnapshot(snapshot: VaultSnapshot, cursorKey: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.conversations, db.messages, db.notes, db.noteBlocks, db.outbox, db.syncMetadata],
    async () => {
      const pending = await db.outbox.toArray();
      const pendingKeys = new Set(pending.map((item) => `${item.entityType}:${item.entityId}`));

      const remoteBlocks = snapshot.noteBlocks.filter(
        (block) => !pendingKeys.has(`noteBlock:${block.id}`),
      );
      const messagesByConversation = new Map<string, number>();
      for (const message of snapshot.messages) {
        messagesByConversation.set(
          message.conversationId,
          (messagesByConversation.get(message.conversationId) ?? 0) + 1,
        );
      }

      const conversations = snapshot.conversations
        .filter((item) => !pendingKeys.has(`conversation:${item.id}`))
        .map((item) => ({
          ...item,
          messageCount: messagesByConversation.get(item.id) ?? item.messageCount,
          syncStatus: "synced" as const,
        }));
      const messages = snapshot.messages
        .filter((item) => !pendingKeys.has(`message:${item.id}`))
        .map((item) => ({ ...item, syncStatus: "synced" as const }));
      await db.noteBlocks.bulkPut(remoteBlocks.map((item) => ({ ...item, syncStatus: "synced" })));
      const notes: Note[] = [];
      for (const item of snapshot.notes.filter(
        (candidate) => !pendingKeys.has(`note:${candidate.id}`),
      )) {
        const blocks = await db.noteBlocks.where("noteId").equals(item.id).sortBy("position");
        notes.push({
          ...item,
          blockCount: blocks.length,
          searchText: [item.title, ...blocks.flatMap((block) => [block.question, block.answer])]
            .join("\n")
            .toLocaleLowerCase()
            .replace(/\s+/g, " ")
            .trim(),
          syncStatus: "synced",
        });
      }

      await db.conversations.bulkPut(conversations);
      await db.messages.bulkPut(messages);
      await db.notes.bulkPut(notes);

      const deletable = (entityType: OutboxMutation["entityType"], ids: string[]) =>
        ids.filter((id) => !pendingKeys.has(`${entityType}:${id}`));
      const deletedNotes = deletable("note", snapshot.deleted.notes);
      const blocksForDeletedNotes = deletedNotes.length
        ? await db.noteBlocks.where("noteId").anyOf(deletedNotes).primaryKeys()
        : [];
      await db.noteBlocks.bulkDelete([
        ...blocksForDeletedNotes,
        ...deletable("noteBlock", snapshot.deleted.noteBlocks),
      ]);
      await db.notes.bulkDelete(deletedNotes);
      await db.messages.bulkDelete(deletable("message", snapshot.deleted.messages));
      await db.conversations.bulkDelete(deletable("conversation", snapshot.deleted.conversations));
      await db.syncMetadata.put({ key: cursorKey, value: snapshot.cursor });
    },
  );
}
