import nodemailer from "nodemailer";

/** Gửi email chứa token qua SMTP, không ghi token vào log. */
export const sendMail = async (email: string, subject: string, text: string) => {
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) {
    throw new Error("Chưa cấu hình SMTP!");
  }

  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.MAIL_FROM, to: email, subject, text });
};
