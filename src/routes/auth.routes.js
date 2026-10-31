const express = require('express');
const { userRegistrationController, userLoginController, meController } = require("../controllers/auth.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const authRouter = express.Router();

authRouter.post('/register', userRegistrationController);
authRouter.post('/login', userLoginController);
authRouter.get('/me', authMiddleware, meController);

module.exports = { authRouter };