const mongoose = require('mongoose');


const chatSchema = new mongoose.Schema({
    isGroupChat: {
        type: Boolean,
        default: false,
    },
    chatName: {
        type: String,
        required: function () {
            return this.isGroupChat;
        },
        trim: true,
    },
    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    groupAvatar: String,
    groupBannerColor: {
        type: String,
        default: "#6366f1", // fallback
    },
    groupAbout: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    groupType: {
        type: String,
        enum: ["study", "entertainment", "exploration", "work", "family", "friends", "custom"],
        default: "custom",
    },
    groupTypeLabel: {
        type: String,
        trim: true,
        maxlength: 30,
    },
    onlyAdminsCanMessage: {
        type: Boolean,
        default: false,
    },
    onlyAdminsCanAddMembers: {
        type: Boolean,
        default: false,
    },
    onlyAdminsCanEditInfo: {
        type: Boolean,
        default: false,
    },
    pinnedMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    inviteLink: {
        type: String,
        unique: true,
        sparse: true, // only unique when set
    },
    latestMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
    },
    userSettings: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },

            favourite: {
                type: Boolean,
                default: false,
            },
            archived: {
                type: Boolean,
                default: false,
            },
            isAdmin: {
                type: Boolean,
                default: false,
            },
            muted: {
                type: Boolean,
                default: false,
            },
            mutedUntil: {
                type: Date,
            },
            mutedByAdmin: {
                type: Boolean,
                default: false,
            },
            joinedAt: {
                type: Date,
                default: Date.now,
            },
            deletedAt: Date,
            lastClearedAt: Date,
        }],
    isDeleted: {
        type: Boolean,
        default: false,
    },
},
    { timestamps: true }
)

chatSchema.index({ users: 1 });
chatSchema.index({ inviteLink: 1 });

module.exports = mongoose.model("Chat", chatSchema);
