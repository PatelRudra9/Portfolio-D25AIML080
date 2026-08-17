import { Link } from 'react-router-dom';

function Certificates() {
    const certifications = [
        {
            id: 1,
            title: "Artificial Intelligence & Machine Learning",
            issuer: "Charotar University of Science and Technology (CHARUSAT)",
            date: "In Progress",
            description: "Core algorithms, neural networks, computer vision, and predictive modeling.",
            badge: "🎓 B.Tech Spec"
        },
        {
            id: 2,
            title: "Full-Stack Web Application Engineering",
            issuer: "Practical Lab Projects Portfolio",
            date: "August 2026",
            description: "Development of RESTful APIs, Express middlewares, and interactive React client dashboards.",
            badge: "💻 Lab Certified"
        }
    ];

    return (
        <div className="main-content">
            <section className="tm-section certificates-section">
                {/* Decorative Floating Mesh Orbs */}
                <div className="tm-bg-orb tm-orb-1" style={{ opacity: 0.12 }}></div>
                <div className="tm-bg-orb tm-orb-2" style={{ opacity: 0.12 }}></div>

                <div className="container tm-container">
                    {/* Header */}
                    <div className="section-header">
                        <span className="section-subtitle">Credentials</span>
                        <h1 className="section-title">🏆 Certifications</h1>
                        <div className="section-divider"></div>
                    </div>

                    {/* Intro Notice */}
                    <div className="certs-status-card">
                        <span className="certs-status-icon">⚡</span>
                        <div className="certs-status-text">
                            <h3>Secure Repository Online</h3>
                            <p>Verified digital certificates are currently being updated and will be uploaded here shortly.</p>
                        </div>
                    </div>

                    {/* Grid list of certifications */}
                    <div className="certs-grid">
                        {certifications.map((cert) => (
                            <div key={cert.id} className="cert-panel">
                                <div className="cert-panel-header">
                                    <span className="cert-badge">{cert.badge}</span>
                                    <span className="cert-date">{cert.date}</span>
                                </div>
                                <h3 className="cert-title">{cert.title}</h3>
                                <h4 className="cert-issuer">{cert.issuer}</h4>
                                <p className="cert-desc">{cert.description}</p>
                                <div className="cert-loading-indicator">
                                    <div className="cert-loader-dot"></div>
                                    <span>Awaiting document upload...</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="certs-actions">
                        <Link to="/" className="certs-back-btn">
                            ← Return Home
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Certificates;
