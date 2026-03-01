const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "file", "audio", "system"],
      default: "text",
    },
    systemAction: {
      type: String,
      enum: [
        "member_added",
        "member_removed",
        "member_left",
        "admin_changed",
        "admin_dismissed",
        "group_renamed",
        "group_created",
        "pinned_message",
      ],
      default: null,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    editedAt: Date,
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Performance indexes
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isPinned: 1, chat: 1 }); 

module.exports = mongoose.model("Message", messageSchema);
