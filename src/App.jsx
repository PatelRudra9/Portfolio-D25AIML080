import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import NavBar from './components/NavBar';
import Home from './components/Home';
import Projects from './components/Projects';
import Contact from './components/Contact';
import NotFound from './components/NotFound';
import Footer from './components/Footer';

function App() {
  const [userName] = useState("Rudra Patel");
  const [userTitle] = useState("Aspiring AI & ML Engineer");

  // Theme Color Prop for Header
  const [themeColor, setThemeColor] = useState('#a855f7');

  // Dark/Light Theme Switching — useState used meaningfully via NavBar toggle
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

  // Skill array passed as prop to Home → Skills component
  const [skills] = useState([
    "🐍 Python",
    "🤖 Artificial Intelligence",
    "🧠 Machine Learning",
    "⚛️ React.js",
    "🌐 HTML5 & CSS3",
    "🟨 JavaScript (ES6+)",
    "🟩 Node.js & Express",
    "🍃 MongoDB",
    "🔧 Git & GitHub",
    "🎨 Tailwind CSS",
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
      {/* Accent color picker bar */}
      <div className="settings-bar">
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

      {/* Sticky NavBar with theme toggle and route links */}
      <NavBar isLightMode={isLightMode} onToggleTheme={() => setIsLightMode(prev => !prev)} />

      {/* Client-side Routes — no full page reload */}
      <Routes>
        <Route
          path="/"
          element={
            <Home
              name={userName}
              title={userTitle}
              themeColor={themeColor}
              skills={skills}
            />
          }
        />
        <Route path="/projects" element={<Projects />} />
        <Route path="/contact" element={<Contact />} />
        {/* 404 catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
