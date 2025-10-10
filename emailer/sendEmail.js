import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    try{
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const message = {
        from: `Nymara <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
        attachments: options.attachments || [],
    };

    const info = await transporter.sendMail(message);
    console.log('Message sent: %s', info.messageId);
}catch (error) {
    console.error("❌ Email sending failed:", error.message);
    throw new Error("Email could not be sent");
  }
};

export default sendEmail;