const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true,
    },
    initiator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ["audio", "video"],
        required: true,
    },
    status: {
        type: String,
        enum: ["completed", "missed", "rejected", "cancelled"],
        required: true,
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },
}, {timeStamps : true});

module.exports  = mongoose.model("callLogSchema", callLogSchema);