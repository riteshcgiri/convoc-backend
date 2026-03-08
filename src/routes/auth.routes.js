const express = require('express');
const { signIn, signUp, verifyOTP, resendOTP, requestPasswordReset, resetPassword, verifyResetOtp, getMe, searchUsers, updateProfile, changePassword, sendPhoneOtp, verifyPhoneOtp, disableAccount, deleteAccount, getFriends, addFriend, removeFriend } = require('../controllers/auth/auth.controller.js')
const protect = require('../middlewares/auth.middleware.js')

const router = express.Router();

router.post("/signup", signUp)
router.post("/signin", signIn)
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/request-reset", requestPasswordReset);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);
router.get("/search", protect, searchUsers);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.post("/send-phone-otp", protect, sendPhoneOtp);      // blocked for now
router.post("/verify-phone-otp", protect, verifyPhoneOtp);  // blocked for now
router.put("/disable-account", protect, disableAccount);
router.delete("/delete-account", protect, deleteAccount);
router.get("/friends", protect, getFriends);
router.post("/friends/:userId", protect, addFriend);
router.delete("/friends/:userId", protect, removeFriend);



module.exports = router;