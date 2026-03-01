const crypto = require('crypto');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../../models/User.model.js');
const sendEmail = require('../../utils/sendEmail');
const generateOTP = require('../../utils/generateOTP');
const mailFormat = require('../../utils/mailFormat.js')
const emailTemplate = require('../../utils/emailTemplate')
const generateUsername = require('../../utils/generateUsername');



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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
        return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isVerified)
        return res.status(401).json({ message: "Please verify your email first" });

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
    })
}

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
                { email : { $regex: safeQuery, $options: "i" } },
                ...phoneFilter,
            ],
        }).select("name username avatar phone status").limit(10);

        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: error || "Search failed" });
    }
}


const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};



module.exports = { signIn, signUp, verifyOTP, resendOTP, requestPasswordReset, verifyResetOtp, resetPassword, getMe, searchUsers }