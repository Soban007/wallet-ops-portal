# Mini Operations Wallet Portal

This is a compact ops console for wallet-style balances — the kind of internal
screen a ride-hailing or delivery company's finance team would use. It lets
you register users, open wallets for them, move money in and out safely,
browse the resulting transaction history, and pull daily or all-time totals.

Correctness of the money movement is the point of the exercise, not the UI
polish: a wallet's balance must never dip below zero, every credit/debit is
safe to retry because it's keyed by a `referenceId`, and two debits arriving
at once must not step on each other.

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Backend    | NestJS on TypeScript, TypeORM, PostgreSQL           |
| Frontend   | Next.js (App Router) + React, styled with plain CSS |
| Validation | class-validator-backed DTO classes                  |
| API docs   | Swagger/OpenAPI, served under `/docs`               |
| Tooling    | Docker Compose, Jest, Prettier                      |

## Project structure

```
wallet-ops-portal/
├── backend/                 NestJS API
│   ├── src/
│   │   ├── common/          money helpers + global exception filter
│   │   ├── users/           users module (entity, dto, service, controller)
│   │   ├── wallets/         wallets module + credit/debit logic
│   │   ├── transactions/    transaction entity
│   │   ├── reports/         overview + daily-summary
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── scripts/seed.mjs
│   └── Dockerfile
├── frontend/                Next.js UI
│   └── src/
│       ├── app/             dashboard, users, wallets, wallet detail, reports
│       ├── components/      shared loading/empty/error states
│       └── lib/api.ts       typed API client
├── docs/ARCHITECTURE.md     the deeper design write-up and Q&A
└── docker-compose.yml
```

## Quick start (Docker)

Everything — database, API, UI — comes up with one command:

```bash
docker compose up --build
```

That gives you three things to point a browser at:

- `http://localhost:3000` — the UI
- `http://localhost:3001` — the API itself
- `http://localhost:3001/docs` — its Swagger page

From there, add a user in the UI, give them a wallet, and run a credit or two
through it to see the flow end to end.

## Running it locally (no Docker)

Running it directly needs Node 20+ and a PostgreSQL instance you control.

**1. Database** — either point the env vars at a Postgres you already have,
or create a dedicated one:

```sql
CREATE USER wallet WITH PASSWORD 'wallet';
CREATE DATABASE wallet_ops OWNER wallet;
```

**2. Backend**

```bash
cd backend
cp .env.example .env        # change the DB_* values if yours differ
npm install
npm run start:dev           # serves the API at http://localhost:3001 (docs under /docs)
```

No migration step needed here — `DB_SYNCHRONIZE=true` lets TypeORM create and
update the tables itself on startup.

**3. Frontend**

```bash
cd frontend
cp .env.example .env        # NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev                 # serves the UI at http://localhost:3000
```

**4. Load some sample data (optional)** once the API is up:

```bash
cd backend
npm run seed
```

## Environment variables

**Backend (`backend/.env`)**

| Variable         | Default      | Description                              |
| ---------------- | ------------ | ---------------------------------------- |
| `PORT`           | `3001`       | Port the API listens on                  |
| `DB_HOST`        | `localhost`  | Postgres host                            |
| `DB_PORT`        | `5432`       | Postgres port                            |
| `DB_USER`        | `wallet`     | Postgres user                            |
| `DB_PASSWORD`    | `wallet`     | Postgres password                        |
| `DB_NAME`        | `wallet_ops` | Database name                            |
| `DB_SYNCHRONIZE` | `true`       | Let TypeORM create/update tables on boot |

**Frontend (`frontend/.env`)**

| Variable              | Default                 | Description              |
| --------------------- | ----------------------- | ------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Where the API is reached |

## API reference

The full interactive contract lives at `/docs`; here's the short version:

| Method | Path                          | Description                      |
| ------ | ----------------------------- | -------------------------------- |
| POST   | `/users`                      | Create a user                    |
| GET    | `/users`                      | List users                       |
| POST   | `/wallets`                    | Create a wallet for a user       |
| GET    | `/wallets`                    | List wallets                     |
| GET    | `/wallets/:id`                | Get one wallet (balance, status) |
| POST   | `/wallets/:id/credit`         | Credit a wallet                  |
| POST   | `/wallets/:id/debit`          | Debit a wallet                   |
| GET    | `/wallets/:id/transactions`   | Transaction history for a wallet |
| GET    | `/reports/overview`           | All-time totals (dashboard)      |
| GET    | `/reports/daily-summary?date` | Per-day credits/debits/count     |

> `GET /wallets` and `GET /reports/overview` weren't part of the original
> endpoint list — they exist purely to feed the wallet list view and the
> dashboard's stat cards.

### Example requests

```bash
# create a user
curl -X POST http://localhost:3001/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dummy User","phone":"+923323445532","email":"dummy.user@example.com"}'

# create a wallet (use the id returned above)
curl -X POST http://localhost:3001/wallets \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<USER_ID>","currency":"USD"}'

# credit it
curl -X POST http://localhost:3001/wallets/<WALLET_ID>/credit \
  -H 'Content-Type: application/json' \
  -d '{"amount":"500.00","referenceId":"topup-1","description":"Initial top-up"}'

# debit it
curl -X POST http://localhost:3001/wallets/<WALLET_ID>/debit \
  -H 'Content-Type: application/json' \
  -d '{"amount":"120.50","referenceId":"ride-1","description":"Ride payment"}'
```

## Where the important rules live

These four are where most of the effort went; a longer version of each lives in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) if you want the full reasoning.

**No floating-point arithmetic on money.** `Wallet.balance` and every
transaction `amount` live in the database as `bigint` values expressed in the
smallest currency unit (cents), and all the arithmetic on them runs through
JavaScript `BigInt`. The HTTP layer only ever sees a decimal string such as
`"100.50"`; it gets converted to cents right at the edge
(`backend/src/common/money.ts`) and is never touched with `Number` math in
between.

**A debit can never push a wallet below zero.** Before anything is persisted,
the service works out what the resulting balance would be and, if that's
negative, aborts with `Insufficient balance` (HTTP 400) instead of writing.
That one check — inside `applyOperation` — is the only place this rule is
enforced, so there's nowhere else it could quietly be bypassed.

**`referenceId` is what makes retries safe.** Every transaction's `referenceId`
carries a unique constraint. When a request comes in, the service first looks
for a transaction already stored under that id: an exact repeat (same type,
same amount) just returns the earlier result, so a client retrying after a
timeout doesn't get charged twice. A repeat with mismatched details is treated
as a different operation that happened to reuse someone else's id, and gets
turned away with `409 Conflict`. For the edge case where two identical
requests both slip past that lookup at the same instant, the database's unique
constraint only lets one `INSERT` through — the loser catches the violation
and hands back the winner's transaction instead.

**Concurrent debits can't race each other.** Applying a credit or debit
happens inside one database transaction that takes a `pessimistic_write` lock
on the wallet row (i.e. `SELECT ... FOR UPDATE`). A second request touching
the same wallet simply waits for the first to commit, then works from the
balance it left behind — so there's never a window where two debits both read
the same starting balance and overspend it.

## Testing

```bash
cd backend
npm test
```

What's exercised (`src/**/*.spec.ts`):

- **money helpers** — converting between minor and major units, and
  `applyOperation` refusing a negative result or a non-positive amount.
- **wallets service** — a successful credit, a successful debit, a debit
  rejected for insufficient funds, and a repeated `referenceId` being treated
  as the same operation instead of a new one.

None of this touches a real database — the wallet service's tests swap in
in-memory stand-ins for the repository and query runner.

### Concurrency integration test (real Postgres)

The fast suite above proves the _logic_; this one proves it holds against an
actual database, by firing genuinely concurrent requests
(`Promise.allSettled`, not sequential awaits) at a real Postgres row.

```bash
docker compose -f docker-compose.test.yml up -d   # disposable Postgres on :55432
cd backend
npm run test:concurrency
```

`src/wallets/wallets.concurrency.integration.ts` covers two races:

- **Two debits, same wallet, not enough money for both.** Both are fired at
  once; exactly one is accepted, the other is rejected, and the final
  balance reflects only the winner — it never goes negative.
- **Two requests, same `referenceId`, fired at once.** Both resolve, but to
  the _same_ transaction — the row lock plus the unique constraint mean the
  operation is applied exactly once, and the loser replays the winner's
  result instead of erroring or double-charging.

This suite is kept separate from `npm test` (it needs a real database, the
main suite deliberately doesn't) — that's what the `.integration.ts` naming
and the dedicated `test:concurrency` script are for.

### Checking concurrency by hand

The same guarantee, without Jest — useful for a live walkthrough. With the
stack running, credit a wallet `100.00`, then launch two debits of `100.00`
at the same moment using **different** reference ids:

```bash
curl -s -X POST localhost:3001/wallets/<ID>/debit -H 'Content-Type: application/json' \
  -d '{"amount":"100.00","referenceId":"a"}' &
curl -s -X POST localhost:3001/wallets/<ID>/debit -H 'Content-Type: application/json' \
  -d '{"amount":"100.00","referenceId":"b"}' &
wait
```

Only one of the two goes through; the other comes back as
`400 Insufficient balance`, and the balance settles at `0.00` — it never dips
below that. Re-sending either call again with its **original** reference id
just replays the same transaction and leaves the balance untouched.

## Manual QA checklist (frontend)

- [ ] Dashboard: totals for wallets, balance, credits, debits, and transaction count all render.
- [ ] Users page: a newly created user shows up in the list right away; a duplicate email surfaces an error instead of failing silently.
- [ ] Wallets page: a new wallet appears in the list immediately after creation.
- [ ] Wallet detail page: crediting the wallet updates both the balance figure and the transaction table.
- [ ] Wallet detail page: a debit within balance succeeds; a debit larger than the balance is refused with a visible message.
- [ ] Sending the same reference id + amount a second time leaves the balance unchanged.
- [ ] Sending the same reference id with a _different_ amount is refused rather than applied.
- [ ] Reports page: choosing a date shows that day's credit/debit/transaction totals.
- [ ] Every page shows the right state for loading, empty results, and an unreachable API (try stopping the backend).

## Assumptions

- `amount` arrives as a decimal string with at most two places (e.g.
  `"100.50"`), always in major units; `currency` is stored purely as a label —
  nothing here does FX conversion.
- `referenceId` uniqueness is enforced globally, not per wallet.
- A wallet counts as "active" in the daily summary if it had at least one
  transaction that day.
- Calendar days for the daily summary are UTC days, not local time.
- There's no authentication layer; that's intentionally out of scope for this
  assessment.

## Known limitations

- Schema sync (`DB_SYNCHRONIZE=true`) is a shortcut for this assessment; a
  real deployment would switch to versioned TypeORM migrations.
- List endpoints return everything unpaginated — fine at this data volume,
  not at production scale.
- There's no auth/authz layer at all yet.
- Report numbers are computed on every request rather than pre-aggregated;
  `docs/ARCHITECTURE.md` covers what that would look like at higher volume.

## AI usage disclosure

Per the assessment's rules on AI use, I leaned on an AI assistant for the
mechanical parts: standing up the NestJS/Next.js project skeletons, writing
out repetitive pieces like DTOs and entity decorators, and the CSS. I also
used it as a sounding board while working out the money-handling and
concurrency approach.

The decisions themselves are mine, and I can walk through or change any of
them on request: keeping money as integer minor units, using `referenceId`
plus a unique constraint as the idempotency mechanism, and locking the wallet
row inside a transaction to make concurrent debits safe. I reviewed what the
assistant produced, cut back the parts that were over-engineered, and made
sure I could account for every piece of it before calling it done.
