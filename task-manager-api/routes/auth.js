'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

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
    console.log('📧 Using Ethereal test email. Credentials:', testAccount.user, testAccount.pass);
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
            // Don't reveal if email exists or not (security best practice)
            return res.status(200).json({
                success: true,
                message: 'If an account with this email exists, a password reset OTP has been sent.',
            });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        // Save to user
        user.resetOtp = hashedOtp;
        user.resetOtpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        // Send email
        try {
            const transporter = await createTransporter();
            const mailOptions = {
                from: process.env.EMAIL_USER || '"Task Manager" <noreply@taskmanager.com>',
                to: user.email,
                subject: 'Password Reset OTP — Task Manager',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: #1a1a2e; border-radius: 16px; color: #e0e0ff;">
                        <h2 style="color: #4361ee; margin-bottom: 20px;">🔐 Password Reset</h2>
                        <p>Hello <strong>${user.fullName}</strong>,</p>
                        <p>Your password reset OTP is:</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4361ee; background: #16213e; padding: 12px 28px; border-radius: 12px; display: inline-block;">${otp}</span>
                        </div>
                        <p style="color: #a0a0b8; font-size: 14px;">This OTP is valid for <strong>15 minutes</strong>. If you didn't request this, ignore this email.</p>
                    </div>
                `,
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 Password reset OTP for ${user.email}: ${otp}`);

            // If using Ethereal, log the preview URL
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log(`📧 Preview URL: ${previewUrl}`);
            }
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr.message);
            // Still log the OTP to console for development
            console.log(`📧 [FALLBACK] Password reset OTP for ${user.email}: ${otp}`);
        }

        res.status(200).json({
            success: true,
            message: 'If an account with this email exists, a password reset OTP has been sent.',
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /auth/reset-password
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
