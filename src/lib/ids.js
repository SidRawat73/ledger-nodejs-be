const mongoose = require("mongoose");

function isObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

module.exports = { isObjectId };
