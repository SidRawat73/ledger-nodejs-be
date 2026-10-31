# Ledger

A small banking API: users, accounts, transfers. Money is a **journal**, not a `balance` field you `$inc`.

**Live:** [https://ledger-nodejs-be.onrender.com](https://ledger-nodejs-be.onrender.com)  
**Health:** [https://ledger-nodejs-be.onrender.com/health](https://ledger-nodejs-be.onrender.com/health)

```
POST /api/transaction
        │
        ▼
  idempotency key ── already seen? ──► 200, same pair
        │ no
        ▼
   debit row (−X)   credit row (+X)
        │
        ▼
  GET /api/account/:id/balance  =  sum of rows
```

Double-click Pay with the same `idempotencyKey` does not move money twice. A new key is a new intent.

---

## Stack

| Piece | Role |
| --- | --- |
| Express 5 | HTTP |
| MongoDB Atlas | source of truth |
| Mongoose | models + sessions |
| JWT + httpOnly cookie | auth (`Bearer` also works) |
| bcrypt | password hash |
| Render | process host |

---

## API

Auth: cookie `token` or `Authorization: Bearer <jwt>`.

### Open

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/` | `{ ok, message }` |
| `GET` | `/health` | `{ ok, db: "ledger" }` |
| `POST` | `/api/auth/register` | `{ email, password, name }` |
| `POST` | `/api/auth/login` | `{ email, password }` |

### You

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/auth/me` | `_id`, email, name |
| `POST` | `/api/account/create` | optional `{ status, currency }` |
| `GET` | `/api/account` | your accounts + derived `balance` |
| `GET` | `/api/account/:id` | yours or `404` |
| `GET` | `/api/account/:id/balance` | `{ accountId, balance, currency }` |
| `GET` | `/api/account/:id/ledger` | signed rows, newest first |
| `GET` | `/api/transaction` | transfers you are a party to |
| `GET` | `/api/transaction/:id` | transfer + debit/credit rows |
| `POST` | `/api/transaction` | move money |

### System

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/transaction/system/initial-funds` | system user JWT only |

Someone else’s `:id` is **`404`**, not `403`.

---

## Transfer body

```json
{
  "fromAccount": "6655…",
  "toAccount": "6655…",
  "amount": 500,
  "description": "rent",
  "idempotencyKey": "e2a22a75-b00c-49ed-a2c7-e9e9380f7432"
}
```

Same key again → **`200`** and the stored pair. Different key → new pair.

Initial funds (system):

```json
{
  "toAccount": "6655…",
  "amount": 10000,
  "idempotencyKey": "7f3a-…"
}
```

---

## Local

```bash
git clone https://github.com/SidRawat73/ledger-nodejs-be.git
cd ledger-nodejs-be
npm install
```

`.env` (not in git):

```
MONGO_URI=
JWT_SECRET=
```

```bash
npm run dev    # nodemon, port 8080
npm start      # node server.js
```

`PORT` comes from the environment in production. Local default is **8080**.

---

## Rules this repo actually enforces

1. **Two ledger rows per transfer** — debit `−amount`, credit `+amount`.
2. **Balance is `$sum` of `amount`** for that account. There is no mutable `balance` column.
3. **`idempotencyKey` is unique.** `11000` is a replay, not a 500.
4. **Email is not in the transfer `try`.** `201` means the books wrote. SMTP down does not rewrite the status.

---

## Deploy

[Render](https://render.com) Web Service from this repo. Start command: `node server.js`. Put the `.env` keys in the dashboard.

Atlas **Network Access** must allow Render (`0.0.0.0/0` on a student cluster). A laptop IP alone is why local works and Render logs `MongooseServerSelectionError`.

---

[github.com/SidRawat73/ledger-nodejs-be](https://github.com/SidRawat73/ledger-nodejs-be)
