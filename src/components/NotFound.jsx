import { Link } from 'react-router-dom';

function NotFound() {
    return (
        <main className="main-content">
            <section className="not-found-section">
                <div className="not-found-content">
                    <span className="not-found-code">404</span>
                    <h2 className="not-found-title">Page Not Found</h2>
                    <p className="not-found-message">
                        Oops! The page you're looking for doesn't exist or has been moved.
                    </p>
                    <Link to="/" className="not-found-btn">
                        🏠 Back to Home
                    </Link>
                </div>
            </section>
        </main>
    );
}

export default NotFound;
