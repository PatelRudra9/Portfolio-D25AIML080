import Header from './Header';
import About from './About';
import Skills from './Skills';

function Home({ name, title, themeColor, skills }) {
    return (
        <main className="main-content">
            <Header name={name} title={title} themeColor={themeColor} />
            <About />
            <Skills skillList={skills} />
        </main>
    );
}

export default Home;
