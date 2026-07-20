function Footer() {
    return (
        <footer id="contact" className="portfolio-footer-section">
            <div className="footer-content">
                <h2 className="footer-title">Get In Touch</h2>
                <p className="footer-text">
                    Have an interesting project or looking for a collaborative partner? Shoot an email or connect through socials!
                </p>
                <div className="footer-contact-info">
                    <a href="mailto:patelrudrabhai6@gmail.com" className="contact-link">
                        📧 patelrudrabhai6@gmail.com
                    </a>
                    <a href="tel:+917600747804" className="contact-link">
                        📞 +91 7600747804
                    </a>
                </div>
                <div className="footer-divider"></div>
                <div className="footer-bottom">
                    <p className="copyright-text">
                        © {new Date().getFullYear()} CHARUSAT. All Rights Reserved. Created by Student.
                    </p>
                    <div className="footer-social-links">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
