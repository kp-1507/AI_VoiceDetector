import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
   service: "Gmail",
   auth: {
      user: process.env.USER_GMAIL,
      pass: process.env.USER_GMAIL_PASS,
   },
});

export default transporter;
