import { useState, useEffect, useCallback } from 'react';

function Spinner() {
    return (
        <div className="spinner-container">
            <div className="spinner"></div>
            <p className="spinner-text">Fetching repositories...</p>
        </div>
    );
}

function ErrorMessage({ onRetry }) {
    return (
        <div className="error-box">
            <div className="error-text-title">
                <span>❌</span> Failed to load repositories.
            </div>
            <div className="error-text-subtitle">Please try again.</div>
            {onRetry && (
                <button onClick={onRetry} className="error-retry-btn">
                    Retry
                </button>
            )}
        </div>
    );
}

function Projects() {
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRepos = useCallback(() => {
        // Avoid synchronous state changes inside useEffect to prevent cascading renders
        Promise.resolve().then(() => {
            setLoading(true);
            setError(null);
        });
        fetch('https://api.github.com/users/PatelRudra9/repos')
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    setRepos(data);
                } else {
                    throw new Error("Invalid format received from API");
                }
            })
            .catch((err) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        fetchRepos();
    }, [fetchRepos]);

    // Filter repositories based on the search query
    const filteredRepos = repos.filter((repo) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <main className="main-content">
            <section className="section-container projects-section">

                <div className="projects-container-card">


                    {loading ? (
                        <Spinner />
                    ) : error ? (
                        <ErrorMessage message={error} onRetry={fetchRepos} />
                    ) : (
                        <>
                            {/* Search input to filter repositories */}
                            <div className="search-bar-container" style={{ width: '100%' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Search repositories by name..."
                                    className="search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {filteredRepos.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    <p>No repositories found matching "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="projects-grid" style={{ width: '100%', marginTop: '20px' }}>
                                    {filteredRepos.map((repo) => (
                                        <div key={repo.id} className="project-card" style={{ textAlign: 'left' }}>
                                            <div className="project-card-top">
                                                <span className="project-emoji">📂</span>
                                                <h3 className="project-title" style={{ flex: 1 }}>{repo.name}</h3>
                                                <div className="repo-star-badge">
                                                    ⭐ {repo.stargazers_count}
                                                </div>
                                            </div>
                                            <p className="project-description">
                                                {repo.description || "No description provided."}
                                            </p>
                                            <div className="project-tech-tags">
                                                {repo.language && (
                                                    <span className="tech-tag">{repo.language}</span>
                                                )}
                                                <span className="tech-tag">Stars: {repo.stargazers_count}</span>
                                                <span className="tech-tag">Forks: {repo.forks_count}</span>
                                            </div>
                                            <a
                                                href={repo.html_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="project-link-btn"
                                            >
                                                View on GitHub →
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </main>
    );
}

export default Projects;
