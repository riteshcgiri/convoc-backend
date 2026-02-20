const Message = require("../../models/Message.model");
const Chat = require("../../models/Chat.model");

const sendMessage = async (req, res) => {
  try {
    const { chatId, content, type, fileUrl, replyTo } = req.body;
    const currentUserId = req.user.id;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID required" });
    }

    if (!content && !fileUrl) {
      return res.status(400).json({ message: "Message content required" });
    }

    // Create message
    const newMessage = await Message.create({
      chat: chatId,
      sender: currentUserId,
      content,
      type: type || "text",
      fileUrl,
      replyTo,
      deliveredTo: [currentUserId], // sender auto delivered
      readBy: [currentUserId], // sender auto read
    });

    // Update latestMessage in chat
    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: newMessage._id,
    });

    // Populate message fully
    const fullMessage = await Message.findById(newMessage._id)
      .populate("sender", "name username avatar")
      .populate("replyTo")
      .populate("chat");

    const io = req.app.get("io");
    const chat = await Chat.findById(chatId).populate("users", "_id");

    chat.users.forEach((user) => {
      if (user._id.toString() !== currentUserId) {
        io.to(user._id.toString()).emit("new_message", fullMessage);
      }
    });

    // ALSO emit to chat room
    io.to(chatId.toString()).emit("new_message", fullMessage);



    res.status(201).json(fullMessage);

  } catch (error) {
    console.error(error);
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

    res.json({ message: "Message deleted for everyone" });

  } catch (error) {
    res.status(500).json({ message: "Failed to delete message" });
  }
};

module.exports = { sendMessage, getMessages, markAsDelivered, markAsRead, editMessage, deleteForMe, deleteForEveryone, };

