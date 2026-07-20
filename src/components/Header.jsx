function Header({ name, title, themeColor }) {
    // Use themeColor prop for inline styling on specific accent elements
    const accentStyle = {
        color: themeColor || '#aa3bff',
    };

    const borderStyle = {
        borderColor: themeColor || '#aa3bff',
        color: themeColor || '#aa3bff',
    };

    const backgroundStyle = {
        backgroundColor: `${themeColor || '#aa3bff'}15`, // Add alpha hex transparency
        borderColor: themeColor || '#aa3bff',
    };

    return (
        <header className="portfolio-header">
            <div className="header-glow" style={{ background: `radial-gradient(circle, ${themeColor || '#aa3bff'}10 0%, transparent 70%)` }}></div>
            <div className="header-content">
                <span className="header-greeting" style={borderStyle}>Welcome to my space</span>
                <h1 className="header-name">
                    Hi, I am <span style={accentStyle}>{name}</span>
                </h1>
                <h2 className="header-title">{title}</h2>
                <p className="header-desc">
                    Building high-performance, visually stunning web applications with modern component-driven architectures.
                </p>
                <div className="header-badge-container">
                    <span className="header-badge" style={backgroundStyle}>Available for projects</span>
                </div>
            </div>
        </header>
    );
}

export default Header;
