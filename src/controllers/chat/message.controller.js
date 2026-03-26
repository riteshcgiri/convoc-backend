const Message = require("../../models/Message.model");
const Chat = require("../../models/Chat.model");
const User = require('../../models/User.model')
const sendPushNotification = require('../../utils/sendPushNotification')
const LinkifyIt = require("linkify-it");
const linkify = new LinkifyIt();

const sendMessage = async (req, res) => {
  try {
    console.log("sendMessage body:", req.body);
    const { chatId, content, type, fileInfo, replyTo } = req.body;
    const currentUserId = req.user.id;

    const matches = content ? linkify.match(content) || [] : [];
    const extractedLinks = matches.map(m => m.url);

    if (!chatId) return res.status(400).json({ message: "Chat ID required" });

    if (!fileInfo && (!content || !content.trim())) return res.status(400).json({ message: "Message content required" });

    const chat = await Chat.findById(chatId);

    if (!chat)
      return res.status(404).json({ message: 'Chat not found' });

    if (chat.isGroupChat && chat.onlyAdminsCanMessage) {
      const userSetting = chat.userSettings.find(s => s.user.toString() === currentUserId);
      if (!userSetting?.isAdmin)
        return res.status(403).json({ message: "Only admins can send messages in this group" });
    }

    if (chat.isGroupChat) {
      const userSetting = chat.userSettings.find(s => s.user.toString() === currentUserId);
      if (userSetting?.mutedByAdmin) {
        return res.status(403).json({ message: "You have been muted by an admin" });
      }
    }

    const newMessage = await Message.create({
      chat: chatId,
      sender: currentUserId,
      content: fileInfo ? fileInfo?.name : content,
      type: type || "text",
      isFile: !!fileInfo,
      fileInfo: fileInfo || undefined,
      hasLinks: extractedLinks.length > 0,
      links: extractedLinks,
      replyTo: replyTo || null,
      deliveredTo: [currentUserId],
      readBy: [currentUserId],
    });

    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: newMessage._id,
      $set: { "userSettings.$[].deletedAt": null }
    });

    const fullMessage = await Message.findById(newMessage._id)
      .populate("sender", "name username avatar")
      .populate("replyTo", "content sender")
      .populate({ path: "replyTo", populate: { path: "sender", select: "name" } })
      .populate("chat");

    const io = req.app.get("io");
    const fullChat = await Chat.findById(chatId).populate("users", "_id");

    fullChat.users.forEach((user) => {
      if (user._id.toString() !== currentUserId) {
        io.to(user._id.toString()).emit("new_message", fullMessage);
      }
    });
    io.to(chatId.toString()).emit("new_message", fullMessage);

    // ── Push Notifications ────────────────────────────────────────────────────
    const onlineUsers = req.app.get("onlineUsers");
    console.log("Online users:", [...(onlineUsers?.keys() || [])]);
    console.log("Chat members:", fullChat.users.map(u => u._id.toString()));

    for (const user of fullChat.users) {
      if (user._id.toString() === currentUserId) {
        console.log("Skipping sender:", user._id); continue;
      }         
      if (onlineUsers?.has(user._id.toString())) {
        console.log("Skipping online user:", user._id); continue;
      }

      const member = await User.findById(user._id);
      console.log("Member subscription:", member?.pushSubscription?.endpoint);
      console.log("Member allowBrowserNotifications:", member?.allowBroswerNotifications);

      if (!member?.pushSubscription?.endpoint) {
        console.log("No subscription for:", user._id); continue;
      }
      if (!member.allowBroswerNotifications) {
        console.log("Notifications off for:", user._id); continue;
      }

      const setting = chat.userSettings.find(
        s => s.user.toString() === user._id.toString()
      );
      if (setting?.muted) continue;                                 

      await sendPushNotification(member.pushSubscription, {
        title: chat.isGroupChat ? chat.chatName : req.user.name,
        body: fileInfo
          ? `${req.user.name} sent a file`
          : chat.isGroupChat
            ? `${req.user.name}: ${content?.slice(0, 60)}`
            : content?.slice(0, 60),
        icon: "/favicon.png",
        badge: "/badge.png",
        chatId: chatId.toString(),
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(201).json(fullMessage);

  } catch (error) {
    console.error("sendMessage CRASH:", error.message, error.stack);
    res.status(500).json({ message: "Failed to send message" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user.id;

    const chat = await Chat.findById(chatId);

    const setting = chat.userSettings.find(
      s => s.user.toString() === currentUserId
    );

    const filter = {
      chat: chatId,
      isDeletedForEveryone: false,
      deletedFor: { $ne: currentUserId },
    };

    if (setting?.lastClearedAt) {
      filter.createdAt = { $gt: setting.lastClearedAt };
    }

    const messages = await Message.find(filter)
      .populate("sender", "name username")
      .populate("replyTo")
      .populate({ path: "replyTo", populate: { path: "sender", select: "name" } })
      .sort({ createdAt: 1 });

    res.json(messages);

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

const markAsDelivered = async (req, res) => {
  try {
    const { chatId } = req.body;
    const currentUserId = req.user.id;

    await Message.updateMany(
      {
        chat: chatId,
        deliveredTo: { $ne: currentUserId },
      },
      {
        $addToSet: { deliveredTo: currentUserId },
      }
    );

    res.json({ message: "Messages marked as delivered" });

  } catch (error) {
    res.status(500).json({ message: "Failed to update delivery status" });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.body;
    const currentUserId = req.user.id;

    await Message.updateMany(
      {
        chat: chatId,
        readBy: { $ne: currentUserId },
      },
      {
        $addToSet: { readBy: currentUserId },
      }
    );

    res.json({ message: "Messages marked as read" });

  } catch (error) {
    res.status(500).json({ message: "Failed to update read status" });
  }
};

const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const currentUserId = req.user.id;

    if (!content)
      return res.status(400).json({ message: "Content required" });

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== currentUserId) {
      return res.status(403).json({ message: "Not allowed to edit" });
    }

    if (message.isDeletedForEveryone)
      return res.status(400).json({ message: "Message deleted" });

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name avatar")
      .populate({ path: "replyTo", populate: { path: "sender", select: "name" } });
    const io = req.app.get("io");
    io.to(message.chat.toString()).emit("message_edited", populatedMessage);

    res.json(message);

  } catch (error) {
    res.status(500).json({ message: "Failed to edit message" });
  }
};

const deleteForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message)
      return res.status(404).json({ message: "Message not found" });

    if (!message.deletedFor.includes(currentUserId)) {
      message.deletedFor.push(currentUserId);
      await message.save();
      const io = req.app.get("io");
      io.to(message.chat.toString()).emit("message_deleted", {
        messageId: message._id,
        chatId: message.chat,
        userId: currentUserId,
        type: "me"
      });
    }


    res.json({ message: "Message deleted for you" });

  } catch (error) {
    res.status(500).json({ message: "Failed to delete message" });
  }
};

const deleteForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message)
      return res.status(404).json({ message: "Message not found" });


    if (message.sender.toString() !== currentUserId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    message.isDeletedForEveryone = true;
    message.content = "This message was deleted";
    message.deletedFor = [];
    await message.save();
    const io = req.app.get('io')
    io.to(message.chat.toString()).emit("message_deleted", { messageId: message._id, chatId: message.chat, type: "everyone" })

    res.json({ message: "Message deleted for everyone" });

  } catch (error) {
    res.status(500).json({ message: "Failed to delete message" });
  }
};

const getMessageInfo = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await Message.findById(messageId)
      .populate("deliveredTo", "name avatar")
      .populate("readBy", "name avatar")
      .populate("sender", "name avatar")
    if (!message) return res.status(404).json({ message: 'Message not found' })
    if (message.sender._id.toString() !== currentUserId) return res.status(403).json({ message: "Not Allowd" })

    res.json({
      _id: message._id,
      content: message.content,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deliveredTo: message.deliveredTo.filter(u => u._id.toString() !== currentUserId),
      readBy: message.readBy.filter(u => u._id.toString() !== currentUserId),
    })


  } catch (err) {
    res.status(500).json({ message: err?.message || 'Failed to get message info' })
  }
}

const searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;
    if (!q || q.trim() === "")
      return res.json([]);
    const userChats = await Chat.find({ users: currentUserId });
    const messages = await Message.find({
      chat: { $in: userChats.map((c) => c._id) },
      isDeletedForEveryone: false,
      deletedFor: { $ne: currentUserId },
      content: { $regex: q, $options: "i" },
    }).populate("sender", "name username avatar")
      .populate("chat", "isGroupChat chatName users")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(messages);

  }
  catch (error) {
    res.status(500).json({ message: error || 'failed to search message' })
  }
}

const getMediaFiles = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const messages = await Message.find({
      chat: chatId,
      isFile: true,
      isDeletedForEveryone: false,
      "fileInfo.category": { $in: ["image", "video", "audio"] },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("sender", "name avatar");

    const total = await Message.countDocuments({
      chat: chatId,
      isFile: true,
      isDeletedForEveryone: false,
      "fileInfo.category": { $in: ["image", "video", "audio"] },
    });

    res.json({ messages, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch media" });
  }
};

const getDocuments = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const messages = await Message.find({
      chat: chatId,
      isFile: true,
      isDeletedForEveryone: false,
      "fileInfo.category": { $in: ["pdf", "document", "spreadsheet", "presentation", "other"] },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("sender", "name avatar");

    const total = await Message.countDocuments({
      chat: chatId,
      isFile: true,
      isDeletedForEveryone: false,
      "fileInfo.category": { $in: ["pdf", "document", "spreadsheet", "presentation", "other"] },
    });

    res.json({ messages, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};

const getLinks = async (req, res) => {
  console.log("getLinks called:", req.params.chatId);
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const messages = await Message.find({
      chat: chatId,
      hasLinks: true,
      isDeletedForEveryone: false,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("sender", "name avatar");
    const total = await Message.countDocuments({
      chat: chatId,
      hasLinks: true,
      isDeletedForEveryone: false,
    });

    res.json({ messages, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("getLinks CRASH:", error.message, error.stack);
    res.status(500).json({ message: error });
  }
};

const bulkDeleteForMe = async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds?.length) return res.status(400).json({ message: "No messages selected" });

    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { deletedFor: req.user.id } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteForEveryone = async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds?.length) return res.status(400).json({ message: "No messages selected" });

    // Verify all messages belong to this user
    const messages = await Message.find({ _id: { $in: messageIds }, sender: req.user.id });
    if (messages.length !== messageIds.length) {
      return res.status(403).json({ message: "Can only delete your own messages" });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, sender: req.user.id },
      { isDeletedForEveryone: true }
    );

    // Emit socket events for each chat room
    const io = req.app.get("io");
    const grouped = {};
    messages.forEach(m => {
      const cid = m.chat.toString();
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push(m._id);
    });

    Object.entries(grouped).forEach(([chatId, ids]) => {
      ids.forEach(messageId => {
        io.to(chatId).emit("message_deleted", { messageId, chatId });
      });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { sendMessage, getMessages, markAsDelivered, markAsRead, editMessage, deleteForMe, deleteForEveryone, getMessageInfo, searchMessages, getMediaFiles, getDocuments, getLinks, bulkDeleteForMe, bulkDeleteForEveryone };

