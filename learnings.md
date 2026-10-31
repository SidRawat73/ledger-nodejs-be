# Ledger lab notes

Side lab next to Board. Not a path phase. Harbor still owns saga later.

---

## `npx`

**npx** = **n**pm **p**ackage e**x**ecute. It **runs** a CLI. `npm` **installs** a package. They are not the same command.

`node_modules/.bin/` is a folder of command-line programs that packages drop when you `npm install` (nodemon, eslint, vite). You do not `require()` those; you type their name in a terminal.

**Why:** Without npx you either (1) `npm install -g` the tool, so every project on the machine shares one version and they fight, or (2) type `./node_modules/.bin/nodemon server.js` every time. npx looks in the **local** `node_modules/.bin` first and runs that binary. That is why `npx vite` in a frontend app uses *this* project’s Vite, not a random global.

**When:** You want to run a tool that is a CLI, not a `require()` library. Local: `npx nodemon ledger/server.js` after `nodemon` is in this folder’s `package.json`. One-shot scaffold: `npx create-next-app` — npm downloads it, runs it, you do not keep it as a dependency of the API. You do **not** npx Express. Express is `require("express")` inside `server.js`.

**Where:** The terminal, in the project that has `package.json`. Never inside a route handler.

**How:** `npx nodemon server.js` → npm finds `nodemon` in `ledger/node_modules/.bin` (or fetches it for a one-shot) → starts that program with `server.js` as an argument. `npm run dev` is the same idea when `package.json` has `"dev": "nodemon server.js"`: npm runs the local bin for you. Prefer `npm run` for tools this repo actually depends on; npx is for “run this CLI now.”

**Real world:** `npx create-next-app`, `npx create-vite`, `npx eslint .`, `npx prisma migrate dev`. You already used this on the frontend. `npx` is not a Node API and not a Docker command.

**Interview question:** Why `npx nodemon` instead of `npm install -g nodemon`?

**Answer:** Global is one version for every repo. Local + npx (or `npm run`) pins the tool to this `package.json`. Board and a 2019 app can disagree on nodemon without breaking each other.

---

## Isolation — second process, second port, second database

Board is already a live API. Ledger is a **second Node process**. Same machine, same `mongod` (`board-mongo` on `27018`). Different **listen port** and different **database name**. Isolation is the product rule, not a folder nicety.

| | Board | Ledger |
| --- | --- | --- |
| Folder | `board/` | `ledger/` |
| Start | `node board/server.js` | `node ledger/server.js` |
| Port | **8081** | **8082** |
| Mongo URI | `mongodb://127.0.0.1:27018` | same URI |
| Database | **`board`** | **`ledger`** |

`client.db("board")` and `client.db("ledger")` are two namespaces on one Mongo. Collections do not leak across that name. `require("../board/db")` would. So would `insertOne` into `board.tasks`.

**Why:** One Node process, one port. Two `listen(8081)` calls, or ledger on **8080** (Ink’s port), and the second process dies with `EADDRINUSE`. One database name, and a ledger bug deletes Board tasks — you cannot prove which app wrote the row. `require("../board/auth")` couples deploys: Board’s JWT change kills ledger, and a crash in ledger can take Board’s module graph with it.

**When:** A second bounded context (money journal vs task board) that must survive the other app being down, redeployed, or wrong. You do **not** split when it is the same resource — Board’s `tasks` stay in `board`. You do **not** add Redis/ES/Rabbit here until a ledger route has a job those systems own.

**Where:** `ledger/server.js` (listen **8082**), a `ledger/db.js` you copy the *pattern* from Board into (URI `27018`, `client.db("ledger")`). Never `require("../board/...")`. Never `client.db("board")` from this folder.

**How:** `new MongoClient("mongodb://127.0.0.1:27018")` → `await client.connect()` at startup → `client.db("ledger")`. `require("mongodb")` resolves by walking up to the repo root `node_modules` (Board already installed the driver). Do not `npm install mongoose`. Do not put Nodemailer in a transfer handler later.

**Real world:** Stripe’s API and your app’s user table are not one Postgres. A payment bug must not `DROP` your `users`. Same idea: Shopify checkout vs the product catalog — two services, two data stores, one company.

**Interview question:** Same Mongo host as Board. Why is `client.db("ledger")` not optional?

**Answer:** The host is the process. The database name is the boundary. Same URI + `db("board")` means ledger writes land in Board’s data. Isolation is the name, not the Docker container.

---

## Driver (`mongodb`) vs Mongoose

Three different things share a name:

| Word | What it is |
| --- | --- |
| **MongoDB** | The database product. Process `mongod`, port **27018** here. |
| **`mongodb`** (npm) | The **official driver**. Node’s client library. `MongoClient`, `insertOne`, `findOne`. Board already uses this. |
| **Mongoose** | An **ODM** (Object Document Mapper) **on top of** the driver. You define a `Schema` + `Model`, then `User.create()`. It is not MongoDB. |

The driver sends documents (plain objects) to `mongod`. Mongoose sits between your handler and that driver: it casts types, runs schema validators, and adds `pre('save')` hooks. Under the hood it still calls the driver.

**Why:** Without knowing this split you treat `mongoose.model` as “how Mongo works.” Then a ledger becomes a Schema with a mutable `balance: Number` and `$inc` — two transfers both read `100` and both write `80`. The driver does not stop that bug either, but it does not hide the write. You will type `insertMany` of two rows. Mongoose’s model is what made the video’s Account/Transaction/Ledger tree feel required. It is not.

**When:** Use the **driver** when you already own `insertOne` / `findOne` (Board) and the write is the product (two ledger rows, unique idempotency key). Use **Mongoose** in a large app that wants shared schemas, `populate()`, and validators in one place — not here. You do **not** add Mongoose to “be more production.” Stripe’s API and Board both talk to storage through a client, not an ODM.

**Where:** `ledger/src/db.js` — `const { MongoClient } = require("mongodb")`, then `client.db("ledger")`, same shape as `board/db.js`. Never `require("mongoose")` in this lab. Never `mongoose.connect` next to `MongoClient` (two pools, two sources of “are we connected?”).

**How:** Board: `new MongoClient("mongodb://127.0.0.1:27018")` → `connect()` → `col("tasks").insertOne(...)`. Ledger copies that with `db("ledger")`. A Mongoose version would be `mongoose.connect(uri)` + `new Schema({ amount: Number })` + `Ledger.create(...)`. That is a different API for the same `mongod`. `.env` + `dotenv` is also not required: the URI is local and already in code, same as Board. `.env` is for secrets that change per machine (Atlas password). An empty `.env` does nothing.

**Real world:** Prisma vs the `pg` driver. Sequelize vs `mysql2`. React Query vs `fetch`. The wrapper is convenience. The driver is what actually goes on the wire. Checkout still has to `INSERT` two journal rows whether or not you have a Schema.

**Interview question:** Does Mongoose make a transfer safe?

**Answer:** No. Safety is the unique idempotency key and two rows that sum to the balance. A Schema can still store a `balance` field you mutate. Mongoose is a Node API. It does not change Mongo’s isolation or your write pattern.

---

## `process.exit`

`process` is the Node process running `server.js`. `exit(code)` **stops that process**. The HTTP server lives *inside* it, so `listen` dies with it. The OS sees the code: **`0`** = success, **non-zero** (usually `1`) = failure. `Ctrl+C` also kills the process; `exit` is the same idea from inside the program.

It does **not** kill `mongod`, Board on 8081, or Redis. Those are other processes.

**Why:** If Mongo is unreachable at startup and you still `listen`, a load balancer / `curl` thinks the API is up. Transfers then 500. Exiting on a failed *startup* connect makes “not ready” visible: systemd/Docker/K8s restart the container instead of serving a hollow port.

**When:** Startup only — a dependency you cannot serve without (this lab: Mongo). You do **not** `process.exit` inside `POST /transfers` when one `insertOne` fails: that would drop every in-flight request because of one bad transfer. That path is `500` and the process stays up. You also do **not** `exit(0)` on a connection error; `0` means “everything was fine.”

**Where:** The connect function called from `server.js` *before* (or instead of) becoming a healthy listener. In the video’s file that is `connectToDB`’s `.catch`. Not in a route handler.

**How:** `process.exit(1)` → Node tears down the event loop → the `8082` socket is gone → the shell shows a non-zero exit (npm/`nodemon` will often restart you). Board’s `server.js` currently *logs* a connect failure and still `listen`s. That is the opposite choice: API up, DB down. Fine for a task board demo; wrong for a money journal.

**Real world:** A Kubernetes pod that `exit(1)`s gets restarted. A pod that stays `Running` with a dead DB keeps getting checkout traffic — that is how you page at 3am with “payments 500” while the dashboard is green.

**Interview question:** Mongo is down. Should the transfer handler call `process.exit(1)`?

**Answer:** No. Exit is for “we never became a server.” A failed write is `500` for that request. Killing the process mid-flight drops unrelated users.

---

## `MODULE_NOT_FOUND` — `require` is not `npm install`

Node resolved `require("dotenv")` in `ledger/server.js` and threw:

`Error: Cannot find module 'dotenv'` with `code: 'MODULE_NOT_FOUND'`.

`require("express")` works because `"express"` is in `ledger/package.json` and the files exist under `ledger/node_modules/express`. `dotenv` is **not** in that `package.json`. `npx nodemon` running the file does not install whatever the file `require`s.

**Why:** Without this split you type `npm install dotenv` every time a video `require`s a new name, and the process still dies for the next missing package. The crash is **before** `listen`. There is no HTTP server yet. `nodemon` will keep restarting the same throw.

**When:** `MODULE_NOT_FOUND` on a name you `require()` means the package is missing from *this* folder’s `node_modules` (and parents). Fix is either **install it** (it is a library this app should own) or **delete the `require`** (you copied a line you do not need). You do **not** `npm install` a package just because a tutorial imported it.

**Where:** First line of `ledger/server.js`: `require("dotenv").config()`. Stack `requireStack` is Node telling you which file asked for it.

**How:** `require("dotenv")` → look in `ledger/node_modules/dotenv` → not there → walk up → still no → throw, `server.js:1`. Contrast `npx nodemon`: that is a **CLI** in `node_modules/.bin`. `dotenv` is a **library**. You never `npx dotenv`.

**Real world:** `Cannot find module 'react'` in a frontend app — you `import`ed React but ran from a folder that never `npm install`ed. Same error, same fix rule.

**Interview question:** `require("dotenv")` throws. Is `npm install dotenv` the right fix?

**Answer:** Only if this app actually needs `.env`. Here the URI is local `mongodb://127.0.0.1:27018`, same as Board. Delete the `require`. Installing dotenv “to clear the error” is how Atlas + Mongoose sneak in.

---

## `dotenv`

**dotenv** reads a `.env` file and copies `KEY=value` lines onto `process.env`. `process.env.MONGO_URI` is then a string in RAM. It is not Mongo. It is not a second database.

**Why:** So a production password is not committed in `db.js`. Without *some* env story, the Atlas URI (and password) lives in git.

**When:** Secrets that **change per machine** — Atlas, `JWT_SECRET` in production. You do **not** add dotenv to read `mongodb://127.0.0.1:27018`. Board hardcodes that URI. Ledger does too.

**Where:** If you used it: `require("dotenv").config()` at the **top** of `server.js`, before any `process.env.X`. Never inside a route. This lab: nowhere.

**How:** `config()` reads `.env` from the **current working directory** (where you ran `npm run dev`, i.e. `ledger/`). Then `mongoose.connect(process.env.MONGO_URI)` would use whatever is in that file — here that would be **Atlas**, not `27018`. That is why dotenv is not a neutral helper in this lab.

**Real world:** Vercel/Render inject `process.env` in the dashboard. You do not ship a `.env` to production. `dotenv` is a **local** stand-in for that.

**Interview question:** Why does Board work with no dotenv?

**Answer:** Its URI is localhost and not a secret. `new MongoClient("mongodb://127.0.0.1:27018")` is enough. Env vars start when the value must not be in the repo.

---

## Password policy vs hash

`"Test@123"` against this `match` regex **does** pass. The schema still **rejects** it on `POST /register` because the controller hashes first.

The regex:

`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/`

| Piece | Means | `"Test@123"` |
| --- | --- | --- |
| `(?=.*[a-z])` | at least one lowercase | `e` |
| `(?=.*[A-Z])` | at least one uppercase | `T` |
| `(?=.*\d)` | at least one digit | `1` |
| `(?=.*[@$!%*?&])` | at least one of those symbols | `@` |
| `[A-Za-z\d@$!%*?&]{4,}` | whole string, only those chars, length ≥ 4 | 8 chars, all allowed |

`(?=...)` is a **lookahead**: it checks without consuming. `minlength: [4, "…at least 8…"]` — **`4` is the rule**, the string is only the error text. They can disagree.

Mongoose `match` / `minlength` / `maxlength` run on the value you pass to `create()`, not on the JSON the client sent.

**Why:** Policy exists so `"123456"` never becomes an account. The **hash** exists so a DB leak is not the password. They are two jobs. If you `bcrypt.hash` then `create({ password: hash })`, validators see `$2b$10$...` (~60 chars, contains `.` and `/`). `maxlength: 32` fails. The regex fails. `"Test@123"` never reached the schema.

**When:** Validate **plaintext** in the handler (or a schema that still has the plaintext). Then hash **once**. Store only the hash. You do **not** regex a bcrypt string. You do **not** hash in the controller **and** in `pre('save')` — login `bcrypt.compare(plain, stored)` would compare against a hash-of-a-hash.

**Where:** Video path: `user.model.js` `password.match` + `pre('save')`, and `auth.controller.js` `bcrypt.hash` then `userModel.create`. Board: `routes/users.js` hashes once, `insertOne({ passwordHash })`, **no** password regex, unique email is the index (`e.code === 11000` → `409`).

**How:** Client sends `"Test@123"` → controller `bcrypt.hash` → mongoose validates the **hash** → ValidationError. Board: `bcrypt.hash` → `insertOne` the hash. Login compares with `bcrypt.compare(plain, passwordHash)`.

**Real world:** “Password must include a number and a symbol” is the signup form. The row in the DB is `$2b$10$...`. Netflix does not store `Test@123`. If validators ran on the hash, every valid password would 500.

**Interview question:** Signup body has a strong password. Mongo still says `shorter than the minimum allowed length`. What was validated?

**Answer:** The bcrypt hash, because the handler hashed before `create`. Policy must run on plaintext. The stored field is the hash and is longer than 32.

---

## Mongoose `pre('save')` — `next` vs `async`

`TypeError: next is not a function` at `user.model.js:39`. The hook is:

```js
userSchema.pre('save', async function (next) {
  // ...
  return next();
});
```

`pre('save')` is Mongoose **middleware**: it runs before Mongo sees the document. Two legal styles:

| Style | How it finishes |
| --- | --- |
| `function (next)` | call `next()` or `next(err)` |
| `async function ()` | `return` / `throw` — **no** `next` |

You mixed them. This lab’s `mongoose` is **^9**. Async hooks are **not** given a `next` argument, so `next` is `undefined`. `undefined()` is `TypeError: next is not a function`.

The video’s `async function (next)` + `next()` is the old API (v6/v7). `npm install mongoose` took v9. Same source, different contract.

**Why:** Without this, a tutorial hook crashes on a current install and you “fix” it by deleting `pre('save')` or hashing twice. The hook exists so `create()` / `save()` hash even if a second handler forgets `bcrypt.hash`. Express `next` is a different function (move to the next middleware). Same word, not the same object.

**When:** You are on Mongoose and want “hash on every save.” Pick **one** style. You do **not** need this hook on the driver path — Board hashes in `routes/users.js` and `insertOne`s the hash. You do **not** call Express `next` inside a Mongoose hook.

**Where:** `ledger/src/models/user.model.js` `userSchema.pre('save', ...)`. Trigger is `userModel.create` in `auth.controller.js` (create calls save).

**How:** Mongoose 9 invokes the async function with `this` = the document. Parameter `next` is unbound. Line 39 `return next()` throws before the write. Async version: drop the parameter, `if (!this.isModified('password')) return;`, `await bcrypt.hash`, no `next()`. Callback version: delete `async`, keep `next`.

**Real world:** Express 5 vs Express 4 error-handler arity. A copy-paste from an old blog against a new major version. `package.json` `"mongoose": "^9"` is allowed to break `next` in async hooks; that is what the caret means.

**Interview question:** The video’s `pre('save')` uses `next()`. Yours throws. Who is wrong?

**Answer:** Neither’s *idea*. The installed major version dropped `next` for async middleware. Match the style to the version, or do not use Mongoose.

---

## `ERR_HTTP_HEADERS_SENT` — one request, one response

`Cannot set headers after they are sent to the client` at `auth.controller.js:35` (`res.status(500).json` in the `catch`).

HTTP lets you write **one** status + headers + body. `res.json` writes them and finishes the response. A second `res.json` / `res.status` on the same `res` throws. The client already has the first body.

Two paths in `userRegistrationController` both do this:

```js
if (isExists) {
    res.status(422).json({ ... });   // sent — no return
}
// falls through
await userModel.create(...)          // duplicate → throw
res.status(201).json({ ... });       // or this, then
await sendRegistrationEmail(...)     // throw
// catch:
res.status(500).json({ ... });       // second send → line 35
```

Board’s unique-email branch is the same idea with the `return`:

`res.status(409).json({ "error": "Email already registered" }); return;`

**Why:** Without `return`, “already exists” still runs `create`, still hits `catch`, and Node crashes *after* the client already got `422`. The frontend sees a network error, not the JSON you meant. Same if `201` went out and then email throws: the user is created, the client got success, then the process logs `HEADERS_SENT`.

**When:** Every time you `res.status(...).json(...)` on an early exit (`401`, `409`, `422`). You do **not** send again in `catch` if you already sent. You do **not** put Nodemailer *after* `201` inside the same `try` that sends `500` — email is a job after the response (Dispatch). SMTP down must not change the status you already wrote.

**Where:** `ledger/src/controllers/auth.controller.js` — register lines 12–14 and 33–35; login lines 56–58 have the same missing `return` (`user` is `null`, then `user.comparePassword` throws, then a second send). Board: `board/routes/users.js` after `11000`.

**How:** `res.json` sets `headersSent`. Next `res.json` → `ERR_HTTP_HEADERS_SENT`. Fix: `return` immediately after every error response. `catch` only sends `500` when nothing was sent yet. Email: log / queue **after** `201`, outside the `try` that can `500`, or not in this handler.

**Real world:** Double-submit on “Create account”: first response is `409 Email taken`, fetch still pending a second body, Chrome shows failed. Stripe: PaymentIntent already `succeeded`; a second write to that HTTP response does not refund the charge.

**Interview question:** Client got `422` and the server logged `HEADERS_SENT`. Did `create` still run?

**Answer:** Yes. `res.json` does not stop the function. Only `return` (or `else`) does. The second send is the symptom. The missing `return` is the bug.

---

## `EAI_AGAIN` — the URL never reached Node

Postman: `POST http://http:localhost:8080/api/account/create`  
Error: `getaddrinfo EAI_AGAIN http:localhost`  
`Host: http:localhost:8080`

A URL is `scheme://host:port/path`.

| Piece | Correct | What you sent |
| --- | --- | --- |
| scheme | `http` | `http` |
| host | `localhost` | **`http:localhost`** |
| port | `8080` / lab **`8082`** | `8080` |
| path | `/api/account/create` | `/api/account/create` |

`getaddrinfo` is the OS DNS call: name → IP. `EAI_AGAIN` means that lookup **failed or timed out**. The hostname it looked up is `http:localhost` — not a machine on your network. Your `server.js` never saw the request. The route and the body do not matter yet.

**Why:** Postman’s scheme dropdown is already `http`. Typing `http://` again, or `http:localhost`, makes `http` part of the **host**. Without knowing that, you debug `createAccountController` while Node is idle.

**When:** Any client (`fetch`, curl, Postman, the browser). `EAI_AGAIN` / `ENOTFOUND` / `ECONNREFUSED` are **connect** errors: DNS miss, no such host, or nothing listening on that port. They are not Express `404`s. A `404` means TCP + HTTP succeeded and *your* 404 handler ran.

**Where:** Postman URL bar. Proof is the `Host` header, which is what the client will send after DNS. `curl` equivalent: `curl -s -X POST http://127.0.0.1:8082/api/account/create -H 'Content-Type: application/json' -d '{}'`.

**How:** OS looks up `http:localhost` → fail → Postman stops. Correct: `http://localhost:8080/api/account/create` or `http://127.0.0.1:8080/...`. Lab isolation still wants **8082** once you change `listen`. `127.0.0.1` skips DNS (`localhost` is a local name; it should work, but the extra `http:` is what broke this).

**Real world:** `fetch("http://http://api.stripe.com/...")` in a frontend. Chrome: `net::ERR_NAME_NOT_RESOLVED`. Same class as a typo’d API host in `.env` (`api.stripee.com`). The handler is innocent.

**Interview question:** Postman says `EAI_AGAIN` and the Node terminal is quiet. Is the route wrong?

**Answer:** No. DNS never resolved. The process was not reached. Fix the URL host first. Then you can talk about `404` vs auth.

---

## Idempotency

**Idempotent** = doing the operation **N times** has the **same effect** as doing it **once**.

`GET /users/me` twice: same user, no extra row. `PUT /tasks/:id` with the same body twice: still one task, last write wins. `POST` is **not** idempotent unless you make it so: two `POST /api/account/create` with the same JWT is two accounts. `nextId++` / a new `_id` each time is why.

That is the Ink line you already own: **unique ids are not idempotency**. Unique `_id`s mean two rows do not collide. They do not mean two HTTP requests were two user intents. The client missed the `201`, retried, and now money moved twice.

An **idempotency key** is a client-generated string for **one intent** (UUID in a header or body). The server stores it uniquely. Same key again → **same response, no second write**. Different key → different intent → a new write is correct.

| Job | Question it answers |
| --- | --- |
| Unique `_id` | Can two documents share a primary key? |
| Idempotency key | Was this the **same click**? |
| Rate limit | Are there **too many** clicks? |
| Cache | Can I skip the **read**? |

Cache speeds a happy path. A limit stops a cheap-to-abuse path. An idempotency key makes a **retry safe**. Three different jobs.

**Why:** Without it, double-click Pay, a React Query mutation retry, or a gateway timeout + client retry **charges twice**. Two ledger pairs, balances wrong, you cannot tell which row was the retry. A unique `_id` on each row does not save you — both inserts succeed.

**When:** Any `POST` that **moves money, sends email, or creates a charge** — transfer, checkout, “place order.” You do **not** need a key on `GET`. You do **not** treat `PUT /tasks/:id` as needing a second key: the URL **is** the identity. You do **not** use a rate limit as a substitute: 10 different transfers from one user can be valid; 2 retries of **one** transfer must still be one pair of rows.

**Where:** This lab: `POST /transfers` (not account-create, not Harbor saga). Store the key on the two ledger rows (or a small `transfers` doc that points at them). Unique index on `idempotencyKey`. Never `require("../board/...")`. Driver: `insertMany` two rows; `11000` → `findOne` the existing key and return that body. Harbor later: same idea on checkout, plus compensate if pay succeeded and ship failed.

**How:** Client: `Idempotency-Key: 7f3a-…` (or `body.idempotencyKey`). Server: `findOne({ idempotencyKey })` → hit, return the stored `201`/`200` body. Miss: `insertMany([{ accountId: from, amount: -X, idempotencyKey }, { accountId: to, amount: +X, idempotencyKey }])`. Unique index makes a race (two handlers at once) throw `11000` instead of two pairs. Balance = **sum of `amount`** for that account, not a `balance` field you `$inc`.

**Real world:** Stripe: every mutating call sends `Idempotency-Key`. Double-click “Pay $49” is one PaymentIntent. Amazon “Place order” and UPI / GPay “processing” retries are the same. React Query `mutation.mutate()` retry is why the **server** must be idempotent — the tab cannot know if the first `fetch` landed.

**Interview question:** “Our transfer `_id`s are unique, so a double click is safe.” What is wrong?

**Answer:** Unique `_id`s mean two documents. A retry is a second `insertMany` with two **new** `_id`s. The user meant one payment. You need a unique idempotency key for that intent, and balance as the sum of rows.

---

## `Model.create(doc, { session })` is two documents

The initial-funds body was:

`{ "toAccount": "…e8", "amount": 10000, "idempotencyKey": "e2a22a75-…" }`

That matches the route. `fromAccount` is loaded in the handler. `description` is hardcoded `'Initial funds'`. The throw is **not** a bad JSON body.

Mongoose `create` has two shapes:

| Call | Meaning |
| --- | --- |
| `create(doc, doc2)` | insert **two** documents |
| `create([doc], { session })` | insert **one** document, options (session) in the second arg |

`transactionModel.create({ fromAccount, …, idempotencyKey }, { session })` is the **first** shape. `{ session }` is document #2. `Promise.all (index 1)` in the stack is that second insert. Every required path on it is `undefined`. The warning is the same fact: *to pass a `session`, the first argument must be an array.*

**Why:** Without this, you “fix” the schema (make `idempotencyKey` not required) or blame Postman. The money never writes. A session exists so debit + credit **commit together** or **abort together**. The API just has to match the version you installed (v9).

**When:** Any `create` inside `session.startTransaction()`. You do **not** use `create(doc, { session })`. Driver path: `insertMany([debit, credit], { session })` — the array is already the first argument. You do **not** need Mongoose for that.

**Where:** `ledger/src/controllers/transcation.controller.js` line 119 (and the same `create(..., { session })` on ledgers and on `createTransactionController`).

**How:** `const [transaction] = await transactionModel.create([{ fromAccount, toAccount, amount, description: 'Initial funds', status, idempotencyKey }], { session });`  
`create` with an array **returns an array**. `transaction._id` on the array itself is undefined — destructure `[transaction]`.

**Real world:** `fetch(url, { method, body })` vs `fetch(url, body)` — the second argument is options, unless the library overloads it as more data. Stripe’s idempotency header is options. A second PaymentIntent object would be a second charge.

**Interview question:** Body has `amount` and `idempotencyKey`. Validation says both are required and undefined. Where did the values go?

**Answer:** They were on document 0. Document 1 was `{ session }`. Mongoose `create` without an array treats extra objects as more rows, not as options.

---

## `11000` on `idempotencyKey` is a replay, not a crash

`E11000 duplicate key error collection: ledger.transactions index: idempotencyKey_1 dup key: { idempotencyKey: "e2a22a75-…" }`

`11000` is Mongo: this unique index already has that value. The **index did its job**. A second `create` with the same key was rejected. No second transfer.

The handler then `catch`ed and answered `500` `{ status: "failed" }`. The client now thinks the transfer failed. It will retry or show an error. The row is already there (from the first attempt, including the earlier `create(doc, { session })` that inserted document 0). That is the opposite of idempotency.

**Why:** Without treating `11000` as “return what we already wrote,” a unique key only **stops** the second write. The HTTP story is still “failed.” Stripe’s retry needs the **same success body**, not a red toast. Board’s `11000` on **email** is different: a second **register** is a new intent → `409`. Same error code, different product meaning.

**When:** Unique field = **same intent** (idempotency key) → `findOne` + `200` with the stored transaction (and its two ledger rows). Unique field = **identity** (email) → `409`. You do **not** `500`. You do **not** tell the user “already successful / failed.” You do **not** invent a new key server-side to “make it work.”

**Where:** `createInitialFundsController` `catch` — no `e.code === 11000` branch, no `findOne({ idempotencyKey })` before `create`. `createTransactionController` `findOne`s first but returns `400` `"already successful"` / `"failed"` — still wrong. Board: `board/routes/users.js` `if (e.code === 11000) { 409; return; }`.

**How:** `try { create }` → `catch (e) { if (e.code === 11000) { const existing = await transactionModel.findOne({ idempotencyKey }); return res.status(200).json(existing); } ... }`. A `findOne` *before* create is a fast path; the unique index is the **race** path (two requests at once both miss `findOne`). You need both.

**Real world:** Pay $49, spinner, timeout, React Query retries with the same `Idempotency-Key`. Stripe returns the first PaymentIntent. If that retry were `500 failed`, the UI charges again with a **new** key.

**Interview question:** Unique index fired. Should the API return `500`?

**Answer:** No. `11000` on the idempotency key means this intent already exists. Return that document. `500` is for “we do not know.” `409` is for “this email is taken by someone else.”

---

## `WriteConflict` (112) — not a UUID problem

`MongoServerError` `codeName: WriteConflict`, `errorLabels: TransientTransactionError`. You changed the idempotency key. That only helps `11000`. This error is a **session**.

A Mongo **transaction** (`startTransaction` → writes → `commit` / `abort`) locks the documents it writes. Two transactions writing an overlapping set, or a new transaction vs one that **never aborted**, → `112`. Mongo says **retry the whole transaction**. A new UUID is a new document. It does not release the old lock.

Your handler:

```js
const [transaction] = await transactionModel.create([{ ... }], { session });
if (!transaction[0]) {
    return res.status(500).json({ message: "Transaction creation failed" });
    // no abort
}
```

`const [transaction] = ...` already unwrapped the array. `create` succeeded. `transaction[0]` is `undefined` (a document is not an array). You `return` **inside** the open transaction. `catch` never runs. Atlas keeps that transaction (~60s) even after `nodemon` restarts Node. The next `insertOne` — new key, new request — is `WriteConflict`.

**Why:** Without abort-on-every-exit, a “failed” HTTP response still holds the write. The next Pay click fights a ghost transaction. Changing the key looks like progress and does nothing. `TransientTransactionError` exists because networks and races are normal; leaking a session is not.

**When:** Multi-document `startTransaction`. Every path that started a session must `abort` or `commit`, including `400`/`500` `return`s. You do **not** `return res.json` mid-`try` without abort. You do **not** treat `112` as “bad idempotency key.” You do **not** need this session at all on the driver lab path: two ledger rows in **one** `insertMany` on one collection is already one write.

**Where:** `createInitialFundsController` lines 116–128. Same hole in `createTransactionController` if `create` “succeeds” and you `return` before `commit`. Atlas (`MONGO_URI`), not `27018`, is why you see `112` — standalone `mongod` often cannot run these transactions at all.

**How:** `try { ... commit } catch { abort } finally { session.endSession() }`. Before any `return` inside the `try`, `await session.abortTransaction()`. Use `transaction._id`, never `transaction[0]` after destructure. If you already leaked: wait ~60s, or the abandoned txn expires. `112` + `TransientTransactionError` → retry the **same** key from a clean session, not a new UUID.

**Real world:** A checkout service that `return`s `500` after `INSERT` payment but before `COMMIT` leaves a lock; the user’s second tap WriteConflicts. Stripe retries TransientTransactionError with the **same** Idempotency-Key. Uber/GPay “processing” is that retry, not a new order id.

**Interview question:** You sent a new UUID and still got `WriteConflict`. What did the new key not fix?

**Answer:** An open or abandoned transaction still holding writes. `11000` is “this key exists.” `112` is “this session collided.” Different codes, different fixes.

---

## Balance is the sum of ledger rows

A transfer is two **immutable** rows: debit `−amount`, credit `+amount`. Balance is `$sum` of `amount` for that account. There is no `balance` field to `$inc`.

`min: [0]` on ledger `amount` rejects the debit row. `getBalance` that does `debits − credits` while both amounts are already signed double-counts.

**Why:** Two handlers reading `balance: 100` and both writing `80` is the lost update. Rows append. The sum is the truth. A `min: 0` validator makes the journal unable to record a debit.

**When:** Money movement. You do **not** `$inc` a cached balance as the source of truth. A display cache can exist later; it is not the book.

**Where:** `ledger.model.js` `amount` (signed). `account.model.js` `getBalance` `$sum: "$amount"`. `transcation.controller.js` `runTransfer` writes the pair.

**How:** `insert` `{ amount: -X, type: DEBIT }` and `{ amount: +X, type: CREDIT }`. Read: `aggregate $match account $group $sum amount`. Empty match → `0`.

**Real world:** A bank statement is a list of signed lines. The running total is derived. Your UPI app “₹2,400” is a sum (or a cache of that sum), not a cell you overwrite.

**Interview question:** Why not store `balance` on the account and `$inc` it?

**Answer:** Two transfers both read 100 and both write 80. Append-only rows cannot lose a write that way. The unique idempotency key still stops a retry from appending a second pair.

---

## GET after a write — derive, then authorize

`GET` does not create rows. It **reads** what `POST` already wrote. Balance on `GET /api/account/:id` is still `$sum` of ledger rows, not a field on the account.

A valid JWT is **authentication**. `findOne({ _id, userId: req.user._id })` is **authorization**. Without the owner filter, user A’s token reads user B’s journal.

**Why:** The statement is the product. If GET hid rows or showed another user’s lines, the transfer write is unprovable. Unique `_id` in the URL is not permission.

**When:** Every read of money or PII. You do **not** add a `balance` column to make GET faster until a cache is a measured problem. You do **not** skip the owner check because the id is “unguessable.”

**Where:** `GET /api/account`, `/:id`, `/:id/balance`, `/:id/ledger` in `account.controller.js`. `GET /api/transaction` and `/:id` in `transcation.controller.js`. `GET /api/auth/me`. Models stay the same — no GET-only schema.

**How:** Auth middleware → load ids this user owns → `find` / `findOne` with that filter → `getBalance()` = aggregate `$sum`. Foreign or missing id → `404` (do not leak “exists but not yours”).

**Real world:** GPay “History” is GET of your journal. Another user’s payment id in the URL must 404. A bank app “Available balance” is a sum (or a cache of that sum) over posted lines.

**Interview question:** `GET /api/account/:id` returns another user’s account. Which check is missing?

**Answer:** Authorization. The JWT proved who you are. It did not prove you own that `userId`.

---
