import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { mode, toggleMode } = useMode();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="nav-brand">
        <div className="nav-brand-icon">👁</div>
        <span className="nav-brand-text">EyeType</span>
      </Link>

      <button
        className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
        <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
        <li><Link to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>Analytics</Link></li>
        
        {/* Interaction Mode Toggle */}
        <li className="nav-mode-toggle">
          <span className={`mode-label ${mode === 'standard' ? 'active' : ''}`}>Manual</span>
          <button 
            className={`mode-switch ${mode}`} 
            onClick={toggleMode}
            title={`Switch to ${mode === 'standard' ? 'Gaze' : 'Manual'} Mode`}
          >
            <div className="mode-switch-handle">
              {mode === 'gaze' ? '👁' : '✋'}
            </div>
          </button>
          <span className={`mode-label ${mode === 'gaze' ? 'active' : ''}`}>Sensor</span>
        </li>

        <li><Link to="/app" className="nav-cta">Try Keyboard →</Link></li>
      </ul>
    </nav>
  );
}
