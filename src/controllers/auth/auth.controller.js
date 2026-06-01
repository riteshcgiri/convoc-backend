const crypto = require('crypto');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../../models/User.model.js');
const Chat = require('../../models/Chat.model.js')
const Message = require('../../models/Message.model.js')
const sendEmail = require('../../utils/sendEmail');
const generateOTP = require('../../utils/generateOTP');
const mailFormat = require('../../utils/mailFormat.js')
const emailTemplate = require('../../utils/emailTemplate')
const generateUsername = require('../../utils/generateUsername');
const logActivity = require("../../utils/logActivity");
const Session = require('../../models/Session.model.js')
const ActivityLog = require("../../models/ActivityLog.model.js");

const geoip = require('geoip-lite');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
}

const signUp = async (req, res) => {
    const { name, email, password, phone, tnc, avatar } = req.body;

    if (!name || !email || !password || !phone)
        return res.status(400).json({ message: 'All fields required' });

    if (!tnc)
        return res.status(400).json({ message: "You must accept terms & conditions" });


    const userExists = await User.findOne({ email })
    if (userExists) {

        // If user exists but NOT verified
        if (!userExists.isVerified) {

            const otp = generateOTP();
            const hashedOtp = crypto
                .createHash("sha256")
                .update(otp)
                .digest("hex");

            userExists.otp = hashedOtp;
            userExists.otpExpires = Date.now() + 10 * 60 * 1000;

            await userExists.save();

            await sendEmail(email, "Convoc OTP Verification", emailTemplate(otp));

            return res.status(200).json({ message: "Account exists but not verified. OTP resent.", email: userExists.email, });
        }

        // If already verified
        return res.status(400).json({ message: "User already exists", });
    }


    const phoneExists = await User.findOne({ phone });
    if (phoneExists)
        return res.status(400).json({ message: "Phone already registered" });



    const hashedPassword = await bcrypt.hash(password, 10);
    const username = await generateUsername(name);

    const otp = generateOTP();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");


    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        username,
        phone,
        tncAccepted: tnc,
        tncAcceptedAt: Date.now(),
        otp: hashedOtp,
        otpExpires: Date.now() + 10 * 60 * 1000,
        avatar
    })

    await sendEmail(
        email,
        "Convoc Account Verification Mail",
        emailTemplate(otp)

    )


    res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        message: "Signup successful. Please verify OTP sent to email.",
    });
}

const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    const user = await User.findOne({ email })
    if (!user)
        return res.status(400).json({ message: "User not found" })

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (user.otp !== hashedOtp)
        return res.status(400).json({ message: "Invalid OTP" })

    if (user.otpExpires < Date.now())
        return res.status(400).json({ message: "OTP Expired" })

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;

    await user.save()

    res.json({ message: 'Account verified successfully' })

}

const signIn = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ $or: [{ email }, { username: email }], });


    if (!user)
        return res.status(400).json({ message: 'Invalid credentials' })
    if (user.isDisabled)
        return res.status(403).json({ message: "This account has been disabled. Contact support to reactivate." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
        return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isVerified)
        return res.status(401).json({ message: "Please verify your email first" });

    const token = generateToken(user._id)
    // In signin controller after generating token
    const decoded = jwt.decode(token);

    const ip = req.ip === "::1" ? "127.0.0.1" : req.ip;
    const geo = geoip.lookup(ip);
    await Session.create({
        user: user._id,
        token: crypto.createHash("sha256").update(token).digest("hex"),
        device: req.headers["user-agent"],
        ip: ip,
        location: geo ? { city: geo.city, country: geo.country, region: geo.region, } : { city: "Localhost", country: "DEV", region: "PC" },
        expiresAt: new Date(decoded.exp * 1000),
    });
    await logActivity({ userId: user._id, action: "login", ip: req.ip, device: req.headers["user-agent"], isUserVisible: true });
    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: token,
    })

}

const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (token) {
            const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

            // ✅ mark session inactive
            await Session.findOneAndUpdate(
                { token: hashedToken },
                { isActive: false }
            );

            // ✅ log activity
            await logActivity({
                userId: req.user.id,
                action: "logout",
                ip: req.ip,
                device: req.headers["user-agent"],
            });
        }

        res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("logout error:", error.message);
        res.status(500).json({ message: "Failed to logout" });
    }
};

const resendOTP = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
        return res.status(400).json({ message: "User not found" });

    if (user.isVerified)
        return res.status(400).json({ message: "Account already verified" });

    const otp = generateOTP();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.otp = hashedOtp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    await sendEmail(
        email,
        "Convoc OTP Resend",
        emailTemplate(otp)
    );

    res.json({ message: "OTP resent successfully" });
};

const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ $or: [{ email }, { username: email }], })

    if (!user)
        return res.status(400).json({ message: "User not found" });

    const otp = generateOTP();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest("hex");

    user.resetOtp = hashedOtp;
    user.resetOtpExpires = Date.now() + 15 * 60 * 1000;
    user.resetSession = false;

    await user.save();

    await sendEmail(user.email, "CONVOC Password Reset Request", emailTemplate(otp)).catch(console.error)

    res.json({ message: "Reset Password OTP sent to registered mail" })






}

const verifyResetOtp = async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ $or: [{ email }, { username: email }], });

    if (!user)
        return res.status(400).json({ message: "User not found" });

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (user.resetOtp !== hashedOtp)
        return res.status(400).json({ message: "Invalid OTP" });

    if (user.resetOtpExpires < Date.now())
        return res.status(400).json({ message: "OTP expired" });

    user.resetSession = true;
    await user.save();

    res.json({ message: "OTP verified successfully" });
}

const resetPassword = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ $or: [{ email }, { username: email }], });

    if (!user || !user.resetSession)
        return res.status(400).json({ message: "Session expired" });

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.resetSession = false;

    await user.save();

    sendEmail(
        user.email,
        "Password Changed Successfully",
        mailFormat({ title: "CONVOC - Password Changed Request", subtitle: "Password Changed Successfully", description: "Your CONCOV password has been successfully changed, If this Request is done by you kindly ignore this mail, otherwise visit site or contact us", footerNote: 'if this request id done by you, you can simply ignore this messagge.' })
    ).catch(console.error);

    res.json({
        message: "Password changed successfully",
        token: generateToken(user._id),
    });
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch user" });
    }
};

const searchUsers = async (req, res) => {
    try {
        const q = req.query.q?.toString();
        const currentUserId = req.user.id;

        if (!q || q.trim() === "")
            return res.json([])

        const safeQuery = await escapeRegex(q);
        const phoneQuery = Number(safeQuery);
        const phoneFilter = !isNaN(phoneQuery) ? [{ phone: phoneQuery }] : [];

        const users = await User.find({
            _id: { $ne: currentUserId },
            isVerified: true,
            $or: [
                { name: { $regex: safeQuery, $options: "i" } },
                { username: { $regex: safeQuery, $options: "i" } },
                { email: { $regex: safeQuery, $options: "i" } },
                ...phoneFilter,
            ],
        }).select("name username avatar phone status").limit(10);

        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: error || "Search failed" });
    }
}
const checkUsername = async (req, res) => {
    try {
        const { username } = req.query;
        const currentUserId = req.user.id;

        const exists = await User.findOne({
            username,
            _id: { $ne: currentUserId }
        });

        res.json({ available: !exists });
    } catch (error) {
        res.status(500).json({ message: "Failed to check username" });
    }
};
const updateProfile = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { name, username, about, avatar, phone,
            allowBrowserNotifications, muteNotifications,
            showPopups, offerLetter, tncAccepted, agreePrivacy } = req.body;

        const user = await User.findById(currentUserId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const changes = {};

        // ✅ name & about — unlimited
        if (name !== undefined) changes.name = name;
        if (about !== undefined) changes.about = about;
        if (avatar !== undefined) changes.avatar = avatar;

        // ✅ settings — unlimited
        if (allowBrowserNotifications !== undefined) changes.allowBrowserNotifications = allowBrowserNotifications;
        if (muteNotifications !== undefined) changes.muteNotifications = muteNotifications;
        if (showPopups !== undefined) changes.showPopups = showPopups;
        if (offerLetter !== undefined) changes.offerLetter = offerLetter;
        if (tncAccepted !== undefined) changes.tncAccepted = tncAccepted;
        if (agreePrivacy !== undefined) changes.agreePrivacy = agreePrivacy;

        // ✅ username — once per 7 days
        if (username !== undefined && username !== user.username) {
            // check taken
            const exists = await User.findOne({ username, _id: { $ne: currentUserId } });
            if (exists) return res.status(400).json({ message: "Username already taken" });

            // check 7 day lock
            if (user.usernameChangedAt) {
                const daysSince = (Date.now() - new Date(user.usernameChangedAt)) / (1000 * 60 * 60 * 24);
                if (daysSince < 7) {
                    const daysLeft = Math.ceil(7 - daysSince);
                    return res.status(400).json({
                        message: `You can change your username again in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`
                    });
                }
            }

            changes.username = username;
            changes.usernameChangedAt = new Date();

            await logActivity({
                userId: currentUserId,
                action: "username_changed",
                metadata: { old: user.username, new: username },
                ip: req.ip,
                device: req.headers["user-agent"],
            });
        }

        // ✅ phone — once per 7 days
        if (phone !== undefined && String(phone) !== String(user.phone || "")) {
            if (user.phoneChangedAt) {
                const daysSince = (Date.now() - new Date(user.phoneChangedAt)) / (1000 * 60 * 60 * 24);
                if (daysSince < 7) {
                    const daysLeft = Math.ceil(7 - daysSince);
                    return res.status(400).json({
                        message: `You can change your phone again in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`
                    });
                }
            }

            changes.phone = phone;
            changes.phoneChangedAt = new Date();
        }

        // ✅ apply all changes
        const updated = await User.findByIdAndUpdate(currentUserId, { $set: changes }, { new: true, runValidators: true }).select("-password");

        // ✅ log profile update
        await logActivity({ userId: currentUserId, action: "profile_updated", metadata: { fields: Object.keys(changes) }, ip: req.ip, device: req.headers["user-agent"], });

        res.json(updated);

    } catch (error) {
        console.error("updateProfile error:", error.message || `Failed to update due to ${error?.message} `);
        res.status(500).json({ message: error.message || "Failed to update profile" });
    }
};

const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const currentUserId = req.user.id;

        const user = await User.findById(currentUserId);
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Old password is incorrect" });

        // ✅ max 2 password changes per day
        const today = new Date().toDateString();
        const lastChangedDate = user.passwordChangedDate
            ? new Date(user.passwordChangedDate).toDateString()
            : null;

        if (lastChangedDate === today && user.passwordChangedCount >= 2) {
            return res.status(400).json({ message: "You can only change your password 2 times per day" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordChangedCount = lastChangedDate === today ? user.passwordChangedCount + 1 : 1;
        user.passwordChangedDate = new Date();
        await user.save();

        // ✅ log activity
        await logActivity({
            userId: currentUserId,
            action: "password_changed",
            ip: req.ip,
            device: req.headers["user-agent"],
        });

        // ✅ send email (non blocking)
        sendEmail(user.email,
            "CONVOC — Password Changed",
            mailFormat({
                title: "Password Changed Successfully",
                subtitle: "Your password was just changed",
                description: "Your CONVOC password was changed successfully. If this wasn't you, please reset your password immediately.",
                footerNote: "If you made this change, you can safely ignore this email."
            })
        ).catch(() => { });

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("changePassword error:", error.message);
        res.status(500).json({ message: "Failed to change password" });
    }
};

const sendPhoneOtp = async (req, res) => {
    // 🔒 Blocked until SMS service is integrated
    return res.status(503).json({
        message: "Phone verification is currently unavailable"
    });
};

const verifyPhoneOtp = async (req, res) => {
    // 🔒 Blocked until SMS service is integrated
    return res.status(503).json({
        message: "Phone verification is currently unavailable"
    });
};

const disableAccount = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const user = await User.findById(currentUserId);

        // ✅ 7 day lock after reactivation
        if (user.reactivatedAt) {
            const daysSince = (Date.now() - new Date(user.reactivatedAt)) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) {
                const daysLeft = Math.ceil(7 - daysSince);
                return res.status(400).json({
                    message: `You cannot disable your account for ${daysLeft} more day${daysLeft > 1 ? 's' : ''} after reactivation`
                });
            }
        }

        // Generate reactivate token
        const token = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        user.isDisabled = true;
        user.disabledAt = new Date();
        user.reactivateToken = hashedToken;
        user.reactivateTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
        await user.save();

        // ✅ log activity
        await logActivity({
            userId: currentUserId,
            action: "account_disabled",
            ip: req.ip,
            device: req.headers["user-agent"],
        });

        const reactivateLink = `${process.env.CLIENT_URL}/reactivate/${token}`;
        sendEmail(
            user.email,
            "CONVOC — Account Disabled",
            mailFormat({
                title: "Account Disabled",
                subtitle: "Your account has been disabled",
                description: `Your CONVOC account has been disabled. If you change your mind, you can reactivate it within 7 days by clicking the button below. After 7 days your account will be permanently disabled.`,
                buttonLink: reactivateLink,
                buttonText: "Reactivate My Account",
                footerNote: "If you disabled your account intentionally, ignore this email."
            })
        ).catch(() => { });

        res.json({ message: "Account disabled successfully" });
    } catch (error) {
        console.error("disableAccount error:", error.message);
        res.status(500).json({ message: "Failed to disable account" });
    }
};

const reactivateAccount = async (req, res) => {
    try {
        const { token } = req.params;
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            reactivateToken: hashedToken,
            reactivateTokenExpires: { $gt: Date.now() },
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired reactivation link" });

        user.isDisabled = false;
        user.disabledAt = null;
        user.reactivateToken = undefined;
        user.reactivateTokenExpires = undefined;
        user.reactivatedAt = new Date();
        await user.save();

        await logActivity({
            userId: currentUserId,
            action: "account_reactivated",
            ip: req.ip,
            device: req.headers["user-agent"],
        });

        res.json({ message: "Account reactivated successfully" });
        // Redirect to signin
        res.redirect(`${process.env.CLIENT_URL}/signin?reactivated=true`);

    } catch (error) {
        res.status(500).json({ message: "Failed to reactivate account" });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const currentUserId = req.user.id;
        console.log(password)
        const user = await User.findById(currentUserId);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect password" });
        console.log(`user : ${user}, isMatch : ${isMatch} `)

        // Remove from all chats
        await Chat.updateMany(
            { users: currentUserId },
            { $pull: { users: currentUserId, userSettings: { user: currentUserId } } }
        );

        await sendEmail(
            user.email,
            "CONVOC — Account Deleted",
            mailFormat({
                title: "Account Deleted",
                subtitle: "Your CONVOC account has been permanently deleted",
                description: "Your account and all associated data has been permanently deleted from CONVOC. This action cannot be undone. We're sorry to see you go.",
                footerNote: "If you didn't request this, please contact our support immediately."
            })
        );

        console.log(`user : ${user}, isMatch : ${isMatch} `)
        // Delete all messages
        await Message.deleteMany({ sender: currentUserId });

        // Delete user
        await User.findByIdAndDelete(currentUserId);

        res.json({ message: "Account deleted successfully" });
        console.log(res)
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: error?.mesaage || "Failed to delete account" });

    }
};

const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("friends", "name username avatar status");
        res.json(user.friends);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch friends" });
    }
};

const addFriend = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        await User.findByIdAndUpdate(currentUserId, {
            $addToSet: { friends: userId }
        });
        await User.findByIdAndUpdate(userId, {
            $addToSet: { friends: currentUserId }
        });

        res.json({ message: "Friend added" });
    } catch (error) {
        res.status(500).json({ message: "Failed to add friend" });
    }
};

const removeFriend = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        await User.findByIdAndUpdate(currentUserId, {
            $pull: { friends: userId }
        });
        await User.findByIdAndUpdate(userId, {
            $pull: { friends: currentUserId }
        });

        res.json({ message: "Friend removed" });
    } catch (error) {
        res.status(500).json({ message: "Failed to remove friend" });
    }
};

const getActiveSessions = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const currentToken = req.headers.authorization?.split(" ")[1];
        const hashedCurrentToken = crypto.createHash("sha256").update(currentToken).digest("hex");

        const sessions = await Session.find({
            user: currentUserId,
            isActive: true
        }).sort({ lastActive: -1 });

        // mark which one is current
        const sessionsWithCurrent = sessions.map(s => ({
            ...s.toObject(),
            isCurrent: s.token === hashedCurrentToken
        }));

        res.json(sessionsWithCurrent);
    } catch (error) {
        console.error("getActiveSessions error:", error.message);
        res.status(500).json({ message: "Failed to fetch sessions" });
    }
};

const logoutSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const currentUserId = req.user.id;

        const session = await Session.findOne({
            _id: sessionId,
            user: currentUserId
        });

        if (!session) return res.status(404).json({ message: "Session not found" });

        session.isActive = false;
        await session.save();

        await logActivity({
            userId: currentUserId,
            action: "logout",
            metadata: { sessionId, device: session.device },
            ip: req.ip,
            device: req.headers["user-agent"],
        });

        res.json({ message: "Session logged out successfully" });
    } catch (error) {
        console.error("logoutSession error:", error.message);
        res.status(500).json({ message: "Failed to logout session" });
    }
};

const logoutAllSessions = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const currentToken = req.headers.authorization?.split(" ")[1];
        const hashedCurrentToken = crypto.createHash("sha256").update(currentToken).digest("hex");

        console.log("hashedCurrentToken:", hashedCurrentToken);

        // check what sessions exist
        const allSessions = await Session.find({ user: currentUserId, isActive: true });
        console.log("active sessions:", allSessions.map(s => ({ id: s._id, token: s.token, match: s.token === hashedCurrentToken })));

        await Session.updateMany(
            { user: currentUserId, isActive: true, token: { $ne: hashedCurrentToken } },
            { isActive: false }
        );
        await logActivity({
            userId: currentUserId,
            action: "logout_all",
            ip: req.ip,
            device: req.headers["user-agent"],
        });

        res.json({ message: "All other sessions logged out" });
    } catch (error) {
        res.status(500).json({ message: "Failed to logout all sessions" });
    }
};

const getUserActivity = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        const activities = await ActivityLog.find({
            user: currentUserId,
            isUserVisible: true
        })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await ActivityLog.countDocuments({
            user: currentUserId,
            isUserVisible: true
        });

        res.json({
            activities,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error("getUserActivity error:", error.message);
        res.status(500).json({ message: "Failed to fetch activity" });
    }
};

const savePushSubscription = async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        await User.findByIdAndUpdate(req.user.id, {
            pushSubscription: { endpoint, keys }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deletePushSubscription = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { pushSubscription: "" }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


const escapeRegex = (text) => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};



module.exports = { signIn, signUp, verifyOTP, resendOTP, requestPasswordReset, verifyResetOtp, resetPassword, getMe, searchUsers, checkUsername, updateProfile, changePassword, sendPhoneOtp, verifyPhoneOtp, disableAccount, reactivateAccount, deleteAccount, getFriends, addFriend, removeFriend, getActiveSessions, logoutSession, logoutAllSessions, getUserActivity, logout, savePushSubscription, deletePushSubscription }