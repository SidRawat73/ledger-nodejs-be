const {accountModel} = require('../models/account.model');
const {userModel} = require('../models/user.model');
const {ledgerModel} = require('../models/ledger.model');
const { ACCOUNT_ACTIVE_STATUS } = require('../../constants');
const { isObjectId } = require('../lib/ids');

async function ownedAccount(req, res) {
    const { id } = req.params;
    if (!isObjectId(id)) {
        res.status(400).json({ message: 'Invalid account id', status: 'failed' });
        return null;
    }
    const account = await accountModel.findOne({ _id: id, userId: req.user._id });
    if (!account) {
        res.status(404).json({ message: 'Account not found', status: 'failed' });
        return null;
    }
    return account;
}


/**
 * - create account controller
 * - POST /api/account/create
 * - middleware: authMiddleware
 * - body: {status: string, currency: string}
 * - response: {message: string, status: string, body: object}
 */
async function createAccountController(req, res) {
    const userId = req.user._id;
    // status and currency are optional and default to ACTIVE_ACCOUNT and INR respectively
    // if status is not provided, it will be set to ACTIVE_ACCOUNT
    // if currency is not provided, it will be set to INR
    const status = req.body?.status || ACCOUNT_ACTIVE_STATUS;
    const currency = req.body?.currency || "INR";

    const user = await userModel.findById(userId);

    if (!user.name || !user.email) {
        return res.status(400).json({ message: 'Name and email are required', status: 'failed' });
    }
    try {
        const account = await accountModel.create({userId, status, currency, name: user.name, email: user.email});
        res.status(201).json({
            message: 'Account created successfully',
            status: 'success',
            body: account
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
            status: 'error',
            body: error
        });
    }
}

// sample body
// {
//     "status": "ACTIVE_ACCOUNT",
//     "currency": "INR"
// }
async function listAccountsController(req, res) {
    const accounts = await accountModel.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const body = await Promise.all(accounts.map(async (account) => ({
        ...account.toObject(),
        balance: await account.getBalance()
    })));
    return res.status(200).json({ message: 'ok', status: 'success', body });
}

async function getAccountController(req, res) {
    const account = await ownedAccount(req, res);
    if (!account) return;
    const balance = await account.getBalance();
    return res.status(200).json({
        message: 'ok',
        status: 'success',
        body: { ...account.toObject(), balance }
    });
}

async function getAccountBalanceController(req, res) {
    const account = await ownedAccount(req, res);
    if (!account) return;
    const balance = await account.getBalance();
    return res.status(200).json({
        message: 'ok',
        status: 'success',
        body: { accountId: account._id, balance, currency: account.currency }
    });
}

async function getAccountLedgerController(req, res) {
    const account = await ownedAccount(req, res);
    if (!account) return;
    const rows = await ledgerModel.find({ account: account._id }).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'ok', status: 'success', body: rows });
}

module.exports = {
    createAccountController,
    listAccountsController,
    getAccountController,
    getAccountBalanceController,
    getAccountLedgerController
};