const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB CONNECTED');
        console.log("👉 DB NAME:", mongoose.connection.name);
        console.log("👉 DB HOST:", mongoose.connection.host);
    } catch (error) {
        console.log('Connection Failed : ', error);
        process.exit(1);

    }
}

module.exports = connectDB