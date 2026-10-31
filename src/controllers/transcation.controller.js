const mongoose = require('mongoose');

const { transactionModel } = require('../models/transaction.model');
const { ledgerModel } = require('../models/ledger.model');
const { accountModel } = require('../models/account.model');
const { ACCOUNT_ACTIVE_STATUS, TRANSACTION_STATUS, LEDGER_TYPE } = require('../../constants');
const { isObjectId } = require('../lib/ids');

async function replayByKey(idempotencyKey) {
    const transaction = await transactionModel.findOne({ idempotencyKey });
    if (!transaction) {
        return null;
    }
    const ledgers = await ledgerModel.find({ transaction: transaction._id });
    return {
        transaction,
        debitLedger: ledgers.find((row) => row.type === LEDGER_TYPE.DEBIT) || null,
        creditLedger: ledgers.find((row) => row.type === LEDGER_TYPE.CREDIT) || null
    };
}

async function runTransfer(res, {
    fromAccountId,
    toAccountId,
    amount,
    description,
    idempotencyKey
}) {
    const existing = await replayByKey(idempotencyKey);
    if (existing) {
        return res.status(200).json(existing);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;
    try {
        const [transaction] = await transactionModel.create([{
            fromAccount: fromAccountId,
            toAccount: toAccountId,
            amount,
            description,
            status: TRANSACTION_STATUS.PENDING,
            idempotencyKey
        }], { session });

        const [debitLedger] = await ledgerModel.create([{
            account: fromAccountId,
            amount: -amount,
            transaction: transaction._id,
            type: LEDGER_TYPE.DEBIT
        }], { session });

        const [creditLedger] = await ledgerModel.create([{
            account: toAccountId,
            amount,
            transaction: transaction._id,
            type: LEDGER_TYPE.CREDIT
        }], { session });

        transaction.status = TRANSACTION_STATUS.SUCCESS;
        await transaction.save({ session });
        await session.commitTransaction();
        committed = true;
        return res.status(201).json({ transaction, debitLedger, creditLedger });
    } catch (error) {
        if (error.code === 11000) {
            const replay = await replayByKey(idempotencyKey);
            if (replay) {
                return res.status(200).json(replay);
            }
        }
        console.log(error);
        return res.status(500).json({ message: 'Transaction failed', status: 'failed' });
    } finally {
        if (!committed) {
            try {
                await session.abortTransaction();
            } catch (_) { /* already committed or never started writes */ }
        }
        session.endSession();
    }
}

const createTransactionController = async (req, res) => {
    const { fromAccount, toAccount, amount, description, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({ message: 'All fields are required', status: 'failed' });
    }

    const fromUserAccount = await accountModel.findById(fromAccount);
    const toUserAccount = await accountModel.findById(toAccount);
    if (!fromUserAccount || !toUserAccount) {
        return res.status(400).json({ message: 'Account not found', status: 'failed' });
    }
    if (fromUserAccount.status !== ACCOUNT_ACTIVE_STATUS || toUserAccount.status !== ACCOUNT_ACTIVE_STATUS) {
        return res.status(400).json({ message: 'From account is not active', status: 'failed' });
    }

    const fromAccountBalance = await fromUserAccount.getBalance();
    if (fromAccountBalance < amount) {
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${fromAccountBalance} Requested amount is ${amount} `,
            status: 'failed'
        });
    }

    return runTransfer(res, {
        fromAccountId: fromAccount,
        toAccountId: toAccount,
        amount,
        description: description || "Transfer",
        idempotencyKey
    });
};

const createInitialFundsController = async (req, res) => {
    const { toAccount, amount, idempotencyKey } = req.body;
    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({ message: 'toAccount, amount, and idempotencyKey are required', status: 'failed' });
    }

    const userAccount = await accountModel.findById(toAccount);
    if (!userAccount) {
        return res.status(400).json({ message: 'Account not found', status: 'failed' });
    }
    const fromUserAccount = await accountModel.findOne({ userId: req.user._id });
    if (!fromUserAccount) {
        return res.status(400).json({ message: 'System user account not found', status: 'failed' });
    }

    return runTransfer(res, {
        fromAccountId: fromUserAccount._id,
        toAccountId: userAccount._id,
        amount,
        description: 'Initial funds',
        idempotencyKey
    });
};

async function myAccountIds(userId) {
    const accounts = await accountModel.find({ userId }).select("_id");
    return accounts.map((account) => account._id);
}

const listTransactionsController = async (req, res) => {
    const ids = await myAccountIds(req.user._id);
    const transactions = await transactionModel
        .find({ $or: [{ fromAccount: { $in: ids } }, { toAccount: { $in: ids } }] })
        .sort({ createdAt: -1 });
    return res.status(200).json({ message: "ok", status: "success", body: transactions });
};

const getTransactionController = async (req, res) => {
    const { id } = req.params;
    if (!isObjectId(id)) {
        return res.status(400).json({ message: "Invalid transaction id", status: "failed" });
    }
    const ids = await myAccountIds(req.user._id);
    const transaction = await transactionModel.findOne({
        _id: id,
        $or: [{ fromAccount: { $in: ids } }, { toAccount: { $in: ids } }]
    });
    if (!transaction) {
        return res.status(404).json({ message: "Transaction not found", status: "failed" });
    }
    const ledgers = await ledgerModel.find({ transaction: transaction._id });
    return res.status(200).json({
        message: "ok",
        status: "success",
        body: {
            transaction,
            debitLedger: ledgers.find((row) => row.type === LEDGER_TYPE.DEBIT) || null,
            creditLedger: ledgers.find((row) => row.type === LEDGER_TYPE.CREDIT) || null
        }
    });
};

module.exports = {
    createTransactionController,
    createInitialFundsController,
    listTransactionsController,
    getTransactionController
};
