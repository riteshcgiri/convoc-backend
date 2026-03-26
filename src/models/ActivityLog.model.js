const mongoose = require('mongoose');   

const activityLogSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    action: {
        type: String,
        enum: [
            "login", "logout", "logout_all",
            "password_changed", "username_changed",
            "phone_changed", "profile_updated",
            "account_disabled", "account_reactivated", "account_deleted",
            "group_joined", "group_left", "group_created",
            "friend_added", "friend_removed",
            "message_sent", "message_deleted",
        ]
    },
    metadata: { type: mongoose.Schema.Types.Mixed }, // extra info like old/new username
    ip: String,
    device: String,
    createdAt: { type: Date, default: Date.now },
    isUserVisible: { type: Boolean, default: true }, // false = only admin/debug
});

module.exports = mongoose.model('ActivityLog', activityLogSchema)