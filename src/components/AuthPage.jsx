import { useState } from 'react';
import ForgotPassword from './ForgotPassword';

const AUTH_API = '/api/auth';

function AuthPage({ onLogin }) {
    const [activeTab, setActiveTab] = useState('login');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Login state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPass, setShowLoginPass] = useState(false);

    // Register state
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirm, setRegConfirm] = useState('');
    const [showRegPass, setShowRegPass] = useState(false);
    const [showRegConfirm, setShowRegConfirm] = useState(false);

    const clearErrors = () => { setError(''); setSuccess(''); };

    const handleLogin = async (e) => {
        e.preventDefault();
        clearErrors();

        if (!loginEmail.trim() || !loginPassword) {
            setError('Please fill in all fields.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${AUTH_API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Login failed.');
                return;
            }

            localStorage.setItem('tm_token', data.token);
            localStorage.setItem('tm_user', JSON.stringify(data.user));
            onLogin(data.user, data.token);
        } catch {
            setError('Connection failed. Make sure the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        clearErrors();

        if (!regName.trim() || !regEmail.trim() || !regPassword || !regConfirm) {
            setError('Please fill in all fields.');
            return;
        }
        if (regPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (regPassword !== regConfirm) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${AUTH_API}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: regName.trim(),
                    email: regEmail.trim(),
                    password: regPassword,
                    confirmPassword: regConfirm,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Registration failed.');
                return;
            }

            localStorage.setItem('tm_token', data.token);
            localStorage.setItem('tm_user', JSON.stringify(data.user));
            onLogin(data.user, data.token);
        } catch {
            setError('Connection failed. Make sure the server is running.');
        } finally {
            setLoading(false);
        }
    };

    if (showForgotPassword) {
        return (
            <ForgotPassword
                onBack={() => { setShowForgotPassword(false); setActiveTab('login'); clearErrors(); }}
                onSuccess={() => {
                    setShowForgotPassword(false);
                    setActiveTab('login');
                    setSuccess('Password reset successful! Please log in with your new password.');
                }}
            />
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-bg-orb auth-orb-1"></div>
            <div className="auth-bg-orb auth-orb-2"></div>
            <div className="auth-bg-orb auth-orb-3"></div>

            <div className="auth-card">
                {/* Close / decorative icon */}
                <div className="auth-avatar">
                    <i className="fas fa-user-plus"></i>
                </div>

                {/* Title */}
                <h1 className="auth-title">
                    {activeTab === 'login' ? 'Welcome Back' : 'Create Your Account'}
                </h1>
                <p className="auth-subtitle">
                    {activeTab === 'login'
                        ? 'Log in to manage your personal tasks.'
                        : 'Register to manage personal tasks and track audit logs.'}
                </p>

                {/* Tab Switcher */}
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('login'); clearErrors(); }}
                    >
                        <i className="fas fa-sign-in-alt"></i> Log In
                    </button>
                    <button
                        className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('register'); clearErrors(); }}
                    >
                        <i className="fas fa-user-plus"></i> Register
                    </button>
                </div>

                {/* Error / Success Messages */}
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

                {/* Login Form */}
                {activeTab === 'login' && (
                    <form onSubmit={handleLogin} className="auth-form">
                        <div className="auth-field">
                            <label className="auth-label">Email Address</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-envelope auth-input-icon"></i>
                                <input
                                    type="email"
                                    className="auth-input"
                                    placeholder="your@email.com"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">Password</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-lock auth-input-icon"></i>
                                <input
                                    type={showLoginPass ? 'text' : 'password'}
                                    className="auth-input"
                                    placeholder="••••••"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowLoginPass(p => !p)}
                                    tabIndex={-1}
                                >
                                    <i className={`fas fa-eye${showLoginPass ? '-slash' : ''}`}></i>
                                </button>
                            </div>
                        </div>

                        <div className="auth-forgot-row">
                            <button
                                type="button"
                                className="auth-forgot-link"
                                onClick={() => { setShowForgotPassword(true); clearErrors(); }}
                            >
                                Forgot Password?
                            </button>
                        </div>

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <><span className="auth-spinner"></span> Logging in...</>
                            ) : (
                                <><i className="fas fa-sign-in-alt"></i> Log In</>
                            )}
                        </button>

                        <p className="auth-switch-text">
                            Don't have an account?{' '}
                            <button type="button" className="auth-switch-link" onClick={() => { setActiveTab('register'); clearErrors(); }}>
                                Register here
                            </button>
                        </p>
                    </form>
                )}

                {/* Register Form */}
                {activeTab === 'register' && (
                    <form onSubmit={handleRegister} className="auth-form">
                        <div className="auth-field">
                            <label className="auth-label">Full Name</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-user auth-input-icon"></i>
                                <input
                                    type="text"
                                    className="auth-input"
                                    placeholder="John Doe"
                                    value={regName}
                                    onChange={(e) => setRegName(e.target.value)}
                                    required
                                    autoComplete="name"
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">Email Address</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-envelope auth-input-icon"></i>
                                <input
                                    type="email"
                                    className="auth-input"
                                    placeholder="your@email.com"
                                    value={regEmail}
                                    onChange={(e) => setRegEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">Password</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-lock auth-input-icon"></i>
                                <input
                                    type={showRegPass ? 'text' : 'password'}
                                    className="auth-input"
                                    placeholder="••••••"
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowRegPass(p => !p)}
                                    tabIndex={-1}
                                >
                                    <i className={`fas fa-eye${showRegPass ? '-slash' : ''}`}></i>
                                </button>
                            </div>
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">Confirm Password</label>
                            <div className="auth-input-wrapper">
                                <i className="fas fa-lock auth-input-icon"></i>
                                <input
                                    type={showRegConfirm ? 'text' : 'password'}
                                    className="auth-input"
                                    placeholder="••••••"
                                    value={regConfirm}
                                    onChange={(e) => setRegConfirm(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowRegConfirm(p => !p)}
                                    tabIndex={-1}
                                >
                                    <i className={`fas fa-eye${showRegConfirm ? '-slash' : ''}`}></i>
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <><span className="auth-spinner"></span> Creating Account...</>
                            ) : (
                                <><i className="fas fa-user-plus"></i> Create Account</>
                            )}
                        </button>

                        <p className="auth-switch-text">
                            Already have an account?{' '}
                            <button type="button" className="auth-switch-link" onClick={() => { setActiveTab('login'); clearErrors(); }}>
                                Log in here
                            </button>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}

export default AuthPage;
