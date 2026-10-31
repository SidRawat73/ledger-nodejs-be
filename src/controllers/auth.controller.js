const { userModel } = require("../models/user.model");
const jwt = require('jsonwebtoken');
const emailService = require("../services/email.service");
/** 
 * - user register controller
 * - POST /api/auth/register
*/
async function userRegistrationController(req, res) {
    const { email, password, name } = req.body;

    const isExists = await userModel.exists({ email: email });
    if (isExists) {
        return res.status(422).json({ message: "User with same email already exists", status: "failed" });
    }
    try {
        const user = await userModel.create({
            email,
            password,
            name
        })
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie("token", token);
        res.status(201).json({
            message: "User created successfully",
            status: "success",
            body: {
                _id: user._id,
                email,
                name,
                token
            }
        })
        emailService.sendRegistrationEmail(email, name).catch((e) => console.log(e));
    } catch (error) {
        if (res.headersSent) return;
        return res.status(500).json({ message: "Internal server error", status: "failed", error: error.message });
    }


}
// sample user registration body
// {
//     email:"test@example.com",
//     password:"Test@123",
//     name:"Test User"
// }


/** 
 * - User login api
 * - /api/auth/login
 */
async function userLoginController(req, res) {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email: email }).select("+password");
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password", status: "failed" });
    }
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
        return res.status(401).json({ message: "Invalid email or password", status: "failed" });
    }
    try {
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie("token", token);
        res.status(200).json({
            message: "User logged in successfully",
            status: "success",
            body: {
                _id: user._id,
                email,
                name: user.name,
                token
            }
        })
    } catch (error) {
        res.status(500).json({ message: "Internal server error", status: "failed", error: error.message });
        console.log(error);
    }
}

async function meController(req, res) {
    return res.status(200).json({
        message: "ok",
        status: "success",
        body: { _id: req.user._id, email: req.user.email, name: req.user.name }
    });
}

module.exports = {
    userRegistrationController,
    userLoginController,
    meController
};