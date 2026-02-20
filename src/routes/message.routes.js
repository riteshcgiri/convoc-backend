const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { sendMessage, getMessages, markAsDelivered, markAsRead, editMessage, deleteForMe, deleteForEveryone, } = require("../controllers/chat/message.controller");



// 🔐 All routes protected
router.use(protect);

// Send message
router.post("/", sendMessage);

// Get messages of chat
router.get("/:chatId", getMessages);

// Mark delivered
router.patch("/delivered", markAsDelivered);

// Mark read
router.patch("/read", markAsRead);

// Edit message
router.patch("/:messageId/edit", editMessage);

// Delete for me
router.patch("/:messageId/delete", deleteForMe);

// Delete for everyone
router.patch("/:messageId/delete-everyone", deleteForEveryone);

module.exports = router;
