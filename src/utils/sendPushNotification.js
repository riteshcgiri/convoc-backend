const webpush = require('web-push')
const User = require('../models/User.model')

webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
);

const sendPushNotification = async (subscription, payload) => {
    try {
        console.log("Sending push to:", subscription.endpoint);
        console.log("Payload:", payload);
        await webpush.sendNotification(subscription, JSON.stringify(payload))
        console.log("Push sent successfully");
    } catch (error) {
        console.log("Push error status:", error.statusCode);
        console.log("Push error body:", error.body);
        if (error.statusCode === 410 || error.statusCode === 404)
            await User.findOneAndUpdate(
                { "pushSubscription.endpoint": subscription.endpoint },
                { $unset: { pushSubscription: "" } }
            )
    }
}

module.exports = sendPushNotification