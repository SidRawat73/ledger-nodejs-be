const {userModel} = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { USER_ROLE } = require('../../constants');

async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({message: 'Unauthorized'});
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({message: 'Unauthorized'});
        }
        req.user = user;
        return next();
    } catch (error) {
        console.log(error,'error');
        return res.status(401).json({message: 'Unauthorized'});
    }
}

async function systemUserAuthMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({message: 'Unauthorized'});
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId).select('+systemUser');
        if (!user || !user.systemUser) {
            return res.status(401).json({message: 'Unauthorized'});
        }
        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).json({message: 'Unauthorized'});
    }
}   
module.exports = {authMiddleware, systemUserAuthMiddleware};