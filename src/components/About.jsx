function About() {
    return (
        <section id="about" className="section-container about-section">
            <div className="section-header">
                <span className="section-subtitle">A brief overview</span>
                <h2 className="section-title">About Me</h2>
                <div className="section-divider"></div>
            </div>

            <div className="about-grid">
                <div className="about-bio-card">
                    <p className="about-text">
                        Hi, I'm Rudra Patel, an AI & ML student at
                        <strong> Charotar University of Science and Technology (CHARUSAT)</strong>.
                        I enjoy learning new technologies and building real-world projects using Python, AI, and web development.
                    </p>
                </div>

                <div className="about-detail-cards">
                    <div className="detail-card">
                        <span className="detail-icon">🎓</span>
                        <div className="detail-info">
                            <h3>Education</h3>
                            <p>B.Tech — in Artificial Intelligence & Machine Learning., CHARUSAT</p>
                        </div>
                    </div>
                    <div className="detail-card">
                        <span className="detail-icon">💡</span>
                        <div className="detail-info">
                            <h3>Philosophy</h3>
                            <p>Keep learning. Keep Exploring..</p>
                        </div>
                    </div>
                    <div className="detail-card">
                        <span className="detail-icon">🚀</span>
                        <div className="detail-info">
                            <h3>Interests</h3>
                            <p>React, Node , Ai Product Manager , Machine Learning</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default About;
