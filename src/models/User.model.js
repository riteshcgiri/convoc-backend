const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minLength: 6,
    },
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: Number,
        unique: true,
        trim: true,
        minLength: 10,
    },
    avatar: {
        type: String,
        default: "",
    },
    poster: {
        type: String,
        default: "#6A67C2",
    },
    status: {
        type: String,
        default: "offline",
    },
    lastSeen: {
        type: Date,
    },
    otp: {
        type: String
    },
    otpExpires: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
    },

    tncAccepted: {
        type: Boolean,
        default: false,
    },
    tncAcceptedAt: {
        type: Date,
    },
    resetOtp: {
        type: String,
    },
    resetOtpExpires: {
        type: Date,
    },
    resetSession: {
        type: Boolean,
        default: false,
    },

},
    { timestamps: true }
)

module.exports = mongoose.model("User", userSchema);