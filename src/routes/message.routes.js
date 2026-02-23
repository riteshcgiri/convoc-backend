const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { sendMessage, getMessages, markAsDelivered, markAsRead, editMessage, deleteForMe, deleteForEveryone, searchMessages } = require("../controllers/chat/message.controller");



// 🔐 All routes protected
router.use(protect);

// Send message
router.post("/", sendMessage);


// Mark delivered
router.patch("/delivered", markAsDelivered);

// Mark read
router.patch("/read", markAsRead);

// search messages
router.get("/search", searchMessages); 

// Get messages of chat
router.get("/:chatId", getMessages);

// Edit message
router.patch("/:messageId/edit", editMessage);

// Delete for me
router.patch("/:messageId/delete", deleteForMe);

// Delete for everyone
router.patch("/:messageId/delete-everyone", deleteForEveryone);

module.exports = router;
