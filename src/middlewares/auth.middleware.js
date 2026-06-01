const jwt = require('jsonwebtoken')
const User = require('../models/User.model.js')
const Session = require('../models/Session.model.js')
const crypto = require('crypto')


const protect = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "No token" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ✅ check if session is still active
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const session = await Session.findOne({ token: hashedToken });

        if (!session || !session.isActive) {
            return res.status(401).json({ message: "Session expired. Please login again." });
        }

        // update lastActive
        session.lastActive = new Date();
        await session.save();

        req.user = decoded;
        console.log("USER:", req.user);
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = protect;