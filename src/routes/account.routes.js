const express = require('express');
const accountRouter = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
    createAccountController,
    listAccountsController,
    getAccountController,
    getAccountBalanceController,
    getAccountLedgerController
} = require('../controllers/account.controller');

accountRouter.post('/create', authMiddleware, createAccountController);
accountRouter.get('/', authMiddleware, listAccountsController);
accountRouter.get('/:id/balance', authMiddleware, getAccountBalanceController);
accountRouter.get('/:id/ledger', authMiddleware, getAccountLedgerController);
accountRouter.get('/:id', authMiddleware, getAccountController);

module.exports = { accountRouter };