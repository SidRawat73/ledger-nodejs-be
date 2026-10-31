const mongoose = require('mongoose');
const { ledgerModel } = require('./ledger.model');
const {ACCOUNT_ACTIVE_STATUS,ACCOUNT_FROZEN_STATUS,ACCOUNT_CLOSED_STATUS} = require('../../constants');

const accountSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        required:[true,"Account must be associated with a user"],
        index:true
    },
    status:{
        type:String,
        enum:{
            values:[ACCOUNT_ACTIVE_STATUS,ACCOUNT_FROZEN_STATUS,ACCOUNT_CLOSED_STATUS],
            message:"Account status must be one of the following: ACTIVE_ACCOUNT, FROZEN_ACCOUNT, CLOSED_ACCOUNT"
        },
        default:ACCOUNT_ACTIVE_STATUS
    },
    currency:{
        type:String,
        required:[true,"Account must have a currency"],
        enum:{
            values:["USD","EUR","GBP","JPY","AUD","CAD","CHF","CNY","HKD","INR","KRW","MXN","NZD","RUB","SAR","SEK","SGD","THB","TRY","TWD","ZAR"],
            message:"Currency must be one of the following: USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, HKD, INR, KRW, MXN, NZD, RUB, SAR, SEK, SGD, THB, TRY, TWD, ZAR"
        },
        default:"INR"
    },
    name:{
        type:String,
        required:[true,"Account must have a name"],
    },
    email:{
        type:String,
        required:[true,"Account must have an email"],
    },
}, {timestamps:true});

// compound index for userId and status
accountSchema.index({userId:1,status:1});

accountSchema.methods.getBalance = async function(){
    const ledgers = await ledgerModel.aggregate([
        { $match: { account: this._id } },
        { $group: { _id: null, balance: { $sum: "$amount" } } }
    ]);
    if (ledgers.length === 0) {
        return 0;
    }
    return ledgers[0].balance;
}

const accountModel = mongoose.model('account', accountSchema);

module.exports = {accountModel};