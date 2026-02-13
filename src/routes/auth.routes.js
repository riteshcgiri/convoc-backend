const express = require('express');
const {signIn, signUp, verifyOTP, resendOTP, requestPasswordReset, resetPassword, verifyResetOtp} = require('../controllers/auth/auth.controller.js')


const router = express.Router();

router.post("/signup", signUp)
router.post("/signin", signIn)
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/request-reset", requestPasswordReset);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);



module.exports = router;