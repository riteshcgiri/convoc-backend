const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    notificationType : {
        type : String,
        enum : ["message", "alert", "admin", "changes"],
        default : "message",
    },
    chat : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Chat",
    },
    user: {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true,
    },
    sender : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
    },
    heading : {
        type : String,
        required : true,
    },
    content : {
        type : String,
        required : true,
    },
    isRead : {
        type : Boolean,
        default : false,
    },
    isDeleted : {
        type : Boolean,
        default : false,
    }
},
{
   timestamps: true
}
)

module.exports = mongoose.model("Notification", notificationSchema);