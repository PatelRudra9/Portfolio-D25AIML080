import { useState } from 'react';

const MAX_CHARS = 500;

// Formspree endpoint comes from the environment so it can be swapped without
// code changes. If it's not configured, we fall back to a mailto: link so the
// visitor is never told a message "sent" when nothing was actually sent.
const FORMSPREE_ENDPOINT = (import.meta.env.VITE_FORMSPREE_ENDPOINT || '').trim();

function validate({ name, email, message }) {
    const errors = {};
    if (!name.trim()) errors.name = 'Please enter your name.';
    if (!email.trim()) errors.email = 'Please enter your email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        errors.email = 'That email address doesn’t look valid.';
    if (!message.trim()) errors.message = 'Please enter a message.';
    else if (message.trim().length < 10) errors.message = 'Message is a little short — add a few more details.';
    return errors;
}

function Contact() {
    // Controlled form fields
    const [form, setForm] = useState({ name: '', email: '', message: '' });

    // Tooltip visibility toggle
    const [showTip, setShowTip] = useState(false);

    // Submission state: idle | submitting | success | error
    const [status, setStatus] = useState('idle');
    const [errors, setErrors] = useState({});
    const [errorMsg, setErrorMsg] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'message' && value.length > MAX_CHARS) return;
        setForm(prev => ({ ...prev, [name]: value }));
        // Clear this field's error as soon as the user edits it
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Client-side validation
        const validationErrors = validate(form);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        // No endpoint configured yet — open the visitor's mail client instead
        // of pretending the message was delivered.
        if (!FORMSPREE_ENDPOINT) {
            const body = `${form.message}\n\n— ${form.name} (${form.email})`;
            const mailto = `mailto:patelrudrabhai6@gmail.com?subject=${encodeURIComponent(
                `Portfolio contact from ${form.name}`
            )}&body=${encodeURIComponent(body)}`;
            window.location.href = mailto;
            return;
        }

        setStatus('submitting');
        setErrorMsg('');

        try {
            const res = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    message: form.message.trim(),
                }),
            });

            if (!res.ok) {
                // Formspree returns JSON with an `errors` array on failure
                const data = await res.json().catch(() => ({}));
                const detail = Array.isArray(data.errors) && data.errors.length
                    ? data.errors.map(err => err.message).join(', ')
                    : `Request failed (${res.status}).`;
                throw new Error(detail);
            }

            setStatus('success');
        } catch (err) {
            setStatus('error');
            setErrorMsg(
                err.message && !err.message.includes('Failed to fetch')
                    ? err.message
                    : 'Couldn’t send your message — check your connection and try again.'
            );
        }
    };

    const handleReset = () => {
        setForm({ name: '', email: '', message: '' });
        setErrors({});
        setStatus('idle');
        setErrorMsg('');
    };

    return (
        <main className="main-content">
            <section className="section-container contact-section">
                <div className="section-header">
                    <span className="section-subtitle">Let's work together</span>
                    <h2 className="section-title">Contact Me</h2>
                    <div className="section-divider"></div>
                </div>

                {status === 'success' ? (
                    <div className="contact-success" role="status" aria-live="polite">
                        <span className="success-icon">✅</span>
                        <h3>Message Sent!</h3>
                        <p>
                            Thanks, <strong>{form.name}</strong>! Your message is on its way.
                            I’ll reply to <strong>{form.email}</strong> soon.
                        </p>
                        <button type="button" className="contact-submit-btn" onClick={handleReset}>
                            Send Another Message
                        </button>
                    </div>
                ) : (
                    <div className="contact-card">
                        {/* Help tooltip toggle */}
                        <div className="contact-tip-wrapper">
                            <button
                                type="button"
                                className="tip-toggle-btn"
                                onClick={() => setShowTip(prev => !prev)}
                            >
                                💡 {showTip ? 'Hide Tips' : 'Show Tips'}
                            </button>
                            {showTip && (
                                <div className="contact-tip-box">
                                    <p>✏️ Fill in your name and email so I can reply to you.</p>
                                    <p>📝 Describe your project or question in the message box.</p>
                                    <p>⏱️ I typically reply within 24–48 hours.</p>
                                </div>
                            )}
                        </div>

                        {/* Honest notice when no endpoint is configured yet */}
                        {!FORMSPREE_ENDPOINT && (
                            <div className="contact-disclaimer" role="note">
                                <span aria-hidden="true">ℹ️</span>
                                <span>
                                    Live sending isn’t configured yet, so this opens your own
                                    email app instead. Add a Formspree endpoint to{' '}
                                    <code>.env</code> to deliver messages straight to my inbox.
                                </span>
                            </div>
                        )}

                        <form className="contact-form" onSubmit={handleSubmit} noValidate>
                            <div className="form-group">
                                <label htmlFor="name" className="form-label">Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    name="name"
                                    className="form-input"
                                    placeholder="Your full name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                    aria-invalid={!!errors.name}
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                />
                                {errors.name && (
                                    <span id="name-error" className="form-error" role="alert">{errors.name}</span>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="email" className="form-label">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    className="form-input"
                                    placeholder="your@email.com"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    aria-invalid={!!errors.email}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                />
                                {errors.email && (
                                    <span id="email-error" className="form-error" role="alert">{errors.email}</span>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="message" className="form-label">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    className="form-input form-textarea"
                                    placeholder="Tell me about your project or say hi!"
                                    rows={6}
                                    value={form.message}
                                    onChange={handleChange}
                                    required
                                    aria-invalid={!!errors.message}
                                    aria-describedby={errors.message ? 'message-error' : undefined}
                                />
                                {/* Live character count */}
                                <div className={`char-count ${form.message.length >= MAX_CHARS ? 'char-limit' : ''}`}>
                                    {form.message.length} / {MAX_CHARS} characters
                                </div>
                                {errors.message && (
                                    <span id="message-error" className="form-error" role="alert">{errors.message}</span>
                                )}
                            </div>

                            {/* Submission error banner */}
                            {status === 'error' && (
                                <div className="contact-error" role="alert">
                                    <span aria-hidden="true">⚠️</span>
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="contact-submit-btn"
                                disabled={status === 'submitting'}
                                aria-busy={status === 'submitting'}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <span className="btn-spinner" aria-hidden="true"></span>
                                        Sending…
                                    </>
                                ) : (
                                    <>🚀 Send Message</>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </section>
        </main>
    );
}

export default Contact;
