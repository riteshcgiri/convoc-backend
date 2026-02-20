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

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("setup", async (userId) => {
    socket.join(userId);

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
          // Get the messages we just updated to find their senders
          const updatedMessages = await Message.find({
            chat: chat._id,
            deliveredTo: userId,
          }).distinct("sender");

          // Notify each sender in their personal room
          updatedMessages.forEach((senderId) => {
            io.to(senderId.toString()).emit("message_status_updated", {
              chatId: chat._id.toString(),
              userId,
              type: "delivered",
            });
          });
        }
      }
    } catch (err) {
      console.error("Error on setup delivery:", err);
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
            chatId,
            userId,
            type: "delivered",
          });
        });
      }
    } catch (err) {
      console.error("Error in message_delivered:", err);
    }
  });

  socket.on("message_read", async ({ chatId, userId }) => {

    console.log("message_read received on server", { chatId, userId });
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
           console.log("emitting message_status_updated to sender:", senderId.toString());
          io.to(senderId.toString()).emit("message_status_updated", {
            chatId,
            userId,
            type: "read",
          });
        });
      }
    } catch (err) {
      console.error("Error in message_read:", err);
    }
  });

  socket.on("message_read", async ({ chatId, userId }) => {
    try {
      const updated = await Message.updateMany(
        {
          chat: chatId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        { $addToSet: { readBy: userId } }
      );

      if (updated.modifiedCount > 0) {
        io.to(chatId).emit("message_status_updated", {
          chatId,
          userId,
          type: "read",
        });
      }
    } catch (err) {
      console.error("Error in message_read:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

connectDB();
server.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});