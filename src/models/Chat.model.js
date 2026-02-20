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
        maxlength: 200,
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
            muted: {
                type: Boolean,
                default: false,
            },
            favourite: {
                type: Boolean,
                default: false,
            },
            archived: {
                type: Boolean,
                default: false,
            },
            deletedAt: Date,
            lastClearedAt: Date, // 🔥 important
        },
    ],
    isDeleted: {
        type: Boolean,
        default: false,
    },
},
    { timestamps: true}
)

chatSchema.index({ users: 1 });

module.exports = mongoose.model("Chat", chatSchema);
