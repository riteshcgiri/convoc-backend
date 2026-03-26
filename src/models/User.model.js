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
    isPhoneVerified: {
        type: Boolean,
        default: false
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
    reactivateToken: String,
    reactivateTokenExpires: Date,
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
    showPopups: {
        type: Boolean,
        default: true,
    },
    offerLetter: {
        type: Boolean,
        default: false,
    },
    usernameChangedAt: Date,
    phoneChangedAt: Date,
    passwordChangedCount: { type: Number, default: 0 },
    passwordChangedDate: Date,
    reactivatedAt: Date,
    totalMessagesCount: { type: Number, default: 0 },
    totalOnlineTime: { type: Number, default: 0 },
    lastOnlineAt: Date,
    pushSubscription : {
        endpoint : String,
        keys : {
            p256dh : String,
            auth : String,
        }
    }
},
    { timestamps: true }
)

module.exports = mongoose.model("User", userSchema);