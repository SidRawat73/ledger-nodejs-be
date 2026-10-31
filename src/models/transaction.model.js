const mongoose = require('mongoose');
const { TRANSACTION_STATUS } = require('../../constants');

const transactionSchema = new mongoose.Schema({
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'From account is required'],
        index: true
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'To account is required'],
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount must be greater than 0']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        max: [100, 'Description must be less than 100 characters']
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: {
            values : Object.values(TRANSACTION_STATUS),
            message: "Status can only be PENDING, SUCCESS, FAILED or REVERSED"
        },
        default: TRANSACTION_STATUS.PENDING
    },
    idempotencyKey: {
        type: String,
        required: [true, 'Idempotency key is required'],
        unique: true,
        index: true
    }
}, {timestamps: true});

const transactionModel = mongoose.model('transaction', transactionSchema);

module.exports = {transactionModel};