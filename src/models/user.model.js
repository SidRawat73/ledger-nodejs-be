const mongoose = require('mongoose');
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    email:{
        type:String,
        required:[true,"Email is required"],
        trim:true,
        match:[/^[^\s@]+@[^\s@]+\.[^\s@]+$/,"Please enter a valid email address"],
        lowercase:true,
        unique:[true,"Email already exists"],
    },
    password:{
        type:String,
        required:[true,"Password is required"],
        minlength:[4,"Password must be at least 8 characters long"],
        maxlength:[32,"Password must be at most 32 characters long"],
        match:[/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/,"Please enter a valid password"],
        select:false,
    },
    name:{
        type:String,
        required:[true,"Name is required"],
        trim:true,
    },
    createdAt:{
        type:Date,
        default:Date.now,
    },
    systemUser:{
        type:Boolean,
        default:false,
        immutable:true,
        select:false,
    },
},{
    timestamps:true
})

userSchema.pre('save',async function(next){
    if(!this.isModified('password')){
        return;
    }
    this.password = await bcrypt.hash(this.password,10);
    return;
});

userSchema.methods.comparePassword = async function(password){
    return await bcrypt.compare(password,this.password);
};


const userModel = mongoose.model('User',userSchema);
module.exports = {userModel};