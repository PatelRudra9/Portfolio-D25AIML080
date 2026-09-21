import { useState } from 'react';

const AUTH_API = '/api/auth';

function ForgotPassword({ onBack, onSuccess }) {
    const [step, setStep] = useState(1); // 1 = enter email, 2 = enter OTP + new password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${AUTH_API}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Failed to send OTP.');
                return;
            }

            setSuccess('OTP sent! Check your email (or server console in development).');
            setStep(2);
        } catch {
            setError('Connection failed. Make sure the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!otp.trim()) {
            setError('Please enter the OTP.');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${AUTH_API}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    otp: otp.trim(),
                    newPassword,
                    confirmPassword,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Failed to reset password.');
                return;
            }

            onSuccess();
        } catch {
            setError('Connection failed. Make sure the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-orb auth-orb-1"></div>
            <div className="auth-bg-orb auth-orb-2"></div>
            <div className="auth-bg-orb auth-orb-3"></div>

            <div className="auth-card">
                <div className="auth-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                    <i className="fas fa-key"></i>
                </div>

                <h1 className="auth-title">
                    {step === 1 ? 'Forgot Password?' : 'Reset Password'}
                </h1>
                <p className="auth-subtitle">
                    {step === 1
                        ? 'Enter your email and we\'ll send you a 6-digit OTP to reset your password.'
                        : 'Enter the OTP sent to your email and set a new password.'}
                </p>

                {error && (
                    <div className="auth-message auth-error">
                        <i className="fas fa-exclamation-circle"></i> {error}
                    </div>
                )}
                {success && (
                    <div className="auth-message auth-success">
                        <i className="fas fa-check-circle"></i> {success}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleSendOtp} className="auth-form">
                        <div className="auth-field">
                            <label className="auth-label">Email Address</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-envelope auth-input-icon"></i>
                                <input
                                    type="email"
                                    className="auth-input"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <><span className="auth-spinner"></span> Sending OTP...</>
                            ) : (
                                <><i className="fas fa-paper-plane"></i> Send OTP</>
                            )}
                        </button>

                        <p className="auth-switch-text">
                            Remember your password?{' '}
                            <button type="button" className="auth-switch-link" onClick={onBack}>
                                Back to Login
                            </button>
                        </p>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleResetPassword} className="auth-form">
                        <div className="auth-field">
                            <label className="auth-label">OTP Code</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-shield-alt auth-input-icon"></i>
                                <input
                                    type="text"
                                    className="auth-input auth-otp-input"
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    required
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    style={{ letterSpacing: '6px', fontWeight: '700', fontSize: '1.2rem', textAlign: 'center' }}
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">New Password</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-lock auth-input-icon"></i>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className="auth-input"
                                    placeholder="••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowPass(p => !p)}
                                    tabIndex={-1}
                                >
                                    <i className={`fas fa-eye${showPass ? '-slash' : ''}`}></i>
                                </button>
                            </div>
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">Confirm New Password</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-lock auth-input-icon"></i>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    className="auth-input"
                                    placeholder="••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowConfirm(p => !p)}
                                    tabIndex={-1}
                                >
                                    <i className={`fas fa-eye${showConfirm ? '-slash' : ''}`}></i>
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <><span className="auth-spinner"></span> Resetting...</>
                            ) : (
                                <><i className="fas fa-key"></i> Reset Password</>
                            )}
                        </button>

                        <div className="auth-reset-actions">
                            <button type="button" className="auth-switch-link" onClick={() => { setStep(1); setError(''); setSuccess(''); }}>
                                <i className="fas fa-redo"></i> Resend OTP
                            </button>
                            <button type="button" className="auth-switch-link" onClick={onBack}>
                                <i className="fas fa-arrow-left"></i> Back to Login
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ForgotPassword;
