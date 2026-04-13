import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './HomePage.css';

/* ── Animated counter hook ── */
function useCountUp(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

export default function HomePage() {
  const [impactVisible, setImpactVisible] = useState(false);
  const impactRef = useRef<HTMLDivElement>(null);

  // Scroll reveal observer
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.15 }
    );
    els.forEach(el => observer.observe(el));

    // Impact section observer (for counters)
    const impactObs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setImpactVisible(true); },
      { threshold: 0.3 }
    );
    if (impactRef.current) impactObs.observe(impactRef.current);

    return () => { observer.disconnect(); impactObs.disconnect(); };
  }, []);

  const count1 = useCountUp(450000, 2500, impactVisible);
  const count2 = useCountUp(30000, 2000, impactVisible);
  const count3 = useCountUp(90, 1500, impactVisible);
  const count4 = useCountUp(5, 1500, impactVisible);

  return (
    <div className="home-page">
      <Navbar />

      {/* ════════════ HERO ════════════ */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="pulse-dot"></span>
              Open Source &amp; Free Forever
            </div>
            <h1>
              Type with Your<br />
              <span className="highlight">Eyes</span>, Not Hands
            </h1>
            <p className="hero-description">
              EyeType is a gaze-powered keyboard built for people with ALS, motor neuron disease,
              and limited mobility. Using just your eyes and a camera, communicate freely — no
              special hardware required.
            </p>
            <div className="hero-actions">
              <Link to="/app" className="btn-primary">
                Launch EyeType →
              </Link>
              <Link to="/analytics" className="btn-secondary">
                📊 View ALS Analytics
              </Link>
            </div>
            <div className="hero-stats-row">
              <div className="hero-stat">
                <div className="hero-stat-value">450K+</div>
                <span>People Living with ALS</span>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">100%</div>
                <span>Browser-Based</span>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">0$</div>
                <span>Cost to Use</span>
              </div>
            </div>
          </div>
          <div className="hero-image">
            <img src="/hero.png" alt="EyeType gaze tracking visualization" />
          </div>
        </div>
      </section>

      {/* ════════════ FEATURES ════════════ */}
      <section className="features-section">
        <h2 className="section-title reveal">
          Powerful <span className="text-gradient">Features</span>
        </h2>
        <p className="section-subtitle reveal reveal-delay-1">
          Built with cutting-edge AI and designed for accessibility. Every feature
          serves one mission — giving voice to those who need it most.
        </p>
        <div className="features-grid">
          <div className="feature-card reveal reveal-delay-1">
            <div className="feature-icon">👁️</div>
            <h3>Precision Gaze Tracking</h3>
            <p>MediaPipe's 478-point face mesh tracks your iris position in real-time, mapping subtle eye movements to keyboard keys with sub-pixel accuracy.</p>
          </div>
          <div className="feature-card reveal reveal-delay-2">
            <div className="feature-icon">📡</div>
            <h3>Morse Code Mode</h3>
            <p>Blink-based Morse code input for severe mobility limitations. Short blink = dot, long blink = dash. Tilt your phone to type without touching.</p>
          </div>
          <div className="feature-card reveal reveal-delay-3">
            <div className="feature-icon">🧠</div>
            <h3>AI Text Prediction</h3>
            <p>Self-learning N-Gram engine adapts to your vocabulary. The more you type, the smarter predictions become — reducing keystrokes by up to 70%.</p>
          </div>
          <div className="feature-card reveal reveal-delay-4">
            <div className="feature-icon">🔊</div>
            <h3>Voice Output</h3>
            <p>Built-in text-to-speech reads every typed letter and word aloud, turning your screen into a powerful communication device for non-verbal users.</p>
          </div>
        </div>
      </section>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section className="how-section">
        <h2 className="section-title reveal">
          How It <span className="text-gradient">Works</span>
        </h2>
        <p className="section-subtitle reveal reveal-delay-1">
          Three simple steps. No downloads, no installations, no special equipment.
        </p>
        <div className="how-grid">
          <div className="how-step reveal reveal-delay-1">
            <span className="how-step-icon">📷</span>
            <div className="how-step-number">1</div>
            <h3>Allow Camera</h3>
            <p>Grant camera access so our AI can see your face. All processing happens locally in your browser — nothing is sent to any server.</p>
          </div>
          <div className="how-step reveal reveal-delay-2">
            <span className="how-step-icon">🎯</span>
            <div className="how-step-number">2</div>
            <h3>Calibrate</h3>
            <p>Look at the camera for 3 seconds while our system learns your baseline gaze position. This ensures accurate tracking for your unique face.</p>
          </div>
          <div className="how-step reveal reveal-delay-3">
            <span className="how-step-icon">⌨️</span>
            <div className="how-step-number">3</div>
            <h3>Start Typing</h3>
            <p>Move your eyes to hover over keys. Dwell for 2.5 seconds or blink to type. Use AI predictions to speed up your communication dramatically.</p>
          </div>
        </div>
      </section>

      {/* ════════════ IMPACT STATS ════════════ */}
      <section className="impact-section" ref={impactRef}>
        <h2 className="section-title reveal">
          Why This <span className="text-gradient">Matters</span>
        </h2>
        <p className="section-subtitle reveal reveal-delay-1">
          Motor neuron diseases affect millions worldwide. Assistive technology
          like EyeType bridges the communication gap.
        </p>
        <div className="impact-grid">
          <div className="impact-card reveal reveal-delay-1">
            <div className="impact-number">{count1.toLocaleString()}</div>
            <div className="impact-label">People Living with ALS Worldwide</div>
          </div>
          <div className="impact-card reveal reveal-delay-2">
            <div className="impact-number">{count2.toLocaleString()}</div>
            <div className="impact-label">New ALS Diagnoses Per Year (US)</div>
          </div>
          <div className="impact-card reveal reveal-delay-3">
            <div className="impact-number">{count3}%</div>
            <div className="impact-label">of ALS Cases are Sporadic (No Family History)</div>
          </div>
          <div className="impact-card reveal reveal-delay-4">
            <div className="impact-number">{count4}M+</div>
            <div className="impact-label">People with Motor Disabilities Globally</div>
          </div>
        </div>
      </section>

      {/* ════════════ ABOUT ════════════ */}
      <section className="about-section">
        <div className="about-content">
          <div className="about-text reveal">
            <h2>Our <span className="text-gradient">Mission</span></h2>
            <p>
              EyeType was born from a simple belief: everyone deserves a voice. For people with
              ALS, spinal cord injuries, locked-in syndrome, or any condition that limits physical
              movement, traditional keyboards are inaccessible.
            </p>
            <p>
              We built EyeType to run entirely in the browser — no expensive hardware, no
              specialized software. Just open a webpage and start communicating.
            </p>
            <ul className="about-features">
              <li><span className="check">✓</span> 100% browser-based, works on any device</li>
              <li><span className="check">✓</span> Privacy-first: all processing stays on your device</li>
              <li><span className="check">✓</span> Works on Android phones and laptops</li>
              <li><span className="check">✓</span> Free and open source forever</li>
              <li><span className="check">✓</span> Built with Google's MediaPipe AI</li>
            </ul>
          </div>
          <div className="about-image reveal reveal-delay-2">
            <img src="/logo.png" alt="EyeType logo" />
          </div>
        </div>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>👁</span> EyeType
          </div>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/app">Try EyeType</Link></li>
            <li><Link to="/analytics">Analytics</Link></li>
          </ul>
          <p className="footer-copy">
            © {new Date().getFullYear()} EyeType — Gaze-Powered Assistive Technology. Built with ❤️ for accessibility.
          </p>
        </div>
      </footer>
    </div>
  );
}
