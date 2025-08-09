import transporter from "./mailer.js";

export async function sendEvaluatorInviteMail(toEmail, link) {
   const mailHTML = `
    <div style="font-family: Arial, sans-serif;">
      <h2>You have been invited as a test evaluator</h2>
      <p>Please click the link below to accept your invitation and set up your evaluator account:</p>
      <a href="${link}" style="padding:10px 20px; background:#356de9; color:white; text-decoration:none; border-radius:4px;">Accept Invitation</a>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p>${link}</p>
      <hr>
      <p>If you did not expect this invitation, you can ignore this email.</p>
    </div>
  `;

   await transporter.sendMail({
      from: process.env.USER_GMAIL,
      to: toEmail,
      subject: "Test Evaluation Invitation",
      html: mailHTML,
   });
}
