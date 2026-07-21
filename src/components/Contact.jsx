import { useState } from 'react';

const MAX_CHARS = 500;

function Contact() {
    // useState #1 — controlled form fields
    const [form, setForm] = useState({ name: '', email: '', message: '' });

    // useState #2 — tooltip visibility toggle
    const [showTip, setShowTip] = useState(false);

    // useState #3 — submitted state
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'message' && value.length > MAX_CHARS) return;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
    };

    const handleReset = () => {
        setForm({ name: '', email: '', message: '' });
        setSubmitted(false);
    };

    return (
        <main className="main-content">
            <section className="section-container contact-section">
                <div className="section-header">
                    <span className="section-subtitle">Let's work together</span>
                    <h2 className="section-title">Contact Me</h2>
                    <div className="section-divider"></div>
                </div>

                {submitted ? (
                    <div className="contact-success">
                        <span className="success-icon">✅</span>
                        <h3>Message Sent!</h3>
                        <p>Thanks, <strong>{form.name}</strong>! I'll get back to you at <strong>{form.email}</strong> soon.</p>
                        <button type="button" className="contact-submit-btn" onClick={handleReset}>
                            Send Another Message
                        </button>
                    </div>
                ) : (
                    <div className="contact-card">
                        {/* Help tooltip toggle — useState #2 in action */}
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
                                />
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
                                />
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
                                />
                                {/* Live character count — real-time useState update */}
                                <div className={`char-count ${form.message.length >= MAX_CHARS ? 'char-limit' : ''}`}>
                                    {form.message.length} / {MAX_CHARS} characters
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="contact-submit-btn"
                                disabled={!form.name || !form.email || !form.message}
                            >
                                🚀 Send Message
                            </button>
                        </form>
                    </div>
                )}
            </section>
        </main>
    );
}

export default Contact;
