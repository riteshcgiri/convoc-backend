const CallLog = require('../../models/CallLog.model');

const createCallLog = async ({ chatId, initiatorId, receiverId, type, status, startedAt, endedAt }) => {
    try {
        const duration = startedAt && endedAt ? Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000) : 0;

       const log = await CallLog.create({
            chat: chatId,
            initiator: initiatorId,
            receiver: receiverId,
            type,
            status,
            startedAt,
            endedAt,
            duration,
        })

        return log
    } catch (error) {
        console.error("createCallLog error:", error)
    }
}

const getCallLogs = async (req, res) => {
    try {
        const logs = await CallLog.find({ $or: [{ initiator: req.user.id }, { receiver: req.user.id }], })
            .populate("initiator", "name avatar username")
            .populate("receiver", "name avatar username")
            .populate("chat", "_id chatName isGroupChat")
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: err.message })
    }
}

const deleteCallLog = async (req, res) => {
    try {
        await CallLog.findByIdAndDelete(req.params.logId)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
}

module.exports = { createCallLog, getCallLogs, deleteCallLog }