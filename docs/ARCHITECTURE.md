# Architecture notes

This is the longer explanation of how the pieces fit together and why —
including direct answers to the harder questions the assessment calls out for
the live review.

## Overview

```
┌────────────┐      HTTP/JSON      ┌────────────┐     SQL      ┌────────────┐
│  Next.js   │  ───────────────▶   │  NestJS    │  ─────────▶  │ PostgreSQL │
│  frontend  │   (lib/api.ts)      │  API       │   (TypeORM)  │            │
└────────────┘                     └────────────┘              └────────────┘
```

The backend follows a conventional NestJS layering:

- **Controllers** do request parsing/validation and nothing else — no
  business rules live at this layer.
- **Services** own every business rule: balance arithmetic, idempotency
  handling, row locking.
- **Entities and repositories** are the TypeORM persistence layer underneath
  the services.

The frontend stays deliberately thin: any money formatting it does is purely
cosmetic, and the backend remains the only authority on what a balance
actually is.

## Data model

```
User (1) ───< Wallet (1) ───< Transaction
```

**User** holds `id`, `name`, `phone`, a unique `email`, `status`, and the
usual timestamps.

**Wallet** holds `id`, `userId`, `currency`, a `bigint` `balanceMinor` column
(the live balance, in minor units), `status`, and timestamps.

**Transaction** holds `id`, `walletId`, `type` (`credit` or `debit`),
`amountMinor`, `balanceBeforeMinor`, `balanceAfterMinor`, a unique
`referenceId`, an optional `description`, and `createdAt`. Recording both the
before and after balance on every row means the whole history is
self-auditing — you can reconstruct how any balance was reached just by
reading the table.

## Why balances live as integers

`0.10` has no exact binary floating-point representation, and summing many
such values compounds that error over time — not something a ledger can
tolerate. So every balance and amount is kept as a whole number of cents and
manipulated exclusively with `BigInt`; a decimal string only gets produced
when a value needs to be shown to, or accepted from, a human. Those
conversions, plus the balance-update rule itself, are the entire contents of
`common/money.ts` (`toMinorUnits`, `toMajorUnits`, `applyOperation`) — one
small, unit-tested module, so there's exactly one place this could ever go
wrong.

The request body also carries `amount` as text (`"100.50"`), not a JSON
number: parsing a numeric literal out of JSON already risks a float
round-trip before our code even runs, so the wire format sidesteps that
entirely.

## Credit / debit flow

Everything that matters happens in one method, `wallets.service.ts → execute()`:

1. **Look for this `referenceId` first.** If a transaction already exists
   under it, hand that back immediately — nothing else runs, so a retried
   request is a no-op rather than a second charge.
2. **Start a transaction and lock the wallet.** A `pessimistic_write` lock
   (`SELECT ... FOR UPDATE`) is taken on the wallet row; any other credit or
   debit aimed at the same wallet has to wait its turn.
3. **Work out the new balance.** `applyOperation` does the arithmetic and
   refuses a debit that would leave the balance negative, throwing
   `Insufficient balance`.
4. **Write both rows and commit.** The transaction row is inserted, the
   wallet's balance is updated, and the database transaction closes.
5. **Cover the last race.** If two requests carrying the same brand-new
   `referenceId` both get past step 1 before either has committed, the
   unique constraint means only one `INSERT` can succeed; the other catches
   the resulting violation and returns whatever the winner produced, leaving
   the balance exactly as the winner left it.

So idempotency really has two layers — the lookup handles the common,
sequential retry, and the unique constraint is what still holds when two
requests genuinely overlap — while concurrency on a single wallet is entirely
down to the row lock.

## Errors

Every thrown error passes through one global exception filter
(`common/all-exceptions.filter.ts`) before it reaches the client, so the shape
is always `{ statusCode, error, message }` regardless of where it came from.
Validation failures from the global `ValidationPipe` surface as 400s with a
readable message, and the frontend just displays that message on the form as
it is.

## Answers to the review questions

**How is duplicate credit/debit prevented with `referenceId`?**
Two layers, doing different jobs. A lookup by `referenceId` at the start of
the request handles the ordinary case — a genuine retry just gets the
original transaction back. The unique database constraint on that column is
what actually holds under concurrency: if two requests race past that lookup
together, only one insert can win. A `referenceId` that comes back with a
different amount or type isn't treated as a retry at all — it looks like an
id collision, so the request is turned away with `409 Conflict` instead of
being silently applied (the same stance payment providers like Stripe take on
reused idempotency keys). Either path guarantees the balance moves at most
once per reference.

**How are two debits at the same time handled?**
By taking a row-level lock on the wallet — `pessimistic_write` — for the
lifetime of the database transaction that applies the change. Whichever
request arrives second simply blocks until the first one commits, at which
point it reads the balance the first request already left behind, so there's
no way for both to spend against the same starting number. This isn't just
reasoned about — `backend/src/wallets/wallets.concurrency.integration.ts`
fires two real concurrent debits at a live Postgres instance and asserts
exactly one wins (see the README's "Testing" section for how to run it).

**Where is the business logic and why?**
Services own it; controllers don't. Keeping HTTP concerns in the controller
and rules in the service means the rules can be tested without spinning up a
web layer, and the same service method can be reused from somewhere that
isn't a controller at all — the seed script does exactly that today, and a
future background worker could do the same.

That separation extends to the types, not just the files: controllers deal
in DTO classes validated by class-validator, while services accept plain
domain interfaces (`CreateUserInput`, `WalletOperationInput`, and similar).
Nothing beneath the controller layer knows or cares what the transport shape
looked like — the service's contract is expressed purely in domain terms.

**How would this scale to millions of transactions per month?**
- Locking happens per wallet row, not on some global mutex, so contention
  scales with how many wallets are busy at once rather than total traffic —
  throughput grows as wallets are added. A handful of unusually hot wallets
  could move to an append-only ledger with periodic balance snapshots
  instead, to sidestep lock contention entirely.
- `transactions(walletId, createdAt)` would need an index once history
  lookups are happening at real volume.
- Computing report totals on every request stops being viable well before
  millions/month; that math should move to daily tables (or a materialized
  view) updated incrementally instead of scanning transactions live.
- List endpoints need real pagination, and anything heavy should move off
  the request path onto a queue.
- `synchronize` gives way to proper migrations, and reporting traffic gets
  its own read replica so it stops competing with the transactional workload.

**Where are naming conventions followed?**
Nest's own conventions are followed throughout for modules, services,
controllers, and DTOs (`wallets.service.ts`, `create-wallet.dto.ts`); entity
classes and React components are PascalCase; hooks and event handlers are
camelCase; filenames are kebab-case. Every money-related column carries a
`Minor` suffix, so the unit is never ambiguous from the name alone.

**How would you add "show failed debit attempts" to the UI?**
Right now a failed debit just returns a 400 and leaves no trace in the
database. Making failures visible would mean recording an attempt at the
point the balance check fails — either a `failed` status on the transaction
row itself, or a separate `transaction_attempts` table — and then surfacing
that on the wallet detail page as a column or filter. The error message is
already shown to the user in the moment; the remaining work is persisting it
and listing it afterward.
