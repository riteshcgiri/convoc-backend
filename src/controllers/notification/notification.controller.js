const Notification = require('../../models/Notification.model');
const Chat = require('../../models/Chat.model');
const User = require('../../models/User.model');

const createNotification = async ({ req, notificationType = "message", chat, user, sender, heading = 'Someone sent you a message', content }) => {

    if (!user) return console.error("createNotification: user is required")
    if (!heading) return console.error("createNotification: heading is required")
    if (!content) return console.error("createNotification: content is required")


    try {
        const notification = await Notification.create({
            notificationType,
            chat: chat || null,
            user,
            sender: sender || null,
            heading,
            content,
        })

        const fullNotification = await Notification.findById(notification._id)
            .populate('sender', 'name avatar')
            .populate('chat', "chatName isGroupChat")
            .lean()

        const io = req.app.get('io')
        io.to(user.toString()).emit("new_notification", fullNotification)

        return fullNotification;

    } catch (error) {
        console.log('Create Notfication Err : ', error)
    }
}

const getNotifications = async (req, res) => {

    try {

        const notifications = await Notification.find({
            user: req.user.id,
            isDeleted: false,
        })
            .populate("sender", "name avatar")
            .populate("chat")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: notifications.length,
            notifications
        })

    } catch (error) {
        console.log('Get Notification Err :', error)
        res.status(500).json({
            success: false,
            message: error?.message || "Failed to get Notification"
        })
    }
}

const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!notificationId) return res.status(400).json({ success: false, message: "Notification Id is required" })

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, user: req.user.id },
            { isRead: true },
            { new: true }
        );


        if (!notification) return res.status(404).json({ success: false, message: "Notification Not Found" })

        const fullNotification = await Notification.findById(notification._id)
            .populate('sender', 'name avatar')
            .populate('chat', "chatName isGroupChat")
            .lean()
        res.status(200).json({
            success: true,
            fullNotification
        })

    } catch (error) {
        console.log("Notification Read Err", error)
        res.status(500).json({
            success: false,
            message: error?.message || "Failed to Read Notification",
        })
    }
}

const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!notificationId) return res.status(400).json({ success: false, message: "Notification Id is required" })

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, user: req.user.id },
            { isDeleted: true },
            { new: true },
        )

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found", });
        }

        res.status(200).json({
            success: true,
            notification,
        })
    } catch (error) {
        console.log("Delete Notification Err : ", error);
        res.status(500).json({ success: false, message: error?.message || "Failed to delete Notification" })
    }
}

const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                user: req.user.id,
                isRead: false,
            },
            {
                $set: {
                    isRead: true,
                }
            }
        );

        res.status(200).json({ success: true, message: 'All Notifications marked as read' })
    } catch (error) {
        console.log("Mark All Notification Err : ", error)
        res.status(500).json({ success: false, message: error?.message || " Failed to Mark Read All Notifications" })
    }
}

const deleteAllNotifications = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                user: req.user.id,
                isDeleted: false,
            },
            {
                $set: {
                    isDeleted: true,
                }
            }
        );

        res.status(200).json({ success: true, message: 'All Notifications deleted' })
    } catch (error) {
        console.log("Mark All Notification Err : ", error)
        res.status(500).json({ success: false, message: error?.message || " Failed to Delete All Notifications" })
    }
}


module.exports = { createNotification, getNotifications, markAsRead, deleteNotification, markAllAsRead, deleteAllNotifications }
