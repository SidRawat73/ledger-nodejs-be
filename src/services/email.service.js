const nodemailer = require('nodemailer');
const { LEDGER_TYPE } = require('../../constants');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log('Server is ready to send emails');
    }
});

async function sendEmail(to, subject, text, html) {
    try {
        const mailOptions = {
            from: `Ledger <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        };
        console.log('Sending email to', to);
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function sendRegistrationEmail(userEmail, name) {
    const subject = 'Welcome to Ledger';
    const text = `Welcome to Ledger ${name}`;
    const html = `
    <h1>Welcome to Ledger</h1>
    <p>Welcome to Ledger ${name}</p>
    <p>Thank you for registering with us</p>
    `;
    await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionSuccessEmail(userEmail, name, transaction) {
    // check if debit / credit is done
    const subject = 'Transaction Successful';
    const text = `Transaction Successful ${name}`;
    const html = `
    <h1>Transaction Successful</h1>
    <p>Transaction Successful ${name}.${transaction.type === LEDGER_TYPE.DEBIT ? 'Debit' : 'Credit'} ${transaction.amount} ${transaction.currency}</p>
    <p>Your transaction has been successful. You can now view your transaction in your account.</p>
    `;
    await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionFailedEmail(userEmail, name, transaction) {
    const subject = 'Transaction Failed';
    const text = `Transaction Failed ${name}`;
    const html = `
    <h1>Transaction Failed</h1>
    <p>Transaction Failed ${name} for ${transaction.amount} ${transaction.currency}</p>
    <p>Thank you for your transaction</p>
    `;
    await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionReversedEmail(userEmail, name, transaction) {
    const subject = 'Transaction Reversed';
    const text = `Transaction Reversed ${name}`;
    const html = `
    <h1>Transaction Reversed</h1>
    <p>Transaction Reversed ${name} for ${transaction.amount} ${transaction.currency}</p>
    <p>Thank you for your transaction</p>
    `;
    await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionPendingEmail(userEmail, name, transaction) {
    const subject = 'Transaction Pending';
    const text = `Transaction Pending ${name}`;
    const html = `
    <h1>Transaction Pending</h1>
    <p>Transaction Pending ${name} for ${transaction.amount} ${transaction.currency}</p>
    <p>Thank you for your transaction</p>
    `;
    await sendEmail(userEmail, subject, text, html);
}
module.exports = {
    sendRegistrationEmail,
    sendTransactionSuccessEmail,
    sendTransactionPendingEmail,
    sendTransactionFailedEmail, sendTransactionReversedEmail
};