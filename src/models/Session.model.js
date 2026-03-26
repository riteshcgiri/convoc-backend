const mongoose = require('mongoose')

const sessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    token: {
        type: String,
        required: true,
    },
    device: String,
    browser: String,
    os: String,
    ip: String,
    location: {
        city: String,
        country: String,
        region: String,
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,

})

module.exports = mongoose.model('Session', sessionSchema)