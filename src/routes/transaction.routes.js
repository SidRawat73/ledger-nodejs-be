const { Router } = require('express');
const { authMiddleware, systemUserAuthMiddleware } = require('../middlewares/auth.middleware');

const {
    createTransactionController,
    createInitialFundsController,
    listTransactionsController,
    getTransactionController
} = require('../controllers/transcation.controller');

const transactionRouter = Router();

transactionRouter.get('/', authMiddleware, listTransactionsController);
transactionRouter.get('/:id', authMiddleware, getTransactionController);

/** @route POST /api/transaction
 * @description Create a transaction
 * @access Private
 * @param {string} fromAccount - The ID of the account to debit
 * @param {string} toAccount - The ID of the account to credit
 * @param {number} amount - The amount of the transaction
 * @param {string} description - The description of the transaction
 * @param {string} idempotencyKey - The idempotency key of the transaction
 */
transactionRouter.post('/',authMiddleware,createTransactionController);


/** @route POST /api/transaction/system/initial-funds
 * @description Create initial funds for the system
 * @access Private
 * @param {string} account - The ID of the account to credit
 * @param {number} amount - The amount of the transaction
 */
transactionRouter.post('/system/initial-funds',systemUserAuthMiddleware,createInitialFundsController);


//sample body for create initial funds
// {
//     "toAccount": "668000000000000000000000",
//     "amount": 1000,
//     "idempotencyKey": "1234567890"
// }

module.exports = {transactionRouter}; 