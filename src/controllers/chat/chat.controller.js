const Chat = require('../../models/Chat.model')
const User = require('../../models/User.model')

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
// create new group chat
const createGroupChat = async (req, res) => {
    try {
        const { name, users, avatar, bannerColor, about } = req.body;
        const currentUserId = req.user.id;

        if (!name || !users || users.length < 2) {
            return res.status(400).json({
                message: "Group name and at least 2 users required",
            });
        }

        const groupUsers = [...users, currentUserId];

        const newGroup = await Chat.create({
            isGroupChat: true,
            chatName: name,
            users: groupUsers,
            groupAdmin: currentUserId,
            groupAvatar: avatar || "",
            groupBannerColor: bannerColor || "#6366f1",
            groupAbout: about || "",
            userSettings: groupUsers.map(user => ({ user })),
        });

        const fullGroup = await Chat.findById(newGroup._id)
            .populate("users", "-password")
            .populate("groupAdmin", "-password");

        res.status(201).json(fullGroup);

    } catch (error) {
        res.status(500).json({ message: "Failed to create group" });
    }
};
// get user chats on search
const getUserChats = async (req, res) => {
    try {
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
        if (filter === "groups") {
            chats = chats.filter(chat => chat.isGroupChat);
        }

        if (filter === "favourites") {
            chats = chats.filter(chat =>
                chat.userSettings.some(
                    setting =>
                        setting.user.toString() === currentUserId &&
                        setting.favourite
                )
            );
        }

        if (filter === "archived") {
            chats = chats.filter(chat =>
                chat.userSettings.some(
                    setting =>
                        setting.user.toString() === currentUserId &&
                        setting.archived
                )
            );
        }

        res.status(200).json(chats);

    } catch (error) {
        res.status(500).json({ message: error || "Failed to fetch chats" });
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



module.exports = { accessChat, createGroupChat, getUserChats, toggleFavourite, deleteChatForUser, updateGroup };


