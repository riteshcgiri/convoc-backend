const mongoose = require('mongoose');

const userUpdatedSchema = new mongoose.Schema(
    {
        // ---------- Core identity / auth ----------
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

        // ---------- Profile ----------
        profile: {
            avatar: { type: String, default: "" },
            poster: { type: String, default: "#6A67C2" },
            about: {
                type: String,
                maxlength: 500,
                default:
                    "Welcom to my Profile. I am Bit shy don't hesitate to initiate conversation.",
            },
        },

        // ---------- Verification (email + phone + OTP) ----------
        verification: {
            isVerified: { type: Boolean, default: false },
            otp: String,
            otpExpires: Date,

            isPhoneVerified: { type: Boolean, default: false },
            phoneOtp: String,
            phoneOtpExpires: Date,
        },

        // ---------- Security (password reset, account disable/reactivate) ----------
        security: {
            resetOtp: String,
            resetOtpExpires: Date,
            resetSession: { type: Boolean, default: false },

            passwordChangedCount: { type: Number, default: 0 },
            passwordChangedDate: Date,

            isDisabled: { type: Boolean, default: false },
            disabledAt: Date,
            reactivateToken: String,
            reactivateTokenExpires: Date,
            reactivatedAt: Date,
        },

        // ---------- Privacy ----------
        privacy: {
            onlineStatus: { type: Boolean, default: true },
            readReceipts: { type: Boolean, default: true },
            lastSeenVisibility: {
                type: String,
                enum: ["everyone", "friends", "nobody"],
            },
            profilePhotoVisibility: {
                type: String,
                enum: ["everyone", "friends", "nobody"],
            },
            groupAddPermission: {
                type: String,
                enum: ["everyone", "friends", "nobody"],
            },
        },

        // ---------- Notifications ----------
        notifications: {
            allowBroswerNotifications: { type: Boolean, default: true },
            muteNotifications: { type: Boolean, default: false },
            showPopups: { type: Boolean, default: true },
            pushSubscription: {
                endpoint: String,
                keys: {
                    p256dh: String,
                    auth: String,
                },
            },
        },

        // ---------- Activity / stats ----------
        activity: {
            userLastSeen: Date,
            lastOnlineAt: Date,
            totalMessagesCount: { type: Number, default: 0 },
            totalOnlineTime: { type: Number, default: 0 },
        },

        // ---------- Legal ----------
        legal: {
            tncAccepted: { type: Boolean, default: false },
            tncAcceptedAt: Date,
            agreePrivacy: { type: Boolean, default: false },
        },

        // ---------- Change history ----------
        history: {
            usernameChangedAt: Date,
            phoneChangedAt: Date,
        },

        // ---------- Relationships ----------
        friends: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        blockedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        // ---------- Chat preferences ----------
        chatPreferences: {
            enterToSend: { type: Boolean, default: true },
            autoDownloadImgs: { type: Boolean, default: true },
            autoDownloadVids: { type: Boolean, default: false },
            showTimeStamps: { type: Boolean, default: true },
            showAvatarInGroups: { type: Boolean, default: true },
            compactMode: { type: Boolean, default: false },
        },

        // ---------- Misc ----------
        offerLetter: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userUpdatedSchema);