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

        chats = chats.filter(chat => {
            const setting = chat.userSettings.find(s => s.user.toString() === currentUserId);
            return !setting?.deletedAt;
        });

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

        res.json(`${setting.favourite ? 'Added to' : 'Removed from'} favourites`);

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
        const { name, avatar, bannerColor, groupAbout, groupType, groupTypeLabel, onlyAdminsCanMessage, onlyAdminsCanAddMembers, onlyAdminsCanEditInfo } = req.body;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group" });

        const currentUserSetting = chat.userSettings.find(s => s.user.toString() === currentUserId);
        if (chat.onlyAdminsCanEditInfo && !currentUserSetting?.isAdmin) {
            return res.status(403).json({ message: "Only admins can update group info" });
        }

        const nameChanged = name !== undefined && name !== chat.chatName;

        // Use ?? for everything so falsy values (false, "") are respected
        chat.chatName = name ?? chat.chatName;
        chat.groupAvatar = avatar ?? chat.groupAvatar;
        chat.groupBannerColor = bannerColor ?? chat.groupBannerColor;
        chat.groupAbout = groupAbout ?? chat.groupAbout;
        chat.groupType = groupType ?? chat.groupType;
        chat.groupTypeLabel = groupTypeLabel ?? chat.groupTypeLabel;

        // Booleans: only update if explicitly provided in request body
        if (onlyAdminsCanMessage !== undefined)
            chat.onlyAdminsCanMessage = Boolean(onlyAdminsCanMessage);
        if (onlyAdminsCanAddMembers !== undefined)
            chat.onlyAdminsCanAddMembers = Boolean(onlyAdminsCanAddMembers);
        if (onlyAdminsCanEditInfo !== undefined)
            chat.onlyAdminsCanEditInfo = Boolean(onlyAdminsCanEditInfo);

        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(chatId).emit("group_updated", updated);

        if (nameChanged) {
            const actor = await User.findById(currentUserId).select("name");
            const systemMsg = await Message.create({
                chat: chatId,
                sender: currentUserId,
                type: "system",
                systemAction: "group_renamed",
                content: `${actor.name} changed the group name to "${name}"`,
                deliveredTo: [currentUserId],
                readBy: [currentUserId],
            });
            io.to(chatId).emit("new_message", systemMsg);
        }

        res.json(updated);

    } catch (error) {
        console.error("updateGroup error:", error.message);
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
        const currentUserSetting = chat.userSettings.find(s => s.user.toString() === currentUserId);
        if (!currentUserSetting?.isAdmin)
            return res.status(403).json({ message: "Only admins can add members" });

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
        const actor = await User.findById(currentUserId).select("name");
        const addedUserNames = await User.find({ _id: { $in: newUsers } }).select("name");

        const systemMsg = await Message.create({
            chat: chatId,
            sender: currentUserId,
            type: "system",
            systemAction: "member_added",
            content: `${actor.name} added ${addedUserNames.map(u => u.name).join(", ")}`,
            deliveredTo: [currentUserId],
            readBy: [currentUserId],
        });

        io.to(chatId).emit("new_message", systemMsg);

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

        const currentUserSetting = chat.userSettings.find(
            s => s.user.toString() === currentUserId
        );
        if (!currentUserSetting?.isAdmin)
            return res.status(403).json({ message: "Only admins can remove members" });

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

        const [actorUser, targetUser] = await Promise.all([
            User.findById(currentUserId).select("name"),
            User.findById(userId).select("name"),
        ]);

        const systemMsg = await Message.create({
            chat: chatId,
            sender: currentUserId,
            type: "system",
            systemAction: "member_removed",
            content: `${actorUser.name} removed ${targetUser.name} from group`,
            deliveredTo: [currentUserId],
            readBy: [currentUserId],
        });

        io.to(chatId).emit("new_message", systemMsg);

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

        const leavingUserSetting = chat.userSettings.find(
            s => s.user.toString() === currentUserId
        );

        if (leavingUserSetting?.isAdmin) {
            const remainingUsers = chat.users.filter(
                (u) => u.toString() !== currentUserId
            );
            if (remainingUsers.length === 0) {
                chat.isDeleted = true;
                await chat.save();
                return res.json({ message: "Group deleted as no members remain" });
            }
            chat.groupAdmin = remainingUsers[0];

            // ✅ also make new admin in userSettings
            const newAdminSetting = chat.userSettings.find(
                s => s.user.toString() === remainingUsers[0].toString()
            );
            if (newAdminSetting) newAdminSetting.isAdmin = true;
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

        const leavingUser = await User.findById(currentUserId).select("name");
        const systemMsg = await Message.create({
            chat: chatId,
            sender: currentUserId,
            type: "system",
            systemAction: "member_left",
            content: `${leavingUser.name} left the group`,
            deliveredTo: [currentUserId],
            readBy: [currentUserId],
        });
        io.to(chatId).emit("new_message", systemMsg);

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

        // ✅ check userSettings instead of groupAdmin
        const currentUserSetting = chat.userSettings.find(
            s => s.user.toString() === currentUserId
        );
        if (!currentUserSetting?.isAdmin) {
            return res.status(403).json({ message: "Only admins can promote members" });
        }

        // Make target user admin
        const targetSetting = chat.userSettings.find(
            s => s.user.toString() === userId
        );
        if (!targetSetting) return res.status(404).json({ message: "Member not found" });

        targetSetting.isAdmin = true;
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(chatId).emit("group_updated", updated);

        const [actorUser, targetUser] = await Promise.all([
            User.findById(currentUserId).select("name"),
            User.findById(userId).select("name"),
        ]);

        const systemMsg = await Message.create({
            chat: chatId,
            sender: currentUserId,
            type: "system",
            systemAction: "admin_changed",
            content: `${actorUser.name} made ${targetUser.name} an admin`,
            deliveredTo: [currentUserId],
            readBy: [currentUserId],
        });

        io.to(chatId).emit("new_message", systemMsg);

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

        // ✅ check userSettings instead of groupAdmin
        const currentUserSetting = chat.userSettings.find(
            s => s.user.toString() === currentUserId
        );
        if (!currentUserSetting?.isAdmin) {
            return res.status(403).json({ message: "Only admins can dismiss admins" });
        }

        // Remove admin from target user
        const targetSetting = chat.userSettings.find(
            s => s.user.toString() === userId
        );
        if (!targetSetting) return res.status(404).json({ message: "Member not found" });

        targetSetting.isAdmin = false;
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        const io = req.app.get("io");
        io.to(chatId).emit("group_updated", updated);

        const [actorUser, targetUser] = await Promise.all([
            User.findById(currentUserId).select("name"),
            User.findById(userId).select("name"),
        ]);

        const systemMsg = await Message.create({
            chat: chatId,
            sender: currentUserId,
            type: "system",
            systemAction: "admin_dismissed",
            content: `${actorUser.name} removed ${targetUser.name} as admin`,
            deliveredTo: [currentUserId],
            readBy: [currentUserId],
        });

        io.to(chatId).emit("new_message", systemMsg);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: "Failed to dismiss admin" });
    }
};

const toggleMute = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUserId = req.user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found" });

        const userSetting = chat.userSettings.find(
            s => s.user.toString() === currentUserId.toString()
        );
        if (!userSetting) return res.status(404).json({ message: "User setting not found" });

        userSetting.muted = !userSetting.muted;
        await chat.save();

        res.json({ muted: userSetting.muted });
    } catch (error) {
        console.error("toggleMute error:", error.message);
        res.status(500).json({ message: "Failed to update mute setting" });
    }
};

const getGroupByInviteLink = async (req, res) => {
    try {
        const { inviteLink } = req.params;
        const chat = await Chat.findOne({ inviteLink })
            .populate("users", "-password")
            .select("chatName groupAvatar groupAbout users groupType");

        if (!chat) return res.status(404).json({ message: "Invalid invite link" });
        if (chat.isDeleted) return res.status(404).json({ message: "Group no longer exists" });

        res.json(chat);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch group info" });
    }
};

const joinViaInviteLink = async (req, res) => {
    try {
        const { inviteLink } = req.params;
        const currentUserId = req.user.id;
        console.log(currentUserId);
        
        const chat = await Chat.findOne({ inviteLink })
        if (!chat)
            return res.status(404).json({ message: "Invalid Invite Link" })
        if (!chat.isGroupChat)
            return res.status(400).json({ message: "Not a group" })
        if (chat.isDeleted)
            return res.status(404).json({ message: "Group no longer exists" });
        if (chat.users.some(u => u.toString() === currentUserId)) {
            const fullChat = await Chat.findById(chat._id)
                .populate("users", "-password")
                .populate("groupAdmin", "-password")
            return res.status(200).json(fullChat);
        }
        chat.users.push(currentUserId)
        chat.userSettings.push({
            user: currentUserId,
            isAdmin: false,
            joinedAt: new Date()
        })
        await chat.save()
        const fullChat = await Chat.findById(chat._id)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")

        const joiningUser = await User.findById(currentUserId).select("name");
        const systemMsg = await Message.create({
            chat : chat._id,
            sender : currentUserId,
            type : "system",
            systemAction : "member_added",
            content : `${joiningUser.name} joined via Invite Link`,
            deliveredTo : [currentUserId],
            readBy : [currentUserId],
        });
        const io = req.app.get('io');
        io.to(chat._id.toString()).emit("new_message", systemMsg);
        io.to(chat._id.toString()).emit("group_updated", fullChat);
        io.to(chat._id.toString()).emit("added_to_group", fullChat)

        res.status(200).json(fullChat);
    } catch (error) {
        console.error("joinViaInviteLink error:", error.message);
        res.status(500).json({ message: error.message || "Failed to join group" });
    }
}


module.exports = { accessChat, createGroupChat, getUserChats, toggleFavourite, deleteChatForUser, updateGroup, getGroupInfo, addGroupMembers, removeGroupMember, leaveGroup, makeAdmin, dismissAdmin, toggleMute, getGroupByInviteLink, joinViaInviteLink };


