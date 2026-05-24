/** Backend API — use Vite proxy in dev (/api → localhost:5000). */
export const API_BASE = '/api';

/** Socket server — must match server PORT in .env (default 5000). */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/** Vite dev server — must match CLIENT_URL in .env (default 5173). */
export const CLIENT_DEV_PORT = 5173;
