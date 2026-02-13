const User = require('../models/User.model.js');

const slugify = (text) => {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const generateUsername = async (name) => {
    let baseUsername = slugify(name);
    let username = baseUsername;

    let exists = await User.findOne({username});

    while(exists) {
        const randomNum = Math.floor(100 + Math.random() * 9000);
        username = `${username}_${randomNum}`;
        exists = await User.findOne({username});
    }

    return username;
} 

module.exports = generateUsername;