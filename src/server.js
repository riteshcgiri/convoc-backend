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