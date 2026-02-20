const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes')
const chatRoutes = require("./routes/chat.routes");
const messageRoutes = require("./routes/message.routes");

const app = express();
app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);


app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.get("/", (req, res) => res.send("App working pretty fine"))

module.exports = app;   