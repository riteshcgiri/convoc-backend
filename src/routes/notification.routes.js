const express = require('express')
const router = express.Router()
const protect = require("../middlewares/auth.middleware")
const { getNotifications, markAsRead, deleteNotification, markAllAsRead, deleteAllNotifications} = require('../controllers/notification/notification.controller')


router.use(protect);
router.get("/", getNotifications);
router.patch("/read-all-notifications", markAllAsRead)
router.patch("/delete-all-notifications", deleteAllNotifications)
router.patch("/:notificationId/read-notification", markAsRead)
router.patch("/:notificationId/delete-notification", deleteNotification)

module.exports = router;












