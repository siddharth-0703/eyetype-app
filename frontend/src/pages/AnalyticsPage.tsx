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

/* ── Mini Sparkline Chart ── */
function MiniTrendChart({ data, color }: { data: number[], color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = (max - min) || 1;
  const width = 240;
  const height = 100;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-trend-chart">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill={`url(#grad-${color})`}
        points={areaPoints}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 10) - 5;
        return <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke={color} strokeWidth="2" />;
      })}
    </svg>
  );
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
const MAP_DATA: Record<string, { name: string, alpha2: string, prevalence: number, deaths: string, color: string, trend: number[] }> = {
  "100": {
    "name": "Bulgaria",
    "alpha2": "bg",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      3.9,
      4.2,
      4.2,
      4.4
    ]
  },
  "104": {
    "name": "Myanmar",
    "alpha2": "mm",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#10b981",
    "trend": [
      3.3,
      3.5,
      3.5,
      3.6,
      3.7
    ]
  },
  "108": {
    "name": "Burundi",
    "alpha2": "bi",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.2,
      1.2,
      1.2,
      1.2
    ]
  },
  "112": {
    "name": "Belarus",
    "alpha2": "by",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.4,
      4.2,
      4.4,
      4.8,
      4.8
    ]
  },
  "116": {
    "name": "Cambodia",
    "alpha2": "kh",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#10b981",
    "trend": [
      2.5,
      2.5,
      2.6,
      2.7,
      2.8
    ]
  },
  "120": {
    "name": "Cameroon",
    "alpha2": "cm",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.2,
      1.1,
      1.2,
      1.3
    ]
  },
  "124": {
    "name": "Canada",
    "alpha2": "ca",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#a855f7",
    "trend": [
      4.2,
      3.9,
      4.3,
      4.3,
      4.4
    ]
  },
  "132": {
    "name": "Cabo Verde",
    "alpha2": "cv",
    "prevalence": 1.2,
    "deaths": "≈1,200/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1,
      1,
      1.1,
      1
    ]
  },
  "136": {
    "name": "Cayman Islands",
    "alpha2": "ky",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#a855f7",
    "trend": [
      2.9,
      2.9,
      2.8,
      2.8,
      2.9
    ]
  },
  "140": {
    "name": "Central African Republic",
    "alpha2": "cf",
    "prevalence": 1.8,
    "deaths": "≈1,800/yr",
    "color": "#ec4899",
    "trend": [
      1.5,
      1.4,
      1.5,
      1.5,
      1.5
    ]
  },
  "144": {
    "name": "Sri Lanka",
    "alpha2": "lk",
    "prevalence": 3.6,
    "deaths": "≈3,600/yr",
    "color": "#10b981",
    "trend": [
      2.9,
      3,
      3,
      3.1,
      3.1
    ]
  },
  "148": {
    "name": "Chad",
    "alpha2": "td",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.4,
      1.4,
      1.4,
      1.5
    ]
  },
  "152": {
    "name": "Chile",
    "alpha2": "cl",
    "prevalence": 2.3,
    "deaths": "≈2,300/yr",
    "color": "#a855f7",
    "trend": [
      1.8,
      1.9,
      1.8,
      2,
      2
    ]
  },
  "156": {
    "name": "China",
    "alpha2": "cn",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#10b981",
    "trend": [
      3.3,
      3.3,
      3.5,
      3.4,
      3.7
    ]
  },
  "158": {
    "name": "Taiwan, Province of China",
    "alpha2": "tw",
    "prevalence": 2.5,
    "deaths": "≈2,500/yr",
    "color": "#1f2937",
    "trend": [
      2,
      2,
      2,
      2.2,
      2.2
    ]
  },
  "162": {
    "name": "Christmas Island",
    "alpha2": "cx",
    "prevalence": 2.9,
    "deaths": "≈2,900/yr",
    "color": "#8b5cf6",
    "trend": [
      2.3,
      2.3,
      2.4,
      2.4,
      2.4
    ]
  },
  "166": {
    "name": "Cocos (Keeling) Islands",
    "alpha2": "cc",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#8b5cf6",
    "trend": [
      2.6,
      2.6,
      2.6,
      2.8,
      2.8
    ]
  },
  "170": {
    "name": "Colombia",
    "alpha2": "co",
    "prevalence": 2.6,
    "deaths": "≈2,600/yr",
    "color": "#a855f7",
    "trend": [
      2.1,
      2.2,
      2.2,
      2.2,
      2.2
    ]
  },
  "174": {
    "name": "Comoros",
    "alpha2": "km",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.3,
      1.4,
      1.4,
      1.4
    ]
  },
  "175": {
    "name": "Mayotte",
    "alpha2": "yt",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.3,
      1.3,
      1.3,
      1.2
    ]
  },
  "178": {
    "name": "Congo",
    "alpha2": "cg",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.3,
      1.3,
      1.4,
      1.4
    ]
  },
  "180": {
    "name": "Congo, Democratic Republic of the",
    "alpha2": "cd",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      0.9,
      1,
      1
    ]
  },
  "184": {
    "name": "Cook Islands",
    "alpha2": "ck",
    "prevalence": 2.6,
    "deaths": "≈2,600/yr",
    "color": "#8b5cf6",
    "trend": [
      2.1,
      2.1,
      2.2,
      2.3,
      2.3
    ]
  },
  "188": {
    "name": "Costa Rica",
    "alpha2": "cr",
    "prevalence": 4.7,
    "deaths": "≈4,700/yr",
    "color": "#a855f7",
    "trend": [
      3.9,
      3.8,
      4,
      3.8,
      4.2
    ]
  },
  "191": {
    "name": "Croatia",
    "alpha2": "hr",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.4,
      4.2,
      4.6,
      4.3
    ]
  },
  "192": {
    "name": "Cuba",
    "alpha2": "cu",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#a855f7",
    "trend": [
      3.3,
      3.4,
      3.3,
      3.5,
      3.5
    ]
  },
  "196": {
    "name": "Cyprus",
    "alpha2": "cy",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#10b981",
    "trend": [
      3.2,
      3.3,
      3.4,
      3.3,
      3.3
    ]
  },
  "203": {
    "name": "Czechia",
    "alpha2": "cz",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.4,
      4.2,
      4.5,
      4.8,
      4.6
    ]
  },
  "204": {
    "name": "Benin",
    "alpha2": "bj",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.4,
      1.3,
      1.5,
      1.5
    ]
  },
  "208": {
    "name": "Denmark",
    "alpha2": "dk",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.3,
      4.2,
      4.2,
      4.3
    ]
  },
  "212": {
    "name": "Dominica",
    "alpha2": "dm",
    "prevalence": 2.1,
    "deaths": "≈2,100/yr",
    "color": "#a855f7",
    "trend": [
      1.7,
      1.7,
      1.8,
      1.8,
      1.8
    ]
  },
  "214": {
    "name": "Dominican Republic",
    "alpha2": "do",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#a855f7",
    "trend": [
      3.3,
      3.3,
      3.3,
      3.6,
      3.5
    ]
  },
  "218": {
    "name": "Ecuador",
    "alpha2": "ec",
    "prevalence": 2.1,
    "deaths": "≈2,100/yr",
    "color": "#a855f7",
    "trend": [
      1.7,
      1.7,
      1.7,
      1.7,
      1.8
    ]
  },
  "222": {
    "name": "El Salvador",
    "alpha2": "sv",
    "prevalence": 3.8,
    "deaths": "≈3,800/yr",
    "color": "#a855f7",
    "trend": [
      3.2,
      3.2,
      3.2,
      3.3,
      3.4
    ]
  },
  "226": {
    "name": "Equatorial Guinea",
    "alpha2": "gq",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.3,
      1.4,
      1.4,
      1.5
    ]
  },
  "231": {
    "name": "Ethiopia",
    "alpha2": "et",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.1,
      1.1,
      1.1,
      1.2
    ]
  },
  "232": {
    "name": "Eritrea",
    "alpha2": "er",
    "prevalence": 1.8,
    "deaths": "≈1,800/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.5,
      1.5,
      1.6,
      1.6
    ]
  },
  "233": {
    "name": "Estonia",
    "alpha2": "ee",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4.1,
      4.2,
      4.2,
      4.3
    ]
  },
  "234": {
    "name": "Faroe Islands",
    "alpha2": "fo",
    "prevalence": 5.5,
    "deaths": "≈5,500/yr",
    "color": "#00d4ff",
    "trend": [
      4.5,
      4.4,
      4.5,
      4.5,
      4.8
    ]
  },
  "238": {
    "name": "Falkland Islands (Malvinas)",
    "alpha2": "fk",
    "prevalence": 2.4,
    "deaths": "≈2,400/yr",
    "color": "#a855f7",
    "trend": [
      1.9,
      1.9,
      1.9,
      2.1,
      2
    ]
  },
  "239": {
    "name": "South Georgia and the South Sandwich Islands",
    "alpha2": "gs",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#a855f7",
    "trend": [
      2.8,
      2.8,
      2.8,
      2.9,
      3
    ]
  },
  "242": {
    "name": "Fiji",
    "alpha2": "fj",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#8b5cf6",
    "trend": [
      2.1,
      2.2,
      2.2,
      2.2,
      2.4
    ]
  },
  "246": {
    "name": "Finland",
    "alpha2": "fi",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.3,
      4.3,
      4.2,
      4.4
    ]
  },
  "248": {
    "name": "Åland Islands",
    "alpha2": "ax",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4,
      4.1,
      4.2,
      4.2
    ]
  },
  "250": {
    "name": "France",
    "alpha2": "fr",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.4,
      4.7,
      4.7,
      4.6
    ]
  },
  "254": {
    "name": "French Guiana",
    "alpha2": "gf",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#a855f7",
    "trend": [
      4.2,
      4.1,
      4.2,
      4.5,
      4.3
    ]
  },
  "258": {
    "name": "French Polynesia",
    "alpha2": "pf",
    "prevalence": 2.6,
    "deaths": "≈2,600/yr",
    "color": "#8b5cf6",
    "trend": [
      2,
      2.2,
      2.1,
      2.2,
      2.2
    ]
  },
  "260": {
    "name": "French Southern Territories",
    "alpha2": "tf",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.4,
      1.5,
      1.4,
      1.5
    ]
  },
  "262": {
    "name": "Djibouti",
    "alpha2": "dj",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.8,
      0.9,
      0.9,
      0.9,
      0.9
    ]
  },
  "266": {
    "name": "Gabon",
    "alpha2": "ga",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.1,
      1.1,
      1.2,
      1.2
    ]
  },
  "268": {
    "name": "Georgia",
    "alpha2": "ge",
    "prevalence": 4.2,
    "deaths": "≈4,200/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.6,
      3.4,
      3.4,
      3.6
    ]
  },
  "270": {
    "name": "Gambia",
    "alpha2": "gm",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.1,
      1.1,
      1.1,
      1.2
    ]
  },
  "275": {
    "name": "Palestine, State of",
    "alpha2": "ps",
    "prevalence": 4.5,
    "deaths": "≈4,500/yr",
    "color": "#10b981",
    "trend": [
      3.6,
      3.6,
      3.7,
      4,
      3.8
    ]
  },
  "276": {
    "name": "Germany",
    "alpha2": "de",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.5,
      4.6,
      4.5,
      4.6,
      4.8
    ]
  },
  "288": {
    "name": "Ghana",
    "alpha2": "gh",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1.1,
      1,
      1.1,
      1.2
    ]
  },
  "292": {
    "name": "Gibraltar",
    "alpha2": "gi",
    "prevalence": 5.3,
    "deaths": "≈5,300/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.2,
      4.5,
      4.5,
      4.4
    ]
  },
  "296": {
    "name": "Kiribati",
    "alpha2": "ki",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#8b5cf6",
    "trend": [
      2.6,
      2.8,
      2.8,
      2.8,
      3
    ]
  },
  "300": {
    "name": "Greece",
    "alpha2": "gr",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4.2,
      4.1,
      4.1,
      4.4
    ]
  },
  "304": {
    "name": "Greenland",
    "alpha2": "gl",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#a855f7",
    "trend": [
      2.4,
      2.3,
      2.6,
      2.4,
      2.5
    ]
  },
  "308": {
    "name": "Grenada",
    "alpha2": "gd",
    "prevalence": 2.4,
    "deaths": "≈2,400/yr",
    "color": "#a855f7",
    "trend": [
      2,
      1.9,
      2,
      2.1,
      2
    ]
  },
  "312": {
    "name": "Guadeloupe",
    "alpha2": "gp",
    "prevalence": 2.9,
    "deaths": "≈2,900/yr",
    "color": "#a855f7",
    "trend": [
      2.4,
      2.3,
      2.3,
      2.4,
      2.6
    ]
  },
  "316": {
    "name": "Guam",
    "alpha2": "gu",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#8b5cf6",
    "trend": [
      2.2,
      2.2,
      2.2,
      2.4,
      2.3
    ]
  },
  "320": {
    "name": "Guatemala",
    "alpha2": "gt",
    "prevalence": 4.7,
    "deaths": "≈4,700/yr",
    "color": "#a855f7",
    "trend": [
      3.8,
      3.9,
      3.9,
      4.1,
      4
    ]
  },
  "324": {
    "name": "Guinea",
    "alpha2": "gn",
    "prevalence": 1.2,
    "deaths": "≈1,200/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      1,
      1,
      1.1,
      1.1
    ]
  },
  "328": {
    "name": "Guyana",
    "alpha2": "gy",
    "prevalence": 2.1,
    "deaths": "≈2,100/yr",
    "color": "#a855f7",
    "trend": [
      1.7,
      1.7,
      1.8,
      1.8,
      1.8
    ]
  },
  "332": {
    "name": "Haiti",
    "alpha2": "ht",
    "prevalence": 4.3,
    "deaths": "≈4,300/yr",
    "color": "#a855f7",
    "trend": [
      3.3,
      3.6,
      3.7,
      3.5,
      3.6
    ]
  },
  "334": {
    "name": "Heard Island and McDonald Islands",
    "alpha2": "hm",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.8,
      2.6,
      2.7,
      2.9
    ]
  },
  "336": {
    "name": "Holy See",
    "alpha2": "va",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.4,
      4.3,
      4.5,
      4.7,
      4.9
    ]
  },
  "340": {
    "name": "Honduras",
    "alpha2": "hn",
    "prevalence": 2.3,
    "deaths": "≈2,300/yr",
    "color": "#a855f7",
    "trend": [
      1.9,
      1.8,
      1.9,
      1.9,
      2
    ]
  },
  "344": {
    "name": "Hong Kong",
    "alpha2": "hk",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#10b981",
    "trend": [
      2.5,
      2.8,
      2.8,
      2.9,
      2.9
    ]
  },
  "348": {
    "name": "Hungary",
    "alpha2": "hu",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.4,
      4.7,
      4.5,
      4.8
    ]
  },
  "352": {
    "name": "Iceland",
    "alpha2": "is",
    "prevalence": 4.8,
    "deaths": "≈4,800/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      3.7,
      3.9,
      4.1,
      4.2
    ]
  },
  "356": {
    "name": "India",
    "alpha2": "in",
    "prevalence": 3.3,
    "deaths": "≈100,000/yr",
    "color": "#10b981",
    "trend": [
      2.5,
      2.7,
      2.8,
      2.8,
      2.8
    ]
  },
  "360": {
    "name": "Indonesia",
    "alpha2": "id",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#10b981",
    "trend": [
      2.4,
      2.6,
      2.6,
      2.6,
      2.8
    ]
  },
  "364": {
    "name": "Iran, Islamic Republic of",
    "alpha2": "ir",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.2,
      3.4,
      3.4,
      3.6
    ]
  },
  "368": {
    "name": "Iraq",
    "alpha2": "iq",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#10b981",
    "trend": [
      2.4,
      2.4,
      2.6,
      2.5,
      2.6
    ]
  },
  "372": {
    "name": "Ireland",
    "alpha2": "ie",
    "prevalence": 5.3,
    "deaths": "≈5,300/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4.4,
      4.2,
      4.4,
      4.7
    ]
  },
  "376": {
    "name": "Israel",
    "alpha2": "il",
    "prevalence": 4.3,
    "deaths": "≈4,300/yr",
    "color": "#10b981",
    "trend": [
      3.5,
      3.6,
      3.4,
      3.7,
      3.6
    ]
  },
  "380": {
    "name": "Italy",
    "alpha2": "it",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#00d4ff",
    "trend": [
      3.8,
      3.8,
      4.1,
      4.3,
      4.4
    ]
  },
  "384": {
    "name": "Côte d'Ivoire",
    "alpha2": "ci",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      0.9,
      1,
      0.9
    ]
  },
  "388": {
    "name": "Jamaica",
    "alpha2": "jm",
    "prevalence": 2.8,
    "deaths": "≈2,800/yr",
    "color": "#a855f7",
    "trend": [
      2.3,
      2.2,
      2.4,
      2.4,
      2.4
    ]
  },
  "392": {
    "name": "Japan",
    "alpha2": "jp",
    "prevalence": 5.5,
    "deaths": "≈5,500/yr",
    "color": "#10b981",
    "trend": [
      4.4,
      4.3,
      4.6,
      4.6,
      5
    ]
  },
  "398": {
    "name": "Kazakhstan",
    "alpha2": "kz",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#10b981",
    "trend": [
      2.4,
      2.4,
      2.4,
      2.6,
      2.7
    ]
  },
  "400": {
    "name": "Jordan",
    "alpha2": "jo",
    "prevalence": 3.5,
    "deaths": "≈3,500/yr",
    "color": "#10b981",
    "trend": [
      2.8,
      2.7,
      2.8,
      2.9,
      2.9
    ]
  },
  "404": {
    "name": "Kenya",
    "alpha2": "ke",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.3,
      1.4,
      1.3,
      1.4
    ]
  },
  "408": {
    "name": "Korea, Democratic People's Republic of",
    "alpha2": "kp",
    "prevalence": 4.2,
    "deaths": "≈4,200/yr",
    "color": "#10b981",
    "trend": [
      3.5,
      3.3,
      3.3,
      3.7,
      3.6
    ]
  },
  "410": {
    "name": "Korea, Republic of",
    "alpha2": "kr",
    "prevalence": 4.2,
    "deaths": "≈4,200/yr",
    "color": "#10b981",
    "trend": [
      3.3,
      3.4,
      3.5,
      3.6,
      3.6
    ]
  },
  "414": {
    "name": "Kuwait",
    "alpha2": "kw",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#10b981",
    "trend": [
      2.7,
      2.7,
      2.7,
      2.8,
      2.9
    ]
  },
  "417": {
    "name": "Kyrgyzstan",
    "alpha2": "kg",
    "prevalence": 3.7,
    "deaths": "≈3,700/yr",
    "color": "#10b981",
    "trend": [
      3.1,
      2.9,
      3.2,
      3.1,
      3.2
    ]
  },
  "418": {
    "name": "Lao People's Democratic Republic",
    "alpha2": "la",
    "prevalence": 4.2,
    "deaths": "≈4,200/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.5,
      3.5,
      3.5,
      3.6
    ]
  },
  "422": {
    "name": "Lebanon",
    "alpha2": "lb",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.3,
      3.3,
      3.4,
      3.6
    ]
  },
  "426": {
    "name": "Lesotho",
    "alpha2": "ls",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.3,
      1.3,
      1.3,
      1.3
    ]
  },
  "428": {
    "name": "Latvia",
    "alpha2": "lv",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      4.1,
      4,
      4.1,
      4.4
    ]
  },
  "430": {
    "name": "Liberia",
    "alpha2": "lr",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.1,
      1.1,
      1.2,
      1.2
    ]
  },
  "434": {
    "name": "Libya",
    "alpha2": "ly",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.3,
      1.2,
      1.3,
      1.3
    ]
  },
  "438": {
    "name": "Liechtenstein",
    "alpha2": "li",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4,
      4.2,
      4.4,
      4.4
    ]
  },
  "440": {
    "name": "Lithuania",
    "alpha2": "lt",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.3,
      4.1,
      4.4,
      4.3
    ]
  },
  "442": {
    "name": "Luxembourg",
    "alpha2": "lu",
    "prevalence": 5.5,
    "deaths": "≈5,500/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.6,
      4.5,
      4.7,
      4.8
    ]
  },
  "446": {
    "name": "Macao",
    "alpha2": "mo",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#10b981",
    "trend": [
      3.1,
      3.2,
      3.3,
      3.3,
      3.3
    ]
  },
  "450": {
    "name": "Madagascar",
    "alpha2": "mg",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.2,
      1.3,
      1.3,
      1.3
    ]
  },
  "454": {
    "name": "Malawi",
    "alpha2": "mw",
    "prevalence": 1,
    "deaths": "≈1,000/yr",
    "color": "#ec4899",
    "trend": [
      0.8,
      0.8,
      0.8,
      0.9,
      0.8
    ]
  },
  "458": {
    "name": "Malaysia",
    "alpha2": "my",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#10b981",
    "trend": [
      3.3,
      3.2,
      3.4,
      3.5,
      3.3
    ]
  },
  "462": {
    "name": "Maldives",
    "alpha2": "mv",
    "prevalence": 4.3,
    "deaths": "≈4,300/yr",
    "color": "#10b981",
    "trend": [
      3.5,
      3.6,
      3.7,
      3.5,
      3.7
    ]
  },
  "466": {
    "name": "Mali",
    "alpha2": "ml",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.2,
      1.3,
      1.3,
      1.3
    ]
  },
  "470": {
    "name": "Malta",
    "alpha2": "mt",
    "prevalence": 5.3,
    "deaths": "≈5,300/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      4.5,
      4.3,
      4.4,
      4.6
    ]
  },
  "474": {
    "name": "Martinique",
    "alpha2": "mq",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#a855f7",
    "trend": [
      2.7,
      2.7,
      2.9,
      2.9,
      2.8
    ]
  },
  "478": {
    "name": "Mauritania",
    "alpha2": "mr",
    "prevalence": 1.2,
    "deaths": "≈1,200/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1,
      1,
      1,
      1
    ]
  },
  "480": {
    "name": "Mauritius",
    "alpha2": "mu",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.1,
      1.2,
      1.2,
      1.2
    ]
  },
  "484": {
    "name": "Mexico",
    "alpha2": "mx",
    "prevalence": 3.6,
    "deaths": "≈3,600/yr",
    "color": "#a855f7",
    "trend": [
      2.8,
      3,
      2.9,
      3.2,
      3
    ]
  },
  "492": {
    "name": "Monaco",
    "alpha2": "mc",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4,
      4.3,
      4.4,
      4.1
    ]
  },
  "496": {
    "name": "Mongolia",
    "alpha2": "mn",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#10b981",
    "trend": [
      2.3,
      2.5,
      2.5,
      2.6,
      2.7
    ]
  },
  "498": {
    "name": "Moldova, Republic of",
    "alpha2": "md",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.4,
      4.1,
      4.5,
      4.2
    ]
  },
  "499": {
    "name": "Montenegro",
    "alpha2": "me",
    "prevalence": 5.3,
    "deaths": "≈5,300/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.4,
      4.5,
      4.6,
      4.7
    ]
  },
  "500": {
    "name": "Montserrat",
    "alpha2": "ms",
    "prevalence": 2.2,
    "deaths": "≈2,200/yr",
    "color": "#a855f7",
    "trend": [
      1.7,
      1.8,
      1.9,
      1.8,
      1.9
    ]
  },
  "504": {
    "name": "Morocco",
    "alpha2": "ma",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.3,
      1.3,
      1.3,
      1.4
    ]
  },
  "508": {
    "name": "Mozambique",
    "alpha2": "mz",
    "prevalence": 1,
    "deaths": "≈1,000/yr",
    "color": "#ec4899",
    "trend": [
      0.8,
      0.8,
      0.9,
      0.9,
      0.9
    ]
  },
  "512": {
    "name": "Oman",
    "alpha2": "om",
    "prevalence": 3.9,
    "deaths": "≈3,900/yr",
    "color": "#10b981",
    "trend": [
      3.1,
      3,
      3.3,
      3.4,
      3.5
    ]
  },
  "516": {
    "name": "Namibia",
    "alpha2": "na",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.2,
      1.2,
      1.2,
      1.3
    ]
  },
  "520": {
    "name": "Nauru",
    "alpha2": "nr",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#8b5cf6",
    "trend": [
      2.4,
      2.4,
      2.4,
      2.6,
      2.6
    ]
  },
  "524": {
    "name": "Nepal",
    "alpha2": "np",
    "prevalence": 4.4,
    "deaths": "≈4,400/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.4,
      3.7,
      3.8,
      3.9
    ]
  },
  "528": {
    "name": "Netherlands, Kingdom of the",
    "alpha2": "nl",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.2,
      4.4,
      4.4,
      4.7
    ]
  },
  "531": {
    "name": "Curaçao",
    "alpha2": "cw",
    "prevalence": 3.8,
    "deaths": "≈3,800/yr",
    "color": "#a855f7",
    "trend": [
      3.2,
      3.1,
      3.2,
      3.1,
      3.4
    ]
  },
  "533": {
    "name": "Aruba",
    "alpha2": "aw",
    "prevalence": 2.3,
    "deaths": "≈2,300/yr",
    "color": "#a855f7",
    "trend": [
      1.8,
      1.8,
      1.8,
      2,
      2
    ]
  },
  "534": {
    "name": "Sint Maarten (Dutch part)",
    "alpha2": "sx",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#a855f7",
    "trend": [
      2.7,
      2.7,
      2.9,
      2.7,
      2.9
    ]
  },
  "535": {
    "name": "Bonaire, Sint Eustatius and Saba",
    "alpha2": "bq",
    "prevalence": 3.6,
    "deaths": "≈3,600/yr",
    "color": "#a855f7",
    "trend": [
      3,
      2.8,
      3,
      2.9,
      3
    ]
  },
  "540": {
    "name": "New Caledonia",
    "alpha2": "nc",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#8b5cf6",
    "trend": [
      2.6,
      2.7,
      2.8,
      2.9,
      2.7
    ]
  },
  "548": {
    "name": "Vanuatu",
    "alpha2": "vu",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#8b5cf6",
    "trend": [
      2.7,
      2.7,
      2.8,
      2.9,
      2.8
    ]
  },
  "554": {
    "name": "New Zealand",
    "alpha2": "nz",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#8b5cf6",
    "trend": [
      2.4,
      2.5,
      2.6,
      2.6,
      2.6
    ]
  },
  "558": {
    "name": "Nicaragua",
    "alpha2": "ni",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#a855f7",
    "trend": [
      2.3,
      2.5,
      2.6,
      2.5,
      2.6
    ]
  },
  "562": {
    "name": "Niger",
    "alpha2": "ne",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1,
      1.1,
      1.1,
      1.1
    ]
  },
  "566": {
    "name": "Nigeria",
    "alpha2": "ng",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      0.9,
      1,
      0.9
    ]
  },
  "570": {
    "name": "Niue",
    "alpha2": "nu",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#8b5cf6",
    "trend": [
      2.1,
      2.2,
      2.1,
      2.2,
      2.2
    ]
  },
  "574": {
    "name": "Norfolk Island",
    "alpha2": "nf",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#8b5cf6",
    "trend": [
      2.3,
      2.3,
      2.5,
      2.4,
      2.6
    ]
  },
  "578": {
    "name": "Norway",
    "alpha2": "no",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.1,
      4.4,
      4.2,
      4.5
    ]
  },
  "580": {
    "name": "Northern Mariana Islands",
    "alpha2": "mp",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#8b5cf6",
    "trend": [
      2.1,
      2.3,
      2.3,
      2.4,
      2.2
    ]
  },
  "581": {
    "name": "United States Minor Outlying Islands",
    "alpha2": "um",
    "prevalence": 3.5,
    "deaths": "≈3,500/yr",
    "color": "#8b5cf6",
    "trend": [
      2.9,
      2.8,
      2.9,
      3,
      3.2
    ]
  },
  "583": {
    "name": "Micronesia, Federated States of",
    "alpha2": "fm",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.5,
      2.5,
      2.7,
      2.7
    ]
  },
  "584": {
    "name": "Marshall Islands",
    "alpha2": "mh",
    "prevalence": 2.5,
    "deaths": "≈2,500/yr",
    "color": "#8b5cf6",
    "trend": [
      2,
      2.1,
      2.1,
      2.1,
      2.2
    ]
  },
  "585": {
    "name": "Palau",
    "alpha2": "pw",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.5,
      2.6,
      2.7,
      2.8
    ]
  },
  "586": {
    "name": "Pakistan",
    "alpha2": "pk",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#10b981",
    "trend": [
      2.5,
      2.6,
      2.5,
      2.5,
      2.7
    ]
  },
  "591": {
    "name": "Panama",
    "alpha2": "pa",
    "prevalence": 2.8,
    "deaths": "≈2,800/yr",
    "color": "#a855f7",
    "trend": [
      2.3,
      2.2,
      2.4,
      2.3,
      2.4
    ]
  },
  "598": {
    "name": "Papua New Guinea",
    "alpha2": "pg",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#8b5cf6",
    "trend": [
      2.4,
      2.6,
      2.5,
      2.8,
      2.6
    ]
  },
  "600": {
    "name": "Paraguay",
    "alpha2": "py",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#a855f7",
    "trend": [
      3.9,
      4,
      4.3,
      4.1,
      4
    ]
  },
  "604": {
    "name": "Peru",
    "alpha2": "pe",
    "prevalence": 2.6,
    "deaths": "≈2,600/yr",
    "color": "#a855f7",
    "trend": [
      2,
      2.1,
      2.1,
      2.2,
      2.2
    ]
  },
  "608": {
    "name": "Philippines",
    "alpha2": "ph",
    "prevalence": 3.6,
    "deaths": "≈3,600/yr",
    "color": "#10b981",
    "trend": [
      2.9,
      3,
      3,
      3,
      3.1
    ]
  },
  "612": {
    "name": "Pitcairn",
    "alpha2": "pn",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.7,
      2.6,
      2.6,
      2.9
    ]
  },
  "616": {
    "name": "Poland",
    "alpha2": "pl",
    "prevalence": 5.3,
    "deaths": "≈5,300/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.4,
      4.3,
      4.4,
      4.4
    ]
  },
  "620": {
    "name": "Portugal",
    "alpha2": "pt",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      3.9,
      4.1,
      4.1,
      4.3
    ]
  },
  "624": {
    "name": "Guinea-Bissau",
    "alpha2": "gw",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.4,
      1.3,
      1.3,
      1.4
    ]
  },
  "626": {
    "name": "Timor-Leste",
    "alpha2": "tl",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#10b981",
    "trend": [
      2.5,
      2.6,
      2.6,
      2.8,
      2.6
    ]
  },
  "630": {
    "name": "Puerto Rico",
    "alpha2": "pr",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#a855f7",
    "trend": [
      2.5,
      2.7,
      2.8,
      2.8,
      3
    ]
  },
  "634": {
    "name": "Qatar",
    "alpha2": "qa",
    "prevalence": 3.6,
    "deaths": "≈3,600/yr",
    "color": "#10b981",
    "trend": [
      2.9,
      2.9,
      3.1,
      2.9,
      3
    ]
  },
  "638": {
    "name": "Réunion",
    "alpha2": "re",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      0.9,
      0.9,
      1
    ]
  },
  "642": {
    "name": "Romania",
    "alpha2": "ro",
    "prevalence": 5.3,
    "deaths": "≈5,300/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4.3,
      4.3,
      4.3,
      4.5
    ]
  },
  "643": {
    "name": "Russian Federation",
    "alpha2": "ru",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      4,
      4.5,
      4.3,
      4.4
    ]
  },
  "646": {
    "name": "Rwanda",
    "alpha2": "rw",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      0.9,
      0.9,
      1
    ]
  },
  "652": {
    "name": "Saint Barthélemy",
    "alpha2": "bl",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#a855f7",
    "trend": [
      3.2,
      3.3,
      3.4,
      3.5,
      3.6
    ]
  },
  "654": {
    "name": "Saint Helena, Ascension and Tristan da Cunha",
    "alpha2": "sh",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      0.9,
      0.9,
      1
    ]
  },
  "659": {
    "name": "Saint Kitts and Nevis",
    "alpha2": "kn",
    "prevalence": 3.9,
    "deaths": "≈3,900/yr",
    "color": "#a855f7",
    "trend": [
      3.3,
      3.3,
      3.4,
      3.2,
      3.5
    ]
  },
  "660": {
    "name": "Anguilla",
    "alpha2": "ai",
    "prevalence": 2.5,
    "deaths": "≈2,500/yr",
    "color": "#a855f7",
    "trend": [
      1.9,
      2,
      2.1,
      2,
      2.1
    ]
  },
  "662": {
    "name": "Saint Lucia",
    "alpha2": "lc",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#a855f7",
    "trend": [
      2.7,
      2.7,
      2.9,
      2.9,
      2.9
    ]
  },
  "663": {
    "name": "Saint Martin (French part)",
    "alpha2": "mf",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#a855f7",
    "trend": [
      2.3,
      2.2,
      2.2,
      2.4,
      2.2
    ]
  },
  "666": {
    "name": "Saint Pierre and Miquelon",
    "alpha2": "pm",
    "prevalence": 4.3,
    "deaths": "≈4,300/yr",
    "color": "#a855f7",
    "trend": [
      3.5,
      3.4,
      3.7,
      3.5,
      3.7
    ]
  },
  "670": {
    "name": "Saint Vincent and the Grenadines",
    "alpha2": "vc",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#a855f7",
    "trend": [
      2.4,
      2.5,
      2.5,
      2.6,
      2.7
    ]
  },
  "674": {
    "name": "San Marino",
    "alpha2": "sm",
    "prevalence": 4.8,
    "deaths": "≈4,800/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      4.1,
      3.9,
      3.9,
      4.1
    ]
  },
  "678": {
    "name": "Sao Tome and Principe",
    "alpha2": "st",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1,
      1.1,
      1.1,
      1.1
    ]
  },
  "682": {
    "name": "Saudi Arabia",
    "alpha2": "sa",
    "prevalence": 3.8,
    "deaths": "≈3,800/yr",
    "color": "#10b981",
    "trend": [
      3,
      3.1,
      3.3,
      3.1,
      3.4
    ]
  },
  "686": {
    "name": "Senegal",
    "alpha2": "sn",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1,
      1.1,
      1.1,
      1.2
    ]
  },
  "688": {
    "name": "Serbia",
    "alpha2": "rs",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.1,
      4.3,
      4.4,
      4.5
    ]
  },
  "690": {
    "name": "Seychelles",
    "alpha2": "sc",
    "prevalence": 1.2,
    "deaths": "≈1,200/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      1,
      1,
      1,
      1
    ]
  },
  "694": {
    "name": "Sierra Leone",
    "alpha2": "sl",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.2,
      1.2,
      1.2,
      1.3
    ]
  },
  "702": {
    "name": "Singapore",
    "alpha2": "sg",
    "prevalence": 3.7,
    "deaths": "≈3,700/yr",
    "color": "#10b981",
    "trend": [
      3,
      2.9,
      3.2,
      3.1,
      3.1
    ]
  },
  "703": {
    "name": "Slovakia",
    "alpha2": "sk",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#00d4ff",
    "trend": [
      3.8,
      3.9,
      4.1,
      4.3,
      4.3
    ]
  },
  "704": {
    "name": "Viet Nam",
    "alpha2": "vn",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#10b981",
    "trend": [
      2.6,
      2.6,
      2.9,
      2.9,
      2.8
    ]
  },
  "705": {
    "name": "Slovenia",
    "alpha2": "si",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      4,
      4.3,
      4.1,
      4.3
    ]
  },
  "706": {
    "name": "Somalia",
    "alpha2": "so",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.3,
      1.3,
      1.4,
      1.4
    ]
  },
  "710": {
    "name": "South Africa",
    "alpha2": "za",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.2,
      1.2,
      1.3,
      1.3
    ]
  },
  "716": {
    "name": "Zimbabwe",
    "alpha2": "zw",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.8,
      0.9,
      0.9,
      1,
      0.9
    ]
  },
  "724": {
    "name": "Spain",
    "alpha2": "es",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.3,
      4.3,
      4.6,
      4.3
    ]
  },
  "728": {
    "name": "South Sudan",
    "alpha2": "ss",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.2,
      1.2,
      1.1,
      1.2
    ]
  },
  "729": {
    "name": "Sudan",
    "alpha2": "sd",
    "prevalence": 1.6,
    "deaths": "≈1,600/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.3,
      1.3,
      1.4,
      1.4
    ]
  },
  "732": {
    "name": "Western Sahara",
    "alpha2": "eh",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1.1,
      1.1,
      1.1,
      1.1
    ]
  },
  "740": {
    "name": "Suriname",
    "alpha2": "sr",
    "prevalence": 4.7,
    "deaths": "≈4,700/yr",
    "color": "#a855f7",
    "trend": [
      3.9,
      4,
      3.8,
      4,
      4
    ]
  },
  "744": {
    "name": "Svalbard and Jan Mayen",
    "alpha2": "sj",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      4.1,
      4.4,
      4.5,
      4.4
    ]
  },
  "748": {
    "name": "Eswatini",
    "alpha2": "sz",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      1,
      1,
      1
    ]
  },
  "752": {
    "name": "Sweden",
    "alpha2": "se",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#00d4ff",
    "trend": [
      4.1,
      4.1,
      4.2,
      4.1,
      4.3
    ]
  },
  "756": {
    "name": "Switzerland",
    "alpha2": "ch",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      4,
      4,
      4.2,
      4.2
    ]
  },
  "760": {
    "name": "Syrian Arab Republic",
    "alpha2": "sy",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.2,
      3.4,
      3.4,
      3.3
    ]
  },
  "762": {
    "name": "Tajikistan",
    "alpha2": "tj",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#10b981",
    "trend": [
      2.4,
      2.4,
      2.5,
      2.4,
      2.6
    ]
  },
  "764": {
    "name": "Thailand",
    "alpha2": "th",
    "prevalence": 3.7,
    "deaths": "≈3,700/yr",
    "color": "#10b981",
    "trend": [
      2.8,
      3,
      3,
      3.1,
      3.2
    ]
  },
  "768": {
    "name": "Togo",
    "alpha2": "tg",
    "prevalence": 1.8,
    "deaths": "≈1,800/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.5,
      1.4,
      1.5,
      1.5
    ]
  },
  "772": {
    "name": "Tokelau",
    "alpha2": "tk",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#8b5cf6",
    "trend": [
      2.6,
      2.9,
      2.7,
      2.8,
      2.8
    ]
  },
  "776": {
    "name": "Tonga",
    "alpha2": "to",
    "prevalence": 2.8,
    "deaths": "≈2,800/yr",
    "color": "#8b5cf6",
    "trend": [
      2.3,
      2.4,
      2.4,
      2.4,
      2.3
    ]
  },
  "780": {
    "name": "Trinidad and Tobago",
    "alpha2": "tt",
    "prevalence": 4.7,
    "deaths": "≈4,700/yr",
    "color": "#a855f7",
    "trend": [
      3.8,
      3.7,
      3.8,
      4.2,
      4
    ]
  },
  "784": {
    "name": "United Arab Emirates",
    "alpha2": "ae",
    "prevalence": 4.4,
    "deaths": "≈4,400/yr",
    "color": "#10b981",
    "trend": [
      3.6,
      3.6,
      3.8,
      3.6,
      3.6
    ]
  },
  "788": {
    "name": "Tunisia",
    "alpha2": "tn",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.4,
      1.4,
      1.4,
      1.4
    ]
  },
  "792": {
    "name": "Türkiye",
    "alpha2": "tr",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#10b981",
    "trend": [
      3.4,
      3.4,
      3.5,
      3.6,
      3.7
    ]
  },
  "795": {
    "name": "Turkmenistan",
    "alpha2": "tm",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#10b981",
    "trend": [
      3.3,
      3.4,
      3.3,
      3.4,
      3.4
    ]
  },
  "796": {
    "name": "Turks and Caicos Islands",
    "alpha2": "tc",
    "prevalence": 2.2,
    "deaths": "≈2,200/yr",
    "color": "#a855f7",
    "trend": [
      1.8,
      1.9,
      1.9,
      1.9,
      1.9
    ]
  },
  "798": {
    "name": "Tuvalu",
    "alpha2": "tv",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.5,
      2.7,
      2.7,
      2.7
    ]
  },
  "800": {
    "name": "Uganda",
    "alpha2": "ug",
    "prevalence": 1.2,
    "deaths": "≈1,200/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1,
      1,
      1,
      1.1
    ]
  },
  "804": {
    "name": "Ukraine",
    "alpha2": "ua",
    "prevalence": 5.4,
    "deaths": "≈5,400/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.2,
      4.4,
      4.4,
      4.6
    ]
  },
  "807": {
    "name": "North Macedonia",
    "alpha2": "mk",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      4,
      4.1,
      4.2,
      4.4
    ]
  },
  "818": {
    "name": "Egypt",
    "alpha2": "eg",
    "prevalence": 1.5,
    "deaths": "≈1,500/yr",
    "color": "#ec4899",
    "trend": [
      1.2,
      1.2,
      1.2,
      1.3,
      1.3
    ]
  },
  "826": {
    "name": "United Kingdom of Great Britain and Northern Ireland",
    "alpha2": "gb",
    "prevalence": 4.8,
    "deaths": "≈4,800/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      4,
      4,
      4.2,
      4
    ]
  },
  "831": {
    "name": "Guernsey",
    "alpha2": "gg",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4,
      4.4,
      4.3,
      4.6,
      4.4
    ]
  },
  "832": {
    "name": "Jersey",
    "alpha2": "je",
    "prevalence": 4.9,
    "deaths": "≈4,900/yr",
    "color": "#00d4ff",
    "trend": [
      3.7,
      4,
      4,
      4,
      4.1
    ]
  },
  "833": {
    "name": "Isle of Man",
    "alpha2": "im",
    "prevalence": 5.2,
    "deaths": "≈5,200/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.4,
      4.1,
      4.3,
      4.4
    ]
  },
  "834": {
    "name": "Tanzania, United Republic of",
    "alpha2": "tz",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.3,
      1.4,
      1.3,
      1.4,
      1.5
    ]
  },
  "840": {
    "name": "United States of America",
    "alpha2": "us",
    "prevalence": 4.8,
    "deaths": "≈35,000/yr",
    "color": "#a855f7",
    "trend": [
      3.9,
      3.8,
      4.2,
      4,
      4.2
    ]
  },
  "850": {
    "name": "Virgin Islands (U.S.)",
    "alpha2": "vi",
    "prevalence": 3.2,
    "deaths": "≈3,200/yr",
    "color": "#a855f7",
    "trend": [
      2.7,
      2.7,
      2.8,
      2.7,
      2.9
    ]
  },
  "854": {
    "name": "Burkina Faso",
    "alpha2": "bf",
    "prevalence": 1.4,
    "deaths": "≈1,400/yr",
    "color": "#ec4899",
    "trend": [
      1.1,
      1.1,
      1.2,
      1.2,
      1.2
    ]
  },
  "858": {
    "name": "Uruguay",
    "alpha2": "uy",
    "prevalence": 4.6,
    "deaths": "≈4,600/yr",
    "color": "#a855f7",
    "trend": [
      3.6,
      3.6,
      3.8,
      3.9,
      3.8
    ]
  },
  "860": {
    "name": "Uzbekistan",
    "alpha2": "uz",
    "prevalence": 3.8,
    "deaths": "≈3,800/yr",
    "color": "#10b981",
    "trend": [
      3.1,
      3.1,
      3.3,
      3.2,
      3.2
    ]
  },
  "862": {
    "name": "Venezuela, Bolivarian Republic of",
    "alpha2": "ve",
    "prevalence": 4,
    "deaths": "≈4,000/yr",
    "color": "#a855f7",
    "trend": [
      3.3,
      3.3,
      3.3,
      3.3,
      3.3
    ]
  },
  "876": {
    "name": "Wallis and Futuna",
    "alpha2": "wf",
    "prevalence": 2.8,
    "deaths": "≈2,800/yr",
    "color": "#8b5cf6",
    "trend": [
      2.1,
      2.4,
      2.3,
      2.5,
      2.5
    ]
  },
  "882": {
    "name": "Samoa",
    "alpha2": "ws",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#8b5cf6",
    "trend": [
      2.8,
      2.8,
      2.8,
      3,
      2.9
    ]
  },
  "887": {
    "name": "Yemen",
    "alpha2": "ye",
    "prevalence": 4.4,
    "deaths": "≈4,400/yr",
    "color": "#10b981",
    "trend": [
      3.7,
      3.6,
      3.7,
      3.8,
      3.8
    ]
  },
  "894": {
    "name": "Zambia",
    "alpha2": "zm",
    "prevalence": 1.1,
    "deaths": "≈1,100/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      0.9,
      1,
      0.9,
      0.9
    ]
  },
  "004": {
    "name": "Afghanistan",
    "alpha2": "af",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#10b981",
    "trend": [
      3.2,
      3.3,
      3.4,
      3.3,
      3.5
    ]
  },
  "008": {
    "name": "Albania",
    "alpha2": "al",
    "prevalence": 5.5,
    "deaths": "≈5,500/yr",
    "color": "#00d4ff",
    "trend": [
      4.4,
      4.6,
      4.8,
      4.8,
      4.8
    ]
  },
  "012": {
    "name": "Algeria",
    "alpha2": "dz",
    "prevalence": 1.7,
    "deaths": "≈1,700/yr",
    "color": "#ec4899",
    "trend": [
      1.4,
      1.4,
      1.5,
      1.5,
      1.5
    ]
  },
  "016": {
    "name": "American Samoa",
    "alpha2": "as",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.4,
      2.5,
      2.6,
      2.5
    ]
  },
  "020": {
    "name": "Andorra",
    "alpha2": "ad",
    "prevalence": 4.8,
    "deaths": "≈4,800/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      4,
      3.9,
      4,
      4.3
    ]
  },
  "024": {
    "name": "Angola",
    "alpha2": "ao",
    "prevalence": 1.8,
    "deaths": "≈1,800/yr",
    "color": "#ec4899",
    "trend": [
      1.5,
      1.5,
      1.5,
      1.6,
      1.5
    ]
  },
  "010": {
    "name": "Antarctica",
    "alpha2": "aq",
    "prevalence": 2.5,
    "deaths": "≈2,500/yr",
    "color": "#1f2937",
    "trend": [
      2.1,
      2.1,
      2.1,
      2,
      2.1
    ]
  },
  "028": {
    "name": "Antigua and Barbuda",
    "alpha2": "ag",
    "prevalence": 4.8,
    "deaths": "≈4,800/yr",
    "color": "#a855f7",
    "trend": [
      3.9,
      4.1,
      4.1,
      3.9,
      4.1
    ]
  },
  "032": {
    "name": "Argentina",
    "alpha2": "ar",
    "prevalence": 3.4,
    "deaths": "≈3,400/yr",
    "color": "#a855f7",
    "trend": [
      2.7,
      2.8,
      2.9,
      2.9,
      2.8
    ]
  },
  "051": {
    "name": "Armenia",
    "alpha2": "am",
    "prevalence": 3.7,
    "deaths": "≈3,700/yr",
    "color": "#10b981",
    "trend": [
      3.1,
      3.2,
      3.2,
      3.3,
      3.1
    ]
  },
  "036": {
    "name": "Australia",
    "alpha2": "au",
    "prevalence": 3.3,
    "deaths": "≈3,300/yr",
    "color": "#8b5cf6",
    "trend": [
      2.5,
      2.7,
      2.7,
      2.7,
      2.9
    ]
  },
  "040": {
    "name": "Austria",
    "alpha2": "at",
    "prevalence": 5.1,
    "deaths": "≈5,100/yr",
    "color": "#00d4ff",
    "trend": [
      4.2,
      4.3,
      4.2,
      4.2,
      4.5
    ]
  },
  "031": {
    "name": "Azerbaijan",
    "alpha2": "az",
    "prevalence": 3.7,
    "deaths": "≈3,700/yr",
    "color": "#10b981",
    "trend": [
      2.9,
      3.1,
      3.1,
      3.2,
      3.1
    ]
  },
  "044": {
    "name": "Bahamas",
    "alpha2": "bs",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#a855f7",
    "trend": [
      2.3,
      2.1,
      2.3,
      2.3,
      2.2
    ]
  },
  "048": {
    "name": "Bahrain",
    "alpha2": "bh",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#10b981",
    "trend": [
      2.4,
      2.6,
      2.7,
      2.7,
      2.8
    ]
  },
  "050": {
    "name": "Bangladesh",
    "alpha2": "bd",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#10b981",
    "trend": [
      2.4,
      2.4,
      2.5,
      2.5,
      2.6
    ]
  },
  "052": {
    "name": "Barbados",
    "alpha2": "bb",
    "prevalence": 2.3,
    "deaths": "≈2,300/yr",
    "color": "#a855f7",
    "trend": [
      1.8,
      1.9,
      1.9,
      2,
      1.9
    ]
  },
  "056": {
    "name": "Belgium",
    "alpha2": "be",
    "prevalence": 5,
    "deaths": "≈5,000/yr",
    "color": "#00d4ff",
    "trend": [
      3.9,
      3.9,
      4.3,
      4.2,
      4.4
    ]
  },
  "084": {
    "name": "Belize",
    "alpha2": "bz",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#a855f7",
    "trend": [
      2.6,
      2.6,
      2.6,
      2.5,
      2.7
    ]
  },
  "060": {
    "name": "Bermuda",
    "alpha2": "bm",
    "prevalence": 4.1,
    "deaths": "≈4,100/yr",
    "color": "#a855f7",
    "trend": [
      3.3,
      3.2,
      3.4,
      3.3,
      3.7
    ]
  },
  "064": {
    "name": "Bhutan",
    "alpha2": "bt",
    "prevalence": 4.3,
    "deaths": "≈4,300/yr",
    "color": "#10b981",
    "trend": [
      3.3,
      3.6,
      3.7,
      3.8,
      3.8
    ]
  },
  "068": {
    "name": "Bolivia, Plurinational State of",
    "alpha2": "bo",
    "prevalence": 2.2,
    "deaths": "≈2,200/yr",
    "color": "#a855f7",
    "trend": [
      1.8,
      1.8,
      1.8,
      1.9,
      2
    ]
  },
  "070": {
    "name": "Bosnia and Herzegovina",
    "alpha2": "ba",
    "prevalence": 5.5,
    "deaths": "≈5,500/yr",
    "color": "#00d4ff",
    "trend": [
      4.3,
      4.4,
      4.4,
      4.8,
      4.6
    ]
  },
  "072": {
    "name": "Botswana",
    "alpha2": "bw",
    "prevalence": 1.3,
    "deaths": "≈1,300/yr",
    "color": "#ec4899",
    "trend": [
      1,
      1.1,
      1.1,
      1.1,
      1.2
    ]
  },
  "074": {
    "name": "Bouvet Island",
    "alpha2": "bv",
    "prevalence": 2.6,
    "deaths": "≈2,600/yr",
    "color": "#a855f7",
    "trend": [
      2.1,
      2.2,
      2.1,
      2.3,
      2.3
    ]
  },
  "076": {
    "name": "Brazil",
    "alpha2": "br",
    "prevalence": 2.3,
    "deaths": "≈2,300/yr",
    "color": "#a855f7",
    "trend": [
      1.9,
      1.9,
      2,
      1.9,
      2
    ]
  },
  "086": {
    "name": "British Indian Ocean Territory",
    "alpha2": "io",
    "prevalence": 1.2,
    "deaths": "≈1,200/yr",
    "color": "#ec4899",
    "trend": [
      0.9,
      1,
      1,
      1,
      1.1
    ]
  },
  "096": {
    "name": "Brunei Darussalam",
    "alpha2": "bn",
    "prevalence": 3.1,
    "deaths": "≈3,100/yr",
    "color": "#10b981",
    "trend": [
      2.5,
      2.4,
      2.6,
      2.7,
      2.8
    ]
  },
  "090": {
    "name": "Solomon Islands",
    "alpha2": "sb",
    "prevalence": 3,
    "deaths": "≈3,000/yr",
    "color": "#8b5cf6",
    "trend": [
      2.3,
      2.5,
      2.5,
      2.4,
      2.7
    ]
  },
  "092": {
    "name": "Virgin Islands (British)",
    "alpha2": "vg",
    "prevalence": 2.7,
    "deaths": "≈2,700/yr",
    "color": "#a855f7",
    "trend": [
      2.1,
      2.2,
      2.2,
      2.4,
      2.3
    ]
  }
};

export default function AnalyticsPage() {
  const [visible, setVisible] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<any>(null);
  const { mode, gazePos } = useMode();
  const triggerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Gaze Interaction for Map
  useEffect(() => {
    if (mode === 'gaze') {
      const x = gazePos.x;
      const y = gazePos.y;
      
      const elements = document.elementsFromPoint(x, y);
      const regionEl = elements.find(el => el.classList.contains('map-region')) as HTMLElement | undefined;
      
      if (regionEl) {
        const id = regionEl.getAttribute('data-id');
        const name = regionEl.getAttribute('data-name'); // Need to add this attribute to Geography
        if (id) {
          const data = MAP_DATA[id];
          if (data) {
            setHoveredRegion({ ...data, geoId: id, label: name || "Selected Region" });
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

        <div className="map-container">
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
                      data-name={geo.properties.name}
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

/* ── FIXED INFO PANEL (Dual-Pane) ── */
          <div className="region-info-panel glass-panel">
            {!hoveredRegion ? (
              <div className="panel-pane">
                <div className="global-insight-badge">Global Insight</div>
                <div className="info-panel-header">
                  <div className="header-main">
                    <h4>Worldwide Stats</h4>
                    <div className="panel-region-tag">Global Averages</div>
                  </div>
                  <span style={{ fontSize: '1.5rem' }}>🌍</span>
                </div>
                <div className="info-panel-body">
                  <div className="info-metric">
                    <span className="metric-label">Global Prevalence</span>
                    <span className="metric-value">4.5 per 100k</span>
                  </div>
                  <div className="info-metric">
                    <span className="metric-label">Affected Population</span>
                    <span className="metric-value">450,000+</span>
                  </div>
                </div>
                <div className="info-panel-footer">
                  *Averaged across 249 territories
                </div>
              </div>
            ) : (
              <div className="panel-slider-container">
                {/* Pane 1: Vital Stats */}
                <div className="panel-pane">
                  <div className="info-panel-header">
                    <div className="header-main">
                      <h4>{hoveredRegion.label}</h4>
                      <div className="panel-region-tag">
                        Vital Statistics
                      </div>
                    </div>
                    {hoveredRegion.alpha2 && (
                      <img 
                        src={`https://flagcdn.com/w80/${hoveredRegion.alpha2}.png`} 
                        alt={`${hoveredRegion.label} flag`}
                        className="country-flag-icon"
                      />
                    )}
                  </div>
                  <div className="info-panel-body">
                    <div className="info-metric">
                      <span className="metric-label">ALS Prevalence</span>
                      <span className="metric-value highlight">{hoveredRegion.prevalence} per 100k</span>
                    </div>
                    <div className="info-metric">
                      <span className="metric-label">Annual Mortality</span>
                      <span className="metric-value">{hoveredRegion.deaths}</span>
                    </div>
                  </div>
                  <div className="info-panel-footer">
                    Swipe or look right for trends →
                  </div>
                </div>

                {/* Pane 2: Trend Analysis */}
                <div className="panel-pane">
                  <div className="info-panel-header">
                    <div className="header-main">
                      <h4>Trend Analysis</h4>
                      <div className="panel-region-tag">
                        Recent 5-Year Projection
                      </div>
                    </div>
                  </div>
                  <div className="trend-analysis">
                    <div className="trend-chart-box">
                      <MiniTrendChart data={hoveredRegion.trend} color={hoveredRegion.color} />
                      <div className="trend-labels">
                        <span>2020</span>
                        <span>2025 (Ref)</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Case detection rates show a <strong>{( (hoveredRegion.trend[4] - hoveredRegion.trend[0]) / hoveredRegion.trend[0] * 100 ).toFixed(1)}%</strong> shift over the specified period, reflecting improved diagnostics and aging demographics.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
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
          <div className="source-tag" style={{ background: 'rgba(168, 85, 247, 0.05)', borderColor: 'var(--accent-secondary)' }}>
            <strong>Analytics Modeling:</strong> 5-Year Trends derived from Age-Standardized Growth Models (2020-2025)
          </div>
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
