const cors = require('cors');
const express = require('express');
const authRoutes = require('./routes/auth.routes')
const chatRoutes = require("./routes/chat.routes");
const messageRoutes = require("./routes/message.routes");
const callLogRoutes = require('./routes/callLogs.routes')

const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "https://auditorially-divergent-davion.ngrok-free.dev",
  /\.ngrok-free\.app$/,   
    /\.ngrok-free\.dev$/,
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(null, true); // ✅ don't throw error
    }
  },
  credentials: true
};

app.use(cors(corsOptions));




app.use(express.json())


app.use("/api/auth", authRoutes)
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/call-logs", callLogRoutes);




app.get("/", (req, res) => res.send("App working pretty fine"))
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({ message: err.message });
});
module.exports = app;   