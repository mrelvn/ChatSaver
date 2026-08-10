# Database design

PostgreSQL is ChatSaver's authenticated recovery and cross-device synchronization store. IndexedDB
remains the interactive source of truth while the browser is offline.

## Deployed schema

| Table | Responsibility |
|---|---|
| `app_user` | Password account identity and lifecycle |
| `device` | Browser/PWA identity, revocation state, and last applied sync cursor |
| `refresh_session` | Hashed rotating refresh tokens and reuse-family tracking |
| `conversation` | Metadata for an imported ChatGPT conversation |
| `message` | Ordered normalized source messages |
| `note` | Editable note metadata and its optional source conversation |
| `note_block` | Ordered editable question/answer content |
| `mutation_receipt` | Compact idempotency key for `(device_id, mutation_id)` |
| `change_event` | Append-only cursor feed for changed client entity IDs |
| `deletion_marker` | Content-free client IDs that prevent deleted data from returning |

Tables for OAuth identities, server import jobs, tags, attachments, conflict payloads, and hosted
share links were removed because the deployed application has no endpoint or write path for them.
Adding such a feature later should add its schema in the same release as the feature itself.

## Normalization decisions

- Raw source JSON, unused message-tree fields, note summaries, derived block counts, and unused source
  pointers are not stored.
- `note_block.position` is an integer because the implemented editor uses deterministic integer
  ordering.
- `block_count` is computed from indexed child rows instead of trusting duplicated client data.
- `message.user_id` and `note_block.user_id` intentionally remain as tenant keys. This small
  denormalization makes every private query independently tenant-scoped and keeps deletion bounded.
- Actual deleted content is physically removed. `deletion_marker` stores only `(user, type,
  client_id, cursor, timestamp)` so another offline device cannot resurrect it.

## Synchronization indexes

- `(user_id, cursor)` on `change_event` is the delta-pull path and high-water mark lookup.
- `(user_id, change_cursor)` on `deletion_marker` returns only new deletions.
- `(device_id, mutation_id)` is both the receipt primary key and retry lookup.
- Note and conversation cursor indexes support stable keyset pagination.
- Conversation/message external-ID indexes prevent duplicate ChatGPT imports.
- GIN indexes cover note titles and Q&A text without storing a second search document.

Indexes should be changed only after checking production query plans; each additional index adds
write amplification to mutation batches.

## Retention and operations

- Keep deletion markers for the maximum supported offline-device lifetime. Permanent markers are
  safest for a personal vault and contain no chat text.
- Mutation receipts and change events can be pruned only below the minimum cursor of active devices
  and after the retry window.
- Revoke expired refresh families and remove expired sessions through scheduled maintenance.
- Use TLS to PostgreSQL, encrypted disks, daily backups, and point-in-time recovery on the VPS.
- Hibernate/JPA currently manages the schema; introduce versioned migrations before schema changes
  need controlled rollbacks or zero-downtime rollout sequencing.
