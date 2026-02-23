const express = require('express');
const {signIn, signUp, verifyOTP, resendOTP, requestPasswordReset, resetPassword, verifyResetOtp, getMe, searchUsers } = require('../controllers/auth/auth.controller.js')
const protect = require('../middlewares/auth.middleware.js')

const router = express.Router();

router.post("/signup", signUp)
router.post("/signin", signIn)
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/request-reset", requestPasswordReset);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.get("/me",protect, getMe);
router.get("/search",protect, searchUsers);   



module.exports = router;