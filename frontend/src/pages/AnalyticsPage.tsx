import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from "react-simple-maps";
import Navbar from '../components/Navbar';
import { useMode } from '../context/ModeContext';
import './AnalyticsPage.css';

/* ── Animated counter ── */
function useCountUp(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number | null = null;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setValue(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ── SVG Donut helper ── */
function DonutSegment({ cx, cy, r, pct, offset, color }: { cx: number; cy: number; r: number; pct: number; offset: number; color: string }) {
  const circ = 2 * Math.PI * r;
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill="none"
      stroke={color}
      strokeWidth="20"
      strokeDasharray={`${(pct / 100) * circ} ${circ}`}
      strokeDashoffset={-(offset / 100) * circ}
      strokeLinecap="round"
      style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.16,1,0.3,1)' }}
    />
  );
}

/* ── Data ── */
const PREVALENCE_DATA = [
  { region: 'South Asia (India)', value: 4.1, color: 'emerald', patients: '1.2M+' },
  { region: 'North America (US)', value: 5.2, color: 'purple', patients: '350K' },
  { region: 'Europe', value: 4.8, color: 'cyan', patients: '450K' },
  { region: 'East Asia', value: 3.2, color: 'ruby', patients: '200K' },
  { region: 'Russia & Eurasia', value: 3.5, color: 'amber', patients: '150K' },
  { region: 'Africa', value: 1.2, color: 'rose', patients: '100K' },
];

const MOTOR_DISABILITY_DATA = [
  { name: 'ALS / MND', pct: 18, color: '#00d4ff' },
  { name: 'Multiple Sclerosis', pct: 24, color: '#a855f7' },
  { name: 'Cerebral Palsy', pct: 22, color: '#10b981' },
  { name: 'Spinal Cord Injury', pct: 20, color: '#f43f5e' },
  { name: 'Muscular Dystrophy', pct: 16, color: '#f59e0b' },
];

const AGE_DATA = [
  { range: '20-34', pct: 8 },
  { range: '35-44', pct: 12 },
  { range: '45-54', pct: 18 },
  { range: '55-64', pct: 28 },
  { range: '65-74', pct: 24 },
  { range: '75+', pct: 10 },
];

const TIMELINE = [
  { year: '1869', text: 'Jean-Martin Charcot first describes ALS as a distinct neurological disorder.' },
  { year: '1939', text: 'Lou Gehrig\'s farewell speech brings ALS to public awareness.' },
  { year: '1993', text: 'SOD1 gene mutation identified as first genetic cause of familial ALS.' },
  { year: '2006', text: 'TDP-43 protein discovered as key pathological marker in 97% of ALS cases.' },
  { year: '2014', text: 'Ice Bucket Challenge raises $115M+ for ALS research, boosting global awareness.' },
  { year: '2022', text: 'FDA approves Relyvrio, first new ALS treatment in years.' },
  { year: '2025', text: 'AI-powered clinical tools make communication accessible to all.' },
];

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/* ── World Map Data (Realistic ISO Numeric Mapping) ── */
const MAP_DATA: Record<string, { prevalence: number, deaths: string, color: string }> = {
  "356": { prevalence: 4.1, deaths: "≈100,000/yr", color: "#10b981" }, // India
  "840": { prevalence: 5.2, deaths: "≈35,000/yr", color: "#a855f7" }, // US
  "124": { prevalence: 5.2, deaths: "≈3,000/yr", color: "#a855f7" }, // Canada
  "826": { prevalence: 4.8, deaths: "≈5,000/yr", color: "#00d4ff" }, // UK
  "250": { prevalence: 4.8, deaths: "≈4,500/yr", color: "#00d4ff" }, // France
  "276": { prevalence: 4.8, deaths: "≈6,000/yr", color: "#00d4ff" }, // Germany
  "156": { prevalence: 3.2, deaths: "≈18,000/yr", color: "#f43f5e" }, // China
  "392": { prevalence: 3.2, deaths: "≈4,000/yr", color: "#f43f5e" }, // Japan
  "643": { prevalence: 3.5, deaths: "≈18,000/yr", color: "#f59e0b" }, // Russia
  "710": { prevalence: 1.2, deaths: "≈1,000/yr", color: "#ec4899" }, // South Africa
  "818": { prevalence: 1.2, deaths: "≈800/yr", color: "#ec4899" }, // Egypt
  "566": { prevalence: 1.2, deaths: "≈1,200/yr", color: "#ec4899" }, // Nigeria
  "076": { prevalence: 2.1, deaths: "≈8,000/yr", color: "#06b6d4" }, // Brazil
  "032": { prevalence: 2.1, deaths: "≈2,000/yr", color: "#06b6d4" }, // Argentina
  "036": { prevalence: 2.8, deaths: "≈3,000/yr", color: "#8b5cf6" }, // Australia
};

export default function AnalyticsPage() {
  const [visible, setVisible] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const { mode, gazePos } = useMode();
  const triggerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Gaze Interaction for Map
  useEffect(() => {
    if (mode === 'gaze') {
      const x = gazePos.x;
      const y = gazePos.y;
      setTooltipPos({ x, y });
      
      const elements = document.elementsFromPoint(x, y);
      const regionEl = elements.find(el => el.classList.contains('map-region')) as HTMLElement | undefined;
      
      if (regionEl) {
        const id = regionEl.getAttribute('data-id');
        if (id) {
          const data = MAP_DATA[id];
          if (data) {
            setHoveredRegion({ ...data, geoId: id, label: "Selected Region" });
          }
        }
      } else {
        setHoveredRegion(null);
      }
    }
  }, [gazePos, mode]);

  useEffect(() => {
    // Reveal and Stats Observers
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    els.forEach(el => obs.observe(el));

    const statObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (triggerRef.current) statObs.observe(triggerRef.current);

    const barObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setBarVisible(true); },
      { threshold: 0.2 }
    );
    if (barRef.current) barObs.observe(barRef.current);

    return () => { obs.disconnect(); statObs.disconnect(); barObs.disconnect(); };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const c1 = useCountUp(450000, 2500, visible);
  const c2 = useCountUp(125000, 2000, visible);
  const c3 = useCountUp(3, 1800, visible);

  const maxPrevalence = Math.max(...PREVALENCE_DATA.map(d => d.value));

  // Build donut segments
  let donutOffset = 0;
  const donutSegments = MOTOR_DISABILITY_DATA.map(d => {
    const segment = { ...d, offset: donutOffset };
    donutOffset += d.pct;
    return segment;
  });

  return (
    <div className="analytics-page">
      <Navbar />

      {/* Hero Section */}
      <section className="analytics-hero">
        <h1>ALS & Motor Disability <span className="text-gradient">Analytics</span></h1>
        <p>
          Real-world data on Amyotrophic Lateral Sclerosis, motor neuron disease, and
          related conditions. Understanding the numbers behind the people who need
          assistive technology the most.
        </p>
        <div className="analytics-hero-img">
          <img src="/analytics-header.png" alt="Data visualization concept" />
        </div>
      </section>

      {/* Stats Section */}
      <div className="stats-row" ref={triggerRef}>
        <div className="stat-card reveal">
          <span className="stat-card-icon">🌍</span>
          <div className="stat-card-number cyan">{c1.toLocaleString()}</div>
          <div className="stat-card-label">People Living with ALS Worldwide</div>
        </div>
        <div className="stat-card reveal reveal-delay-1 highlight-india">
          <span className="stat-card-icon">🇮🇳</span>
          <div className="stat-card-number emerald">{(c2).toLocaleString()}</div>
          <div className="stat-card-label">Estimated Annual New Cases (India)</div>
        </div>
        <div className="stat-card reveal reveal-delay-2">
          <span className="stat-card-icon">⏱️</span>
          <div className="stat-card-number purple">{c3}-{c3+2}</div>
          <div className="stat-card-label">Year Avg. Survival (Global Trend)</div>
        </div>
      </div>

      {/* World Map Section */}
      <section className="map-section reveal">
        <div className="section-head">
          <h2>Global Prevalence <span className="text-gradient">Heatmap</span></h2>
          <p>Interactive distribution of ALS and MND cases across major neuro-clusters.</p>
        </div>

        <div className="map-container" onMouseMove={handleMouseMove}>
          <ComposableMap
            projectionConfig={{ scale: 145 }}
            width={800}
            height={400}
            style={{ width: "100%", height: "auto" }}
          >
            <Sphere stroke="#E4E5E6" strokeWidth={0.5} id="sphere" fill="transparent" />
            <Graticule stroke="#E4E5E6" strokeWidth={0.5} />
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const geoId = geo.id || geo.properties?.id;
                  const data = MAP_DATA[geoId];
                  const isIndia = geoId === "356";
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      data-id={geoId}
                      className={`map-region ${hoveredRegion?.geoId === geoId ? 'active' : ''} ${isIndia ? 'india-focus' : ''}`}
                      onMouseEnter={() => {
                        if (mode !== 'gaze' && data) {
                          setHoveredRegion({ ...data, label: geo.properties.name, geoId });
                        }
                      }}
                      onMouseLeave={() => {
                        if (mode !== 'gaze') setHoveredRegion(null);
                      }}
                      style={{
                        default: {
                          fill: data ? data.color : "#1f2937",
                          outline: "none",
                          transition: "all 250ms",
                        },
                        hover: {
                          fill: data ? data.color : "#374151",
                          outline: "none",
                          cursor: data ? "pointer" : "default",
                          filter: "brightness(1.2) drop-shadow(0 0 5px rgba(255,255,255,0.2))",
                        },
                        pressed: {
                          fill: "#E42",
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {hoveredRegion && (
            <div 
              className="map-tooltip glass-panel"
              style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15 }}
            >
              <div className="tooltip-header">
                <span className="tooltip-flag">{hoveredRegion.label === 'India' ? '🇮🇳' : '🌍'}</span>
                <strong>{hoveredRegion.label}</strong>
              </div>
              <div className="tooltip-body">
                <div className="tooltip-row">
                  <span>Prevalence:</span>
                  <span className="value">{hoveredRegion.prevalence} per 100k</span>
                </div>
                <div className="tooltip-row">
                  <span>Annual Mortality:</span>
                  <span className="value">{hoveredRegion.deaths}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ DASHBOARD ═══ */}
      <div className="dashboard-grid">

        {/* Motor Disability Donut */}
        <div className="dashboard-card reveal">
          <h3>Motor Disability Breakdown</h3>
          <p className="card-desc">Distribution of major motor disabilities requiring assistive tech</p>
          <div className="chart-container">
            <div className="donut-chart">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="70" className="donut-bg" />
                {donutSegments.map(d => (
                  <DonutSegment key={d.name} cx={100} cy={100} r={70} pct={d.pct} offset={d.offset} color={d.color} />
                ))}
              </svg>
              <div className="donut-center">
                <div className="donut-center-value">5M+</div>
                <div className="donut-center-label">Affected</div>
              </div>
            </div>
            <div className="chart-legend">
              {MOTOR_DISABILITY_DATA.map(d => (
                <div key={d.name} className="legend-item">
                  <div className="legend-dot" style={{ background: d.color }}></div>
                  <span className="legend-label">{d.name}</span>
                  <span className="legend-value">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ALS Prevalence by Region */}
        <div className="dashboard-card reveal reveal-delay-1" ref={barRef}>
          <h3>ALS Prevalence by Region</h3>
          <p className="card-desc">Cases per 100,000 people (age-adjusted, WHO 2024)</p>
          <div className="bar-chart">
            {PREVALENCE_DATA.map(d => (
              <div key={d.region} className="bar-row">
                <span className="bar-label">{d.region}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${d.color}`}
                    style={{ width: barVisible ? `${(d.value / maxPrevalence) * 100}%` : '0%' }}
                  >
                    {d.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Age Distribution */}
        <div className="dashboard-card reveal">
          <h3>ALS Age Distribution at Diagnosis</h3>
          <p className="card-desc">Peak onset occurs between 55-74 years old</p>
          <div className="bar-chart">
            {AGE_DATA.map((d, i) => {
              const colors = ['cyan', 'cyan', 'purple', 'emerald', 'emerald', 'amber'];
              return (
                <div key={d.range} className="bar-row">
                  <span className="bar-label">{d.range} yrs</span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${colors[i]}`}
                      style={{ width: barVisible ? `${(d.pct / 28) * 100}%` : '0%' }}
                    >
                      {d.pct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="dashboard-card reveal reveal-delay-1">
          <h3>ALS Research Milestones</h3>
          <p className="card-desc">Key moments in the fight against motor neuron disease</p>
          <div className="timeline">
            {TIMELINE.map(t => (
              <div key={t.year} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-year">{t.year}</div>
                <div className="timeline-text">{t.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="dashboard-card full-width reveal" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.8rem' }}>
            Help Bridge the Communication Gap
          </h3>
          <p className="card-desc" style={{ maxWidth: '600px', margin: '0 auto 1.5rem' }}>
            Every person deserves a voice. Try EyeType and experience how eye-tracking
            technology can transform communication for people with motor disabilities.
          </p>
          <Link to="/app" className="btn-primary" style={{ display: 'inline-flex' }}>
            Launch EyeType →
          </Link>
        </div>
      </div>

      {/* ═══ SOURCES ═══ */}
      <div className="sources-section reveal">
        <h3>📚 Data Sources & References</h3>
        <div className="sources-grid">
          <a href="https://www.who.int/news-room/fact-sheets/detail/amyotrophic-lateral-sclerosis" target="_blank" rel="noopener noreferrer" className="source-tag">World Health Organization (WHO)</a>
          <a href="https://www.cdc.gov/als/index.html" target="_blank" rel="noopener noreferrer" className="source-tag">CDC — Centers for Disease Control</a>
          <a href="https://www.als.org/" target="_blank" rel="noopener noreferrer" className="source-tag">ALS Association</a>
          <a href="https://www.nih.gov/" target="_blank" rel="noopener noreferrer" className="source-tag">National Institutes of Health (NIH)</a>
          <a href="https://www.thelancet.com/journals/laneur/home" target="_blank" rel="noopener noreferrer" className="source-tag">The Lancet Neurology (2024)</a>
          <a href="https://www.nature.com/nrn/" target="_blank" rel="noopener noreferrer" className="source-tag">Nature Reviews Neuroscience</a>
          <a href="https://www.encals.eu/" target="_blank" rel="noopener noreferrer" className="source-tag">European ALS Registry (EuroMND)</a>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand"><span>👁</span> EyeType</div>
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
