# 🚀 CONVOC -- Backend

Backend API for CONVOC -- a scalable real-time chat application built
with the MERN stack.

This backend powers authentication, user management, email verification,
and future real-time messaging features.

------------------------------------------------------------------------

## 🛠️ Tech Stack

-   🟢 Node.js
-   🚂 Express.js
-   🍃 MongoDB
-   📦 Mongoose
-   🔐 JWT Authentication
-   📧 Nodemailer (Email Service)
-   🌐 Socket.io (Planned / Integration Ready)
-   🔑 bcrypt (Password Hashing)
-   ⚙️ dotenv (Environment Configuration)

------------------------------------------------------------------------

## 📁 Project Structure

src/ 
│ 
├── controllers/ \# Route controllers 
├── models/ \# Mongoose schemas 
├── routes/ \# API routes 
├── middlewares/ \# Custom middlewares (auth, error handling) 
├── config/ \# Database connection 
├── utils/ \# Email & helper utilities 
└── server.js \# Entry point

------------------------------------------------------------------------

## 🔐 Authentication System

-   User Registration
-   Secure Password Hashing (bcrypt)
-   JWT Token Generation
-   Protected Routes Middleware
-   Email Verification (via Nodemailer)
-   Role-based access (Planned)

------------------------------------------------------------------------

## 📧 Email Service (Nodemailer + Google App Password)

We use **Nodemailer** to send emails (OTP / Verification / Password
Reset).\
Emails are sent using a **Google App Password** for security.

### 🔹 Step 1: Enable 2-Step Verification on Google

1.  Go to your Google Account → Security
2.  Enable **2-Step Verification**

### 🔹 Step 2: Generate App Password

1.  Go to Google Account → Security → App passwords
2.  Select app: Mail
3.  Select device: Other
4.  Generate password
5.  Copy the 16-character password

------------------------------------------------------------------------

### 🔹 Step 3: Add Environment Variables

Add this to your `.env` file:

EMAIL_USER=your_email@gmail.com\
EMAIL_PASS=your_16_character_app_password

------------------------------------------------------------------------

### 🔹 Step 4: Example Nodemailer Setup

``` js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `"CONVOC" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
```

------------------------------------------------------------------------

## 🌍 Environment Variables

Create a `.env` file in the root directory:

PORT=3000\
MONGO_URI=mongodb://localhost:27017/convoc\
JWT_SECRET=your_jwt_secret_key\
EMAIL_USER=your_email@gmail.com\
EMAIL_PASS=your_app_password

------------------------------------------------------------------------

## 🗄️ Database Setup

Make sure MongoDB is running locally OR use MongoDB Atlas.

Local Example:

mongodb://localhost:27017/convoc

------------------------------------------------------------------------

## 🛠️ Installation & Setup

### 1️⃣ Clone the repository

git clone https://github.com/riteshcgiri/convoc-backend.git\
cd convoc-backend

### 2️⃣ Install dependencies

npm install

### 3️⃣ Run development server

npm run dev

OR

node server.js

Server will run on:

http://localhost:3000

------------------------------------------------------------------------

## 📡 API Base URL

http://localhost:3000/api

------------------------------------------------------------------------

## 🔮 Upcoming Features

-   🔄 Real-time messaging with Socket.io
-   👥 One-to-one & group chats
-   📂 File & media sharing
-   🟢 Online/Offline presence tracking
-   📹 Voice & video call signaling
-   🖥️ Screen sharing support
-   🔔 Notifications system

------------------------------------------------------------------------

## 📌 Project Status

🚧 Currently in active development.

-   Authentication APIs completed\
-   Email service integrated\
-   Database connection configured\
-   Core API structure implemented\
-   Real-time communication integration in progress

------------------------------------------------------------------------

## 👨‍💻 Author

Ritesh Giri\
Full Stack Developer
