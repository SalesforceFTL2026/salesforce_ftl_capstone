// Mappie — the cute robot mascot for the MapResponse chat assistant.
// Pure inline SVG so it needs no image asset, scales crisply, and picks up
// whatever size you give it. A friendly rounded robot head with a map-pin
// antenna (a nod to MapResponse), big blinking eyes, and a little smile.
//
// @param {string} [className] - sizing/positioning classes (e.g. "w-10 h-10")
// @param {string} [title] - accessible label
const MappieMascot = ({ className = 'w-10 h-10', title = 'Mappie' }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    role="img"
    aria-label={title}
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>{title}</title>

    {/* Antenna — a little map pin, MapResponse's motif */}
    <line x1="32" y1="6" x2="32" y2="16" stroke="#1e3a5f" strokeWidth="2.5" strokeLinecap="round" />
    <path
      d="M32 2c-3 0-5.4 2.4-5.4 5.4 0 3.6 5.4 8.6 5.4 8.6s5.4-5 5.4-8.6C37.4 4.4 35 2 32 2z"
      fill="#ef5b5b"
    />
    <circle cx="32" cy="7.2" r="1.9" fill="#fff" />

    {/* Head */}
    <rect x="12" y="16" width="40" height="34" rx="12" fill="#1e3a5f" />
    {/* Cheek/side ears */}
    <rect x="7" y="28" width="5" height="12" rx="2.5" fill="#1e3a5f" />
    <rect x="52" y="28" width="5" height="12" rx="2.5" fill="#1e3a5f" />

    {/* Face screen */}
    <rect x="17" y="21" width="30" height="24" rx="9" fill="#dbeafe" />

    {/* Eyes — big and round for a cute look */}
    <circle cx="25.5" cy="31.5" r="5" fill="#1e3a5f" />
    <circle cx="38.5" cy="31.5" r="5" fill="#1e3a5f" />
    {/* Big glossy sparkles */}
    <circle cx="27.4" cy="29.6" r="1.8" fill="#fff" />
    <circle cx="40.4" cy="29.6" r="1.8" fill="#fff" />
    <circle cx="24" cy="33.2" r="0.9" fill="#fff" opacity="0.8" />
    <circle cx="37" cy="33.2" r="0.9" fill="#fff" opacity="0.8" />

    {/* Rosy cheeks */}
    <circle cx="19.5" cy="38" r="2.6" fill="#f9a8b4" opacity="0.85" />
    <circle cx="44.5" cy="38" r="2.6" fill="#f9a8b4" opacity="0.85" />

    {/* Smile — small, soft, and happy */}
    <path
      d="M29 39.5c1.2 1.4 4.8 1.4 6 0"
      fill="none"
      stroke="#1e3a5f"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default MappieMascot;
