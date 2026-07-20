function Skills({ skillList }) {
    return (
        <section id="skills" className="section-container skills-section">
            <div className="section-header">
                <span className="section-subtitle">What I work with</span>
                <h2 className="section-title">My Skills</h2>
                <div className="section-divider"></div>
            </div>

            <div className="skills-card">
                <ul className="skills-grid">
                    {skillList.map((skill, index) => (
                        <li key={skill || index} className="skill-chip">
                            <span className="skill-dot"></span>
                            {skill}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export default Skills;
