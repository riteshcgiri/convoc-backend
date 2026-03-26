const Message = require("./models/Message.model");
const Chat = require("./models/Chat.model");
const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.set("io", io);

// Track online users { userId: socketId }
const onlineUsers = new Map();
app.set("onlineUsers", onlineUsers);

io.on("connection", (socket) => {

  console.log("Socket connected:", socket.id);

  socket.on("setup", async (userId) => {
    socket.join(userId);
    socket.userId = userId; // store on socket for disconnect

    onlineUsers.set(userId, socket.id);

    // Notify all chat members this user is online
    try {
      const chats = await Chat.find({ users: userId });
      chats.forEach((chat) => {
        chat.users.forEach((memberId) => {
          if (memberId.toString() !== userId) {
            io.to(memberId.toString()).emit("user_online", userId);
          }
        });
      });
    } catch (err) {
      console.error("Error emitting user_online:", err);
    }

    // Mark undelivered messages as delivered
    try {
      const chats = await Chat.find({ users: userId });
      for (const chat of chats) {
        const updated = await Message.updateMany(
          {
            chat: chat._id,
            sender: { $ne: userId },
            deliveredTo: { $ne: userId },
          },
          { $addToSet: { deliveredTo: userId } }
        );

        if (updated.modifiedCount > 0) {
          const senderIds = await Message.find({
            chat: chat._id,
            deliveredTo: userId,
          }).distinct("sender");

          senderIds.forEach((senderId) => {
            io.to(senderId.toString()).emit("message_status_updated", {
              chatId: chat._id.toString(),
              userId,
              type: "delivered",
            });
          });
        }
      }
    } catch (err) {
      console.error("Error marking delivered on setup:", err);
    }
  });

  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log("User joined chat room:", chatId);
  });

  socket.on("typing", (chatId) => {
    socket.to(chatId).emit("typing", chatId);
  });

  socket.on("stop_typing", (chatId) => {
    socket.to(chatId).emit("stop_typing", chatId);
  });

  socket.on("message_delivered", async ({ chatId, userId }) => {
    try {
      const updated = await Message.updateMany(
        { chat: chatId, sender: { $ne: userId }, deliveredTo: { $ne: userId } },
        { $addToSet: { deliveredTo: userId } }
      );

      if (updated.modifiedCount > 0) {
        const senderIds = await Message.find({
          chat: chatId, deliveredTo: userId,
        }).distinct("sender");

        senderIds.forEach((senderId) => {
          io.to(senderId.toString()).emit("message_status_updated", {
            chatId, userId, type: "delivered",
          });
        });
      }
    } catch (err) {
      console.error("Error in message_delivered:", err);
    }
  });

  socket.on("message_read", async ({ chatId, userId }) => {
    try {
      const updated = await Message.updateMany(
        { chat: chatId, sender: { $ne: userId }, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      if (updated.modifiedCount > 0) {
        const senderIds = await Message.find({
          chat: chatId, readBy: userId,
        }).distinct("sender");

        senderIds.forEach((senderId) => {
          io.to(senderId.toString()).emit("message_status_updated", {
            chatId, userId, type: "read",
          });
        });
      }
    } catch (err) {
      console.error("Error in message_read:", err);
    }
  });
  socket.on("get_online_users", async (userId) => {
    try {
      const chats = await Chat.find({ users: userId });
      const contactIds = new Set();

      chats.forEach((chat) => {
        chat.users.forEach((memberId) => {
          if (memberId.toString() !== userId) {
            contactIds.add(memberId.toString());
          }
        });
      });

      // Filter which contacts are currently online
      const onlineContactIds = [...contactIds].filter((id) =>
        onlineUsers.has(id)
      );

      socket.emit("online_users_list", onlineContactIds);
    } catch (err) {
      console.error("Error in get_online_users:", err);
    }
  });
  socket.on("leave_chat", (chatId) => {
    socket.leave(chatId);
    console.log("User left chat room:", chatId);
  });

  // File signaling events
  socket.on("file_offer", ({ targetUserId, offer, fileInfo }) => {
    console.log("file_offer received, fileInfo:", fileInfo);
    // validate fileInfo
    if (!fileInfo?.name || !fileInfo?.size || !fileInfo?.type) return;
    if (fileInfo.size > 25 * 1024 * 1024) return; // block large on server too

    const dangerousExtensions = ["exe", "sh", "bat", "cmd", "php", "py", "vbs", "ps1", "msi", "dll", "jar"];
    const ext = fileInfo.name.split(".").pop().toLowerCase();
    if (dangerousExtensions.includes(ext)) return;

    // forward to target user
    io.to(targetUserId).emit("file_offer", {
      fromUserId: socket.userId,
      fromUserName: socket.userName,
      offer,
      fileInfo,
      autoAccept: true,
    });
  });

  socket.on("file_answer", ({ targetUserId, answer }) => {
    io.to(targetUserId).emit("file_answer", { answer });
  });

  socket.on("file_ice_candidate", ({ targetUserId, candidate }) => {
    io.to(targetUserId).emit("file_ice_candidate", { candidate });
  });

  socket.on("file_rejected", ({ targetUserId }) => {
    io.to(targetUserId).emit("file_rejected");
  });

  // Calling events start here
  socket.on("call_user", ({ targetUserId, callerName, callerAvatar, chatId, type }) => {
    io.to(targetUserId).emit("incoming_call", { callerId: socket.userId, callerName, callerAvatar, chatId, type,  })
  });

  socket.on("call_accepted", ({ targetUserId, chatId }) => {
    io.to(targetUserId).emit("call_accepted", { userId: socket.userId, chatId })
  });

  socket.on("call_rejected", ({ targetUserId }) => {
    io.to(targetUserId).emit("call_rejected", { userId: socket.userId })
  });

  socket.on("call_offer", ({ targetUserId, offer }) => {
    io.to(targetUserId).emit("call_offer", { offer, callerId: socket.userId })
  })

  socket.on("call_answer", ({ targetUserId, answer }) => {
    io.to(targetUserId).emit("call_answer", { answer, userId: socket.userId })
  })

  socket.on("call_ice_candidate", ({ targetUserId, candidate }) => {
    io.to(targetUserId).emit("call_ice_candidate", { candidate, userId: socket.userId })
  })

  socket.on("call_ended", ({ targetUserId }) => {
    io.to(targetUserId).emit("call_ended", { userId: socket.userId });
  });




  socket.on("disconnect", async () => {
    const userId = socket.userId;
    console.log("Socket disconnected:", socket.id);

    if (!userId) return;

    onlineUsers.delete(userId);

    // Notify all chat members this user is offline
    try {
      const chats = await Chat.find({ users: userId });
      chats.forEach((chat) => {
        chat.users.forEach((memberId) => {
          if (memberId.toString() !== userId) {
            io.to(memberId.toString()).emit("user_offline", userId);
          }
        });
      });
    } catch (err) {
      console.error("Error emitting user_offline:", err);
    }
  });
});

connectDB();
server.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});