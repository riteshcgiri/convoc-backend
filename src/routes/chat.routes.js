const express = require("express");
const router = express.Router();
const { accessChat, createGroupChat, getUserChats, toggleFavourite, deleteChatForUser, updateGroup, addGroupMembers, removeGroupMember, leaveGroup, makeAdmin, dismissAdmin, getGroupInfo, } = require("../controllers/chat/chat.controller");
const protect = require("../middlewares/auth.middleware");



router.use(protect);
router.post("/", accessChat);
router.get("/", getUserChats);
router.patch("/:chatId/favourite", toggleFavourite);
router.patch("/:chatId/delete", deleteChatForUser);
router.post("/group", createGroupChat);
router.get("/:chatId", getGroupInfo);
router.put("/:chatId", updateGroup);
router.delete("/:chatId/leave", leaveGroup);
router.post("/:chatId/members", addGroupMembers);
router.patch("/:chatId/admin/:userId", makeAdmin);
router.patch("/:chatId/dismiss/:userId", dismissAdmin);
router.delete("/:chatId/members/:userId", removeGroupMember);

module.exports = router;
