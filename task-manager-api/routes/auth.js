'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Google OAuth client (used to verify ID tokens from the "Continue with Google"
// button). Reads VITE's sibling GOOGLE_CLIENT_ID env var on the server side.
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// ── Helper: generate JWT ──────────────────────────────────────────────────────
const generateToken = (user) => {
    return jwt.sign(
        { userId: user._id, email: user.email, fullName: user.fullName },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// ── Helper: create email transporter ──────────────────────────────────────────
const createTransporter = async () => {
    // If real credentials are provided, use them
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    // Fallback: use Ethereal test account (logs preview URL to console)
    const testAccount = await nodemailer.createTestAccount();
    console.log('📧 Using an Ethereal test mailbox. Check the preview URL after sending; this does not deliver to a real inbox.');
    return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
};

// ── Helper: send welcome email after registration ────────────────────────────
const sendWelcomeEmail = async (user) => {
    const fromName = process.env.EMAIL_FROM_NAME || 'Task Manager';
    const mailOptions = {
        from: `"${fromName}" <${process.env.EMAIL_USER || 'noreply@taskmanager.com'}>`,
        to: user.email,
        subject: 'Welcome to Task Manager - Your Account Has Been Created!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 30px; background: #1a1a2e; border-radius: 16px; color: #e0e0ff;">
                <h2 style="color: #4361ee; margin-bottom: 20px;">👋 Welcome to Task Manager!</h2>
                <p>Dear <strong>${user.fullName}</strong>,</p>
                <p>Thank you for registering with Task Manager. Your account has been created successfully.</p>
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #a0a0b8;">Username:</td>
                        <td style="padding: 8px 0;"><strong>${user.fullName}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #a0a0b8;">Email:</td>
                        <td style="padding: 8px 0;"><strong>${user.email}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #a0a0b8;">Account Status:</td>
                        <td style="padding: 8px 0; color: #4cc9a1;"><strong>Active</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #a0a0b8;">Registration Date:</td>
                        <td style="padding: 8px 0;"><strong>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></td>
                    </tr>
                </table>
                <p style="color: #a0a0b8; font-size: 14px;">Please keep this email for your records. You can now log in to your account and start managing your tasks.</p>
            </div>
        `,
    };

    const transporter = await createTransporter();
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Welcome email preview URL: ${previewUrl}`);
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /auth/register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
    try {
        const { fullName, email, password, confirmPassword } = req.body;

        // Input validation
        if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
            return res.status(400).json({ error: 'Validation Error', message: 'Full name is required (min 2 characters).' });
        }
        if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({ error: 'Validation Error', message: 'A valid email address is required.' });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'Validation Error', message: 'Password must be at least 6 characters.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Validation Error', message: 'Passwords do not match.' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists.' });
        }

        // Create user
        const user = await User.create({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
        });

        const token = generateToken(user);

        // Send welcome email (Fig 6) — fire-and-forget so a slow/unreachable SMTP
        // server never blocks or fails the actual registration response.
        sendWelcomeEmail(user).catch(err => {
            console.error('Welcome email failed:', err.message);
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token,
            user: { id: user._id, fullName: user.fullName, email: user.email },
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({ error: 'Validation Error', message: 'A valid email address is required.' });
        }
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ error: 'Validation Error', message: 'Password is required.' });
        }

        // Find user
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            token,
            user: { id: user._id, fullName: user.fullName, email: user.email },
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /auth/google  → verify a Google ID token and sign the user in
//  (Fig 5: "Continue with Google")
// ─────────────────────────────────────────────────────────────────────────────
router.post('/google', async (req, res, next) => {
    try {
        const { credential } = req.body;

        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({ error: 'Validation Error', message: 'Google credential is required.' });
        }
        if (!googleClient) {
            return res.status(503).json({
                error: 'Not Configured',
                message: 'Google Sign-In is not configured on the server. Set GOOGLE_CLIENT_ID.',
            });
        }

        // Verify the ID token with Google (checks signature + audience)
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: googleClientId,
        });
        const payload = ticket.getPayload();
        const email = (payload.email || '').trim().toLowerCase();
        const fullName = payload.name || email.split('@')[0] || 'Google User';

        if (!email) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Google account has no email address.' });
        }

        // Find or create the user
        let user = await User.findOne({ email });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = await User.create({
                fullName,
                email,
                // Random unusable password — this account can only be accessed
                // through Google Sign-In (or a password reset).
                password: crypto.randomBytes(24).toString('hex'),
            });

            // Send welcome email (Fig 6) for first-time Google sign-ups
            sendWelcomeEmail(user).catch(err => {
                console.error('Welcome email failed:', err.message);
            });
        }

        const token = generateToken(user);

        res.status(200).json({
            success: true,
            message: isNewUser ? 'Account created and logged in via Google!' : 'Login successful!',
            token,
            user: { id: user._id, fullName: user.fullName, email: user.email },
        });
    } catch (err) {
        if (err && /invalid|token|audience/i.test(err.message || '')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google credential.' });
        }
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({ error: 'Validation Error', message: 'A valid email address is required.' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            // Do not reveal whether an account exists.
            return res.status(200).json({
                success: true,
                message: 'If an account with this email exists, a password reset code has been sent.',
            });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        user.resetOtp = crypto.createHash('sha256').update(otp).digest('hex');
        user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const safeName = String(user.fullName).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[character]);

        try {
            const transporter = await createTransporter();
            const mailOptions = {
                from: process.env.EMAIL_USER
                    ? `"${process.env.EMAIL_FROM_NAME || 'Task Manager'}" <${process.env.EMAIL_USER}>`
                    : '"Task Manager" <noreply@taskmanager.com>',
                to: user.email,
                subject: 'Your Task Manager password reset code',
                text: `Hi ${user.fullName}, your Task Manager password reset code is ${otp}. It expires in 10 minutes. If you did not request it, ignore this email.`,
                html: `
                    <div style="background:#f5f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#273449;">
                        <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
                            <h2 style="margin:0 0 20px;color:#1f2937;font-size:20px;">Task Manager code</h2>
                            <p style="margin:0 0 14px;">Hi ${safeName},</p>
                            <p style="margin:0 0 18px;">Here is your requested code for your Task Manager account:</p>
                            <div style="text-align:center;margin:20px 0 12px;">
                                <span style="display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:10px 18px;font-size:30px;font-weight:700;letter-spacing:8px;color:#111827;">${otp}</span>
                            </div>
                            <p style="margin:0;text-align:center;color:#64748b;font-size:13px;">Expires in 10 minutes</p>
                            <p style="margin:24px 0 0;color:#64748b;font-size:13px;">If you did not request this code, you can ignore this email.</p>
                        </div>
                    </div>
                `,
            };

            const info = await transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl && process.env.NODE_ENV !== 'production') {
                console.log(`📧 Password reset email preview: ${previewUrl}`);
            }
        } catch (emailErr) {
            console.error('Password reset email delivery failed:', emailErr.message);
            user.resetOtp = null;
            user.resetOtpExpiry = null;
            await user.save();
            return res.status(503).json({
                error: 'Email Delivery Failed',
                message: 'We could not send the reset code right now. Please try again later.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'If an account with this email exists, a password reset code has been sent.',
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────//  POST /auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Validation Error', message: 'Email, OTP, and new password are required.' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ error: 'Validation Error', message: 'New password must be at least 6 characters.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Validation Error', message: 'Passwords do not match.' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user || !user.resetOtp || !user.resetOtpExpiry) {
            return res.status(400).json({ error: 'Invalid Request', message: 'Invalid or expired OTP. Please request a new one.' });
        }

        // Check expiry
        if (new Date() > user.resetOtpExpiry) {
            user.resetOtp = null;
            user.resetOtpExpiry = null;
            await user.save();
            return res.status(400).json({ error: 'Expired', message: 'OTP has expired. Please request a new one.' });
        }

        // Verify OTP
        const hashedOtp = crypto.createHash('sha256').update(otp.toString()).digest('hex');
        if (hashedOtp !== user.resetOtp) {
            return res.status(400).json({ error: 'Invalid OTP', message: 'The OTP you entered is incorrect.' });
        }

        // Update password
        user.password = newPassword;
        user.resetOtp = null;
        user.resetOtpExpiry = null;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully! You can now log in with your new password.',
        });
    } catch (err) { next(err); }
});

module.exports = router;
