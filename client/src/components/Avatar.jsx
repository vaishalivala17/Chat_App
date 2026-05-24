// Deterministic color from username string
const COLORS = [
  ['#0d4a3f', '#00e5cc'],
  ['#1a1a4e', '#6366f1'],
  ['#3b1515', '#ef4444'],
  ['#1a2e1a', '#22c55e'],
  ['#3b2a0d', '#f59e0b'],
  ['#2d1b3d', '#a855f7'],
  ['#0d2a4a', '#3b82f6'],
  ['#2d1a2d', '#ec4899'],
];

export function getAvatarColors(name = '') {
  const idx = name.charCodeAt(0) % COLORS.length;
  return COLORS[idx];
}

export function getInitials(username = '') {
  return username.slice(0, 2).toUpperCase();
}

export default function Avatar({ username = '', size = 10, className = '' }) {
  const [bg, text] = getAvatarColors(username);
  const pixelSize = size * 4;

  return (
    <div
      className={`avatar text-sm ${className}`}
      style={{ background: bg, color: text, width: `${pixelSize}px`, height: `${pixelSize}px` }}
    >
      {getInitials(username)}
    </div>
  );
}
