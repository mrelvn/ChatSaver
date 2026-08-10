# Synchronization protocol

## Push

```http
POST /api/v1/sync/push
Authorization: Bearer <access-token>
Content-Type: application/json
```

The server accepts at most 100 ordered mutations. In one PostgreSQL transaction it validates the
authenticated device, ignores an already-recorded `(device_id, mutation_id)`, applies the mutation,
increments the entity version, appends a `change_event`, and records the compact receipt.

Deletes physically remove content and retain only deletion markers. A marker blocks an old offline
device from recreating the same client ID.

## Cursor pull and recovery

```http
GET /api/v1/sync/snapshot?after=<cursor>
Authorization: Bearer <access-token>
```

- `after=0` returns the complete normalized vault and all deletion markers. It is used for a new
  device, a cleared IndexedDB database, or server-cursor recovery.
- A positive cursor returns only entities and deletion markers changed after that cursor.
- The response includes the transaction's high-water `cursor`, stored in IndexedDB under the
  authenticated account ID.
- If a client cursor is ahead of the server, the server safely falls back to a full snapshot.

The client pushes its outbox first, then applies the returned delta in one IndexedDB transaction.
Records that gained a pending local mutation while the request was in flight are preserved. The
cursor is committed in the same transaction as the remote rows, so a failed application cannot
advance past unapplied data.

## Deletion propagation

Deleting a conversation marks and removes its messages, generated note, and Q&A blocks. Deleting a
note marks and removes its blocks. Cascaded markers share the delete event cursor, allowing every
other device to remove the complete graph without downloading old content.

`DELETE /api/v1/sync/vault` performs an account-wide content purge, emits a new vault cursor, and
then lets each other device clear the corresponding local entities during its next pull.

## Conflict policy

The implemented policy is server-ordered last-write-wins for editable fields. Local IndexedDB
mutations are never discarded before an acknowledged push. A future field-level merge UI should be
introduced together with its payload schema rather than retaining speculative conflict JSON today.
