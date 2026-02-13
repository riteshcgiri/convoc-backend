const dotenv = require('dotenv');
dotenv.config();
const app = require('./app.js');
const connectDB = require('./config/db.js');


const port = process.env.PORT || 5000;


connectDB();

app.listen(port, () => console.log(`Server running at ${port}, http://localhost:${port}/`))
