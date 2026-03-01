const Chat = require('../../models/Chat.model')
const User = require('../../models/User.model')
const Message = require('../../models/Message.model')
const crypto = require('crypto')

// create new chat
const accessChat = async (req, res) => {
    try {
        const { userId } = req.body;
        const currentUserId = req.user.id;

        if (!userId)
            return res.status(400).json({ message: 'User ID required' });

        if (userId === currentUserId)
            return res.status(400).json({ message: "Cannot chat with yourself" });

        // finding old chats if exists
        const chat = await Chat.findOne({
            isGroupChat: false,
            users: { $all: [currentUserId, userId] }
        })
            .populate("users", "-password")
            .populate("latestMessage")

        if (chat) {
            const setting = chat.userSettings.find(s => s.user.toString() === currentUserId);

            if (setting?.deletedAt) {
                setting.deletedAt = null;
                await chat.save();
            }

            return res.status(200).json(chat);
        }


        // creting new chat if didn't exists
        const newChat = await Chat.create({
            isGroupChat: false,
            users: [currentUserId, userId],
            userSettings: [
                { user: currentUserId },
                { user: userId },
            ],
        })

        const fullChat = await Chat.findById(newChat._id)
            .populate("users", "-password");

        res.status(201).json(fullChat);


    } catch (error) {
        res.status(500).json({ message: error || "Failed to access chat" });
    }
}

// get user chats on search
const getUserChats = async (req, res) => {
    try {
        console.log("getUserChats hit, user:", req.user?.id);
        const currentUserId = req.user.id;
        const { filter } = req.query;

        let query = {
            users: currentUserId,
            isDeleted: false,
        };

        let chats = await Chat.find(query)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate({
                path: "latestMessage",
                populate: {
                    path: "sender",
                    select: "name username",
                },
            })
            .sort({ updatedAt: -1 });

        // Apply filters
        if (filter === "groups") chats = chats.filter(chat => chat.isGroupChat);
        if (filter === "favourites") {
            chats = chats.filter(chat =>
                chat.userSettings.some(s => s.user.toString() === currentUserId && s.favourite)
            );
        }
        if (filter === "archived") {
            chats = chats.filter(chat =>
                chat.userSettings.some(s => s.user.toString() === currentUserId && s.archived)
            );
        }

        // Calculate unread count for each chat
        const chatsWithUnread = await Promise.all(
            chats.map(async (chat) => {
                const setting = chat.userSettings.find(
                    s => s.user.toString() === currentUserId
                );

                const msgFilter = {
                    chat: chat._id,
                    sender: { $ne: currentUserId },
                    readBy: { $ne: currentUserId },
                    isDeletedForEveryone: false,
                    deletedFor: { $ne: currentUserId },
                };

                if (setting?.lastClearedAt) {
                    msgFilter.createdAt = { $gt: setting.lastClearedAt };
                }

                const unreadCount = await Message.countDocuments(msgFilter);

                return {
                    ...chat.toObject(),
                    unreadCount,
                };
            })
        );

        res.status(200).json(chatsWithUnread);

    } catch (error) {
        console.error("getUserChats CRASH:", error.message, error.stack);
        res.status(500).json({ message: error.message || "Failed to fetch chats" });
    }
};
// add to fav button swtich
const toggleFavourite = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);

        const setting = chat.userSettings.find(
            s => s.user.toString() === currentUserId
        );

        if (!setting) {
            return res.status(404).json({ message: "Chat setting not found" });
        }

        setting.favourite = !setting.favourite;
        await chat.save();

        res.json({ message: "Updated favourite status" });

    } catch (error) {
        res.status(500).json({ message: "Failed to update favourite" });
    }
};
// chat delete button
const deleteChatForUser = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);

        const setting = chat.userSettings.find(
            s => s.user.toString() === currentUserId
        );

        if (!setting) {
            return res.status(404).json({ message: "Chat setting not found" });
        }

        setting.deletedAt = new Date();
        setting.lastClearedAt = new Date(); // 🔥 important

        await chat.save();

        res.json({ message: "Chat deleted for user" });

    } catch (error) {
        res.status(500).json({ message: "Failed to delete chat" });
    }
};
// create new group chat
const createGroupChat = async (req, res) => {
    try {
        const { name, users, avatar, bannerColor, about, groupType, groupTypeLabel, onlyAdminsCanMessage, onlyAdminsCanAddMembers } = req.body;
        const currentUserId = req.user.id;
         console.log("createGroupChat body:", req.body); // ✅ add this
        if (!name || !users || users.length < 2) {
            return res.status(400).json({
                message: "Group name and at least 2 users required",
            });
        }

        const groupUsers = [...new Set([...users, currentUserId])];

        const inviteLink = crypto.randomBytes(12).toString('hex');


        const newGroup = await Chat.create({
            isGroupChat: true,
            chatName: name,
            users: groupUsers,
            groupAdmin: currentUserId,
            groupAvatar: avatar || "",
            groupBannerColor: bannerColor || "#6366f1",
            groupAbout: about || "",
            groupType: groupType || "custom",
            groupTypeLabel: groupTypeLabel || "",
            onlyAdminsCanMessage: onlyAdminsCanMessage || false,
            onlyAdminsCanAddMembers: onlyAdminsCanAddMembers || false,
            inviteLink,
            userSettings: groupUsers.map(user => ({
                user,
                isAdmin: user.toString() === currentUserId.toString(),
                joinedAt: new Date()
            })),
        });

        await Message.create({
            chat: newGroup._id,
            sender: currentUserId,
            type: "system",
            systemAction: "group_created",
            content: `${name} group was created`,
            deliveredTo: [currentUserId],
            readBy: [currentUserId],
        });


        const fullGroup = await Chat.findById(newGroup._id)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get('io');
        groupUsers.forEach((userId) => {
            if (userId.toString() !== currentUserId.toString()) {
                io.to(userId.toString()).emit("added_to_group", fullGroup);
            }
        })


        res.status(201).json(fullGroup);

    } catch (error) {
        console.error("createGroupChat CRASH:", error.message, error.stack); // ✅ add this
        console.error("createGroupChat error:", error.message);
        res.status(500).json({ message: "Failed to create group" });
    }
};
// update group settings
const updateGroup = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { name, avatar, bannerColor, about } = req.body;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);

        if (!chat.isGroupChat) {
            return res.status(400).json({ message: "Not a group chat" });
        }

        if (chat.groupAdmin.toString() !== currentUserId) {
            return res.status(403).json({ message: "Only admin can update group" });
        }

        chat.chatName = name || chat.chatName;
        chat.groupAvatar = avatar || chat.groupAvatar;
        chat.groupBannerColor = bannerColor || chat.groupBannerColor;
        chat.groupAbout = about || chat.groupAbout;

        await chat.save();

        res.json(chat);

    } catch (error) {
        res.status(500).json({ message: "Failed to update group" });
    }
};
// get group info
const getGroupInfo = async (reeq, res) => {
    try {
        const { chatId } = req.params;
        const chat = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate("latestMessage")
        if (!chat)
            return res.status(404).json({ message: 'Group Chat not found' })
        res.json(chat);
    } catch (error) {
        res.status(500).json({ message: error || 'failed to get group info' })
    }
}

const addGroupMembers = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { users } = req.body;
        const currentUserId = req.user.id;
        const chat = await Chat.findById(chatId);
        if (!chat)
            return res.status(404).json({ message: "Chat not found" });
        if (!chat.isGroupChat)
            return res.status(400).json({ message: "Not a group" });
        if (chat.groupAdmin.toString() !== currentUserId)
            return res.status(403).json({ message: "Only admin can add members" });

        const newUsers = users.filter((u) => !chat.users.map((id) => id.toString()).includes(u));
        chat.users.push(...newUsers);
        newUsers.forEach((u) => chat.userSettings.push({ user: u }));
        await chat.save();
        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");
        // Notify new members via socket
        const io = req.app.get("io");
        newUsers.forEach((userId) => {
            io.to(userId.toString()).emit("added_to_group", updated);
        });
        io.to(chatId).emit("group_updated", updated);

        res.json(updated);

    } catch (error) {
        res.status(500).json({ message: error || 'failed to add group member' })
    }
}
// Remove member from group
const removeGroupMember = async (req, res) => {
    try {
        const { chatId, userId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group" });
        if (chat.groupAdmin.toString() !== currentUserId)
            return res.status(403).json({ message: "Only admin can remove members" });
        if (userId === currentUserId)
            return res.status(400).json({ message: "Use leave group instead" });

        chat.users = chat.users.filter((u) => u.toString() !== userId);
        chat.userSettings = chat.userSettings.filter(
            (s) => s.user.toString() !== userId
        );
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(userId).emit("removed_from_group", { chatId });
        io.to(chatId).emit("group_updated", updated);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error || "Failed to remove member" });
    }
};
// Leave group
const leaveGroup = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group" });

        // If admin is leaving, assign new admin
        if (chat.groupAdmin.toString() === currentUserId) {
            const remainingUsers = chat.users.filter(
                (u) => u.toString() !== currentUserId
            );
            if (remainingUsers.length === 0) {
                // No one left, delete group
                chat.isDeleted = true;
                await chat.save();
                return res.json({ message: "Group deleted as no members remain" });
            }
            chat.groupAdmin = remainingUsers[0];
        }

        chat.users = chat.users.filter((u) => u.toString() !== currentUserId);
        chat.userSettings = chat.userSettings.filter(
            (s) => s.user.toString() !== currentUserId
        );
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(chatId).emit("group_updated", updated);

        res.json({ message: "Left group successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to leave group" });
    }
};
// Make user admin
const makeAdmin = async (req, res) => {
    try {
        const { chatId, userId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        if (chat.groupAdmin.toString() !== currentUserId)
            return res.status(403).json({ message: "Only admin can promote members" });

        chat.groupAdmin = userId;
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(chatId).emit("group_updated", updated);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Failed to make admin" });
    }
};
// Dismiss admin (revert to member)
const dismissAdmin = async (req, res) => {
    try {
        const { chatId, userId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        if (chat.groupAdmin.toString() !== currentUserId)
            return res.status(403).json({ message: "Only admin can dismiss" });

        // Assign admin back to current user
        chat.groupAdmin = currentUserId;
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(chatId).emit("group_updated", updated);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Failed to dismiss admin" });
    }
};


module.exports = { accessChat, createGroupChat, getUserChats, toggleFavourite, deleteChatForUser, updateGroup, getGroupInfo, addGroupMembers, removeGroupMember, leaveGroup, makeAdmin, dismissAdmin };


