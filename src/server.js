const { createCallLog } = require('./controllers/calls/callLog.controller.js')

const Message = require("./models/Message.model");
const Chat = require("./models/Chat.model");
const CallLog = require("./models/CallLog.model.js")

const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      /\.ngrok-free\.app$/,
      /\.ngrok-free\.dev$/,
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

const activeCalls = new Map();


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
    const callKey = [socket.userId, targetUserId].sort().join("_");
    activeCalls.set(callKey, {
      initiatorId: socket.userId,
      receiverId: targetUserId,
      chatId,
      type,
      startedAt: null,
    })

    io.to(targetUserId).emit("incoming_call", { callerId: socket.userId, callerName, callerAvatar, chatId, type, })
  });

  socket.on("call_accepted", ({ targetUserId, chatId }) => {
    const callKey = [socket.userId, targetUserId].sort().join("_")
    const call = activeCalls.get(callKey)
    if (call) {
      call.startedAt = new Date()
      console.log("startedAt set:", call.startedAt)          // ← add this
    }
    io.to(targetUserId).emit("call_accepted", { userId: socket.userId, chatId })
  });

  socket.on("call_rejected", ({ targetUserId }) => {
    const callKey = [socket.userId, targetUserId].sort().join("_")
    const call = activeCalls.get(callKey)
    if (call) {
      createCallLog({ ...call, status: "rejected", endedAt: new Date() })
      activeCalls.delete(callKey)
    }
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

  socket.on("call_ended", async ({ targetUserId }) => {
    const callKey = [socket.userId, targetUserId].sort().join("_")
    const call = activeCalls.get(callKey)

    if (call) {
      const status = call.startedAt ? "completed" : "cancelled"

      // save call log
      await createCallLog({ ...call, status, endedAt: new Date() })
      const savedLog = await CallLog.findOne({
        initiator: call.initiatorId,
        receiver: call.receiverId,
      }).sort({ createdAt: -1 })
        .populate("initiator", "name avatar username")
        .populate("receiver", "name avatar username")
        .lean()

        if(savedLog){
          io.to(call.initiatorId).emit("call_log_added", savedLog)
          io.to(call.receiverId).emit("call_log_added", savedLog)
        }

      // ── system message ─────────────────────────────────────
      if (call.startedAt) {
        const duration = Math.floor((new Date() - call.startedAt) / 1000)
        const mins = Math.floor(duration / 60)
        const secs = duration % 60
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

        const systemMsg = await Message.create({
          chat: call.chatId,
          sender: socket.userId,
          content: `${call.type === "video" ? "Video • " : "Voice • "} Call ended • ${durationStr}`,
          type: "system",
          systemAction: "call_ended",
        })

        io.to(call.chatId).emit("new_message", systemMsg)
      }
      // ───────────────────────────────────────────────────────

      activeCalls.delete(callKey)
    }

    // notify other person
    io.to(targetUserId).emit("call_ended", { userId: socket.userId })
  })



  socket.on("disconnect", async () => {
    const userId = socket.userId;
    if (!userId) return;
    onlineUsers.delete(userId)
    // activeChats.delete(userId)

    activeCalls.forEach((call, callKey) => {
      if (call.initiatorId === userId || call.receiverId === userId) {

        const targetUserId = call.initiatorId === userId ? call.receiverId : call.initiatorId
        io.to(targetUserId).emit("call_ended", { userId })

        const status = call.startedAt ? "completed" : "cancelled"
        createCallLog({ ...call, status, endedAt: new Date() })
        activeCalls.delete(callKey)
      }
    })
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