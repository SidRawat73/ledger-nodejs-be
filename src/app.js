const express = require("express");
const { authRouter } = require("./routes/auth.routes")
const { accountRouter } = require("./routes/account.routes")
const { transactionRouter } = require("./routes/transaction.routes")

const cookieParser = require("cookie-parser");
const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({ ok: true, message: "Ledger API is running" });
});

//health check route
app.get("/health", (req, res) => {
    res.status(200).json({ ok: true, db: "ledger" });
});

app.use("/api/auth",authRouter);
app.use("/api/account",accountRouter);
app.use("/api/transaction",transactionRouter);

module.exports = {app};
