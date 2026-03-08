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
    phoneVerified: {
        type: Boolean,
        default: false,
    },
    avatar: {
        type: String,
        default: "",
    },
    poster: {
        type: String,
        default: "#6A67C2",
    },
    about: {
        type: String,
        maxlength: 500,
        default: "Welcom to my Profile. I am Bit shy don't hesitate to initiate conversation."

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
    phoneOtp: {
        type: String,
    },
    phoneOtpExpires: {
        type: Date
    },
    isPhoneVerified : {
        type : Boolean,
        default : false
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
    agreePrivacy: {
        type: Boolean,
        default: false,
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
    isDisabled: {
        type: Boolean,
        default: false,
    },
    disabledAt: Date,
    allowBroswerNotifications: {
        type: Boolean,
        default: true,
    },
    muteNotifications: {
        type: Boolean,
        default: false,
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],


},
    { timestamps: true }
)

module.exports = mongoose.model("User", userSchema);