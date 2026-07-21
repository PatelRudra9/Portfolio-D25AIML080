import { useState } from 'react';

const projectList = [
    {
        id: 1,
        emoji: '💼',
        title: 'Developer Portfolio',
        description: 'A responsive React portfolio app built with Vite, featuring dynamic props, theme switching, and reusable components.',
        tech: ['React', 'Vite', 'CSS3'],
        link: 'https://github.com/PatelRudra9/Portfolio-D25AIML080',
    },
    {
        id: 2,
        emoji: '🤖',
        title: 'AI Fashion Advisor',
        description: 'An AI-powered application that provides personalised fashion recommendations using machine learning models.',
        tech: ['Python', 'Machine Learning', 'AI'],
        link: '#',
    },
    {
        id: 3,
        emoji: '📋',
        title: 'Task Manager App',
        description: 'A full-stack task management system with user authentication, CRUD operations, and a clean dashboard UI.',
        tech: ['Node.js', 'Express', 'MongoDB'],
        link: '#',
    },
    {
        id: 4,
        emoji: '🧠',
        title: 'ML Predictor',
        description: 'A machine learning model pipeline for predictive analytics, built and trained with real-world datasets.',
        tech: ['Python', 'Scikit-learn', 'Pandas'],
        link: '#',
    },
];

function Projects() {
    const [filter, setFilter] = useState('All');

    const techFilters = ['All', 'React', 'Python', 'Node.js'];

    const filtered = filter === 'All'
        ? projectList
        : projectList.filter(p => p.tech.some(t => t.startsWith(filter)));

    return (
        <main className="main-content">
            <section className="section-container projects-section">
                <div className="section-header">
                    <span className="section-subtitle">What I've built</span>
                    <h2 className="section-title">My Projects</h2>
                    <div className="section-divider"></div>
                </div>

                {/* useState #1 — filter toggle for project categories */}
                <div className="projects-filter-bar">
                    {techFilters.map(f => (
                        <button
                            key={f}
                            type="button"
                            className={`filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div className="projects-grid">
                    {filtered.map(project => (
                        <div key={project.id} className="project-card">
                            <div className="project-card-top">
                                <span className="project-emoji">{project.emoji}</span>
                                <h3 className="project-title">{project.title}</h3>
                            </div>
                            <p className="project-description">{project.description}</p>
                            <div className="project-tech-tags">
                                {project.tech.map(t => (
                                    <span key={t} className="tech-tag">{t}</span>
                                ))}
                            </div>
                            <a
                                href={project.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="project-link-btn"
                            >
                                View Project →
                            </a>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}

export default Projects;
