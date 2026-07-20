import { useState, useEffect } from 'react';
import Header from './components/Header';
import About from './components/About';
import Skills from './components/Skills';
import Footer from './components/Footer';

function App() {
  const [userName] = useState("Rudra Patel");
  const [userTitle] = useState("Aspiring AI & ML Engineer");

  // Theme Color Prop for Header (State to demonstrate React reactivity when props change)
  const [themeColor, setThemeColor] = useState('#a855f7');

  // Dark/Light Theme Switching
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isLightMode) {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [isLightMode]);

  // Handle changing rgb value matching hex for gradient accents
  useEffect(() => {
    const root = document.documentElement;
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '168, 85, 247';
    };
    root.style.setProperty('--accent-rgb', hexToRgb(themeColor));
    root.style.setProperty('--accent-color', themeColor);
  }, [themeColor]);

  // Skill array passed as prop to Skills component
  const [skills] = useState([
    "React.js",
    "Python",
    "Machine Learning",
    "JavaScript (ES6+)",
    "Vite",
    "HTML5 & CSS3",
    "Node.js & Express",
    "Git & GitHub Workflow",
    "Tailwind CSS"
  ]);


  const colorThemes = [
    { name: 'Purple', value: '#a855f7' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
  ];

  return (
    <>
      {/* Control Panel / Theme Settings (Dynamic Props demonstration) */}
      <div className="settings-bar">
        <button
          type="button"
          className="settings-btn"
          onClick={() => setIsLightMode(!isLightMode)}
        >
          {isLightMode ? '🌙 Switch to Dark Theme' : '☀️ Switch to Light Theme'}
        </button>

        <div className="color-picker-container">
          <span style={{ fontSize: '14px', fontWeight: '500', opacity: 0.85 }}>Accent Theme:</span>
          {colorThemes.map((theme) => (
            <button
              key={theme.name}
              type="button"
              className={`color-option ${themeColor === theme.value ? 'active' : ''}`}
              style={{ backgroundColor: theme.value }}
              onClick={() => setThemeColor(theme.value)}
              title={`${theme.name} Theme`}
              aria-label={`Select ${theme.name} theme`}
            />
          ))}
        </div>
      </div>

      <main className="main-content">
        {/* Passer name, title, and themeColor custom highlights as props */}
        <Header name={userName} title={userTitle} themeColor={themeColor} />

        <About />

        {/* Pass array of skills as a prop */}
        <Skills skillList={skills} />
      </main>

      <Footer />
    </>
  );
}

export default App;
