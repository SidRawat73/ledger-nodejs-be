const mongoose = require("mongoose");

async function connectToDB() {
    await mongoose.connect(process.env.MONGO_URI).then(()=>{
        console.log('server is connected to DB')
    })
    .catch((e)=>{
        console.log(e)
        process.exit(1);
    })
    ;
}

module.exports = { connectToDB };
