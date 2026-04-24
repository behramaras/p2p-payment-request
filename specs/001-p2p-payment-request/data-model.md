# Data Model: P2P Payment Request

SQLAlchemy 2.x style; SQLite types. All monetary fields are **Integer** (cents).

## Entity: `User`

Represents anyone who has signed in at least once (mock auth).

| Column | Type | Constraints |
|--------|------|----------------|
| `id` | `Integer` | PK, autoincrement |
| `email_normalized` | `String(320)` | `UNIQUE`, `NOT NULL`, indexed |
| `created_at` | `DateTime` (UTC) | `NOT NULL`, server default |

**Indexes**: `ix_users_email_normalized` (unique).

## Entity: `PaymentRequest`

| Column | Type | Constraints |
|--------|------|----------------|
| `id` | `UUID` (as 16-byte BLOB or `String(36)`) | PK, default `uuid4` |
| `sender_user_id` | `Integer` | `FK(users.id)`, `NOT NULL`, indexed |
| `recipient_email` | `String(320)` | `NOT NULL` — stored **normalized** (opaque per constitution; no FK to users) |
| `amount_cents` | `Integer` | `NOT NULL`, `CHECK (amount_cents > 0)` |
| `note` | `Text` | nullable, max length enforced in Pydantic (e.g. 500) |
| `status` | `String(20)` | `NOT NULL`, one of `pending`, `paid`, `declined`, `expired`, `cancelled` |
| `created_at` | `DateTime` (UTC) | `NOT NULL`, indexed |
| `expires_at` | `DateTime` (UTC) | `NOT NULL` — always `created_at + 7 days` at insert |
| `paid_at` | `DateTime` | nullable |
| `declined_at` | `DateTime` | nullable |
| `cancelled_at` | `DateTime` | nullable |

**Relationships**: `User.requests_sent` → `PaymentRequest` collection (`back_populates="sender"`), `sender_user_id` → `User`.

**Indexes** (query patterns):

- `ix_payment_requests_sender_status` on `(sender_user_id, status)` — Sent tab + filter.
- `ix_payment_requests_recipient_status` on `(recipient_email, status)` — Received tab + filter (email matches normalized session email).
- `ix_payment_requests_created_at` on `(created_at DESC)` — optional ordering.
- `ix_payment_requests_expires_at` on `(expires_at)` — optional; helps lazy expiration scans if volume grows.

**Check constraints** (SQLite 3.37+): enforce status enum in app layer primarily; optional `CHECK (status IN (...))` in migration.

## Entity: `PaymentIdempotency` (optional but recommended)

Stores idempotency keys for Pay per constitution.

| Column | Type | Constraints |
|--------|------|----------------|
| `id` | `Integer` | PK, autoincrement |
| `request_id` | `UUID` / `String(36)` | `FK(payment_requests.id)`, `NOT NULL` |
| `client_key` | `String(128)` | `NOT NULL` |
| `created_at` | `DateTime` | `NOT NULL` |

**Unique constraint**: `uq_payment_idempotency_request_key` on `(request_id, client_key)`.

**Usage**: On Pay with header `Idempotency-Key: <key>`, insert-or-select; if prior completed response cached (store `http_status` + optional `response_body_hash` or full JSON blob small), return replay; else proceed with CAS UPDATE and then persist success marker.

**Alternative minimal path**: If product omits header, **DB-only** idempotency still holds via conditional `UPDATE`; replays without key return **200** with current `PaymentRequest` if already `paid`.

## State transitions (stored `status`)

| From | To | Actor |
|------|-----|--------|
| `pending` | `paid` | Recipient |
| `pending` | `declined` | Recipient |
| `pending` | `cancelled` | Sender |
| `pending` | `expired` | System (lazy on read/write) |

No transitions from terminal states. `paid`, `declined`, `cancelled`, `expired` are terminal.

## Validation rules (mirror in Pydantic + DB)

- `recipient_email`: normalized; must not equal sender’s normalized email.
- `amount_cents`: integer > 0.
- `note`: optional, max length capped.

## ER diagram (text)

```text
User (1) ----< (N) PaymentRequest.sender_user_id
PaymentRequest (1) ----< (0..N) PaymentIdempotency (optional)
```

No relationship from `PaymentRequest.recipient_email` to `User` (recipient may never log in).
