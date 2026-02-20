const express = require("express");
const router = express.Router();
const { accessChat, createGroupChat, getUserChats, toggleFavourite, deleteChatForUser, updateGroup, } = require("../controllers/chat/chat.controller");
const protect = require("../middlewares/auth.middleware");



// 🔐 All routes protected
router.use(protect);

// Create or access 1-1 chat
router.post("/", accessChat);

// Create group chat
router.post("/group", createGroupChat);

// Get all user chats (with filter)
router.get("/", getUserChats);

// Toggle favourite
router.patch("/:chatId/favourite", toggleFavourite);

// Delete chat (soft delete with lastClearedAt)
router.patch("/:chatId/delete", deleteChatForUser);

// Update group
router.put("/:chatId", updateGroup);

module.exports = router;
