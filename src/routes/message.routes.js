const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { sendMessage, getMessages, markAsDelivered, markAsRead, editMessage, deleteForMe, deleteForEveryone, getMessageInfo, searchMessages, getMediaFiles, getDocuments, getLinks, bulkDeleteForMe, bulkDeleteForEveryone  } = require("../controllers/chat/message.controller");


router.use(protect);
router.post("/", sendMessage);
router.patch("/delivered", markAsDelivered);
router.patch("/read", markAsRead);
router.get("/search", searchMessages); 
router.get("/:chatId", getMessages);
router.patch("/:messageId/edit", editMessage);
router.patch("/:messageId/delete", deleteForMe);
router.patch("/:messageId/delete-everyone", deleteForEveryone);
router.get("/:messageId/info", getMessageInfo);
router.get("/:chatId/media/files", getMediaFiles)
router.get("/:chatId/media/docs", getDocuments)
router.get("/:chatId/media/links", getLinks)
router.patch("/bulk-delete",  bulkDeleteForMe);
router.patch("/bulk-delete-everyone",  bulkDeleteForEveryone);

module.exports = router;
