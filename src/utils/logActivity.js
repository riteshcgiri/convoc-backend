const ActivityLog = require('../models/ActivityLog.model.js')

const logActivity = async ({userId, action, metadata = {}, ip = '', device = '', isUserVisible = true}) => {
    try {
        console.log("logActivity called:", action, userId); 
        await ActivityLog.create({
            user : userId,
            action,
            metadata, 
            ip,
            device,
            isUserVisible
        })
        console.log("logActivity saved:", log._id);
    } catch (error) {
         console.error("Failed to log activity:", error.message);
    }
}

module.exports = logActivity;