import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import Avatar from './Avatar';

const DISAPPEAR_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
];

export default function SettingsModal({ onClose }) {
  const { user, API, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { updatePresence } = useSocket();

  const [tab, setTab] = useState('privacy');
  const [blocked, setBlocked] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [blockSearch, setBlockSearch] = useState('');
  const [blockResults, setBlockResults] = useState([]);
  const [blockSearching, setBlockSearching] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [showOnline, setShowOnline] = useState(user?.settings?.showOnlineStatus !== false);
  const [disappearing, setDisappearing] = useState(user?.settings?.defaultDisappearingSeconds ?? 0);
  const [chatLockEnabled, setChatLockEnabled] = useState(user?.settings?.chatLockEnabled ?? false);
  const [lockPin, setLockPin] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  useEffect(() => {
    if (tab === 'blocked') loadBlocked();
  }, [tab]);

  const loadBlocked = async () => {
    setLoadingBlocked(true);
    try {
      const { data } = await API.get('/users/blocked');
      setBlocked(data);
    } catch {
      setErr('Failed to load blocked contacts');
    } finally {
      setLoadingBlocked(false);
    }
  };

  const savePrivacy = async () => {
    setErr('');
    setMsg('');
    try {
      const { data } = await API.put('/auth/settings', {
        showOnlineStatus: showOnline,
        defaultDisappearingSeconds: disappearing,
        chatLockEnabled,
        chatLockPin: lockPin || undefined,
      });
      await refreshUser();
      updatePresence?.(showOnline);
      setLockPin('');
      setMsg('Settings saved');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save');
    }
  };

  const saveTheme = async (t) => {
    setTheme(t);
    try {
      await API.put('/auth/settings', { theme: t });
      await refreshUser();
    } catch {/* */}
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (newPw !== confirmPw) {
      setErr('New passwords do not match');
      return;
    }
    try {
      const { data } = await API.put('/auth/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setMsg(data.message);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to change password');
    }
  };

  useEffect(() => {
    if (tab !== 'blocked' || !blockSearch.trim()) {
      setBlockResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setBlockSearching(true);
      try {
        const { data } = await API.get(`/users/search?q=${encodeURIComponent(blockSearch)}`);
        const blockedIds = new Set(blocked.map((u) => u._id));
        setBlockResults(data.filter((u) => !blockedIds.has(u._id)));
      } catch {
        setBlockResults([]);
      } finally {
        setBlockSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [blockSearch, tab, blocked, API]);

  const blockUser = async (userId) => {
    try {
      await API.post(`/users/block/${userId}`);
      await loadBlocked();
      setBlockSearch('');
      setBlockResults([]);
      setMsg('Contact blocked');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to block');
    }
  };

  const unblock = async (userId) => {
    try {
      await API.delete(`/users/block/${userId}`);
      setBlocked((prev) => prev.filter((u) => u._id !== userId));
      setMsg('Contact unblocked');
    } catch {
      setErr('Failed to unblock');
    }
  };

  const tabs = [
    { id: 'privacy', label: 'Privacy' },
    { id: 'blocked', label: 'Blocked' },
    { id: 'appearance', label: 'Theme' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-lg">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-card text-muted">✕</button>
        </div>

        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setErr(''); setMsg(''); }}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'border-cyan text-cyan' : 'border-transparent text-muted hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {msg && <p className="text-cyan text-sm bg-cyan/10 border border-cyan/20 rounded-lg px-3 py-2">{msg}</p>}
          {err && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

          {tab === 'privacy' && (
            <>
              <label className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Show online status</p>
                  <p className="text-xs text-muted">Let others see when you are online</p>
                </div>
                <input
                  type="checkbox"
                  checked={showOnline}
                  onChange={(e) => setShowOnline(e.target.checked)}
                  className="w-5 h-5 accent-cyan"
                />
              </label>

              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-sm font-medium mb-2">Default disappearing messages</p>
                <select
                  value={disappearing}
                  onChange={(e) => setDisappearing(Number(e.target.value))}
                  className="input-base !py-2 text-sm"
                >
                  {DISAPPEAR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">Chat lock</p>
                    <p className="text-xs text-muted">Require PIN to open app</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatLockEnabled}
                    onChange={(e) => setChatLockEnabled(e.target.checked)}
                    className="w-5 h-5 accent-cyan"
                  />
                </label>
                {chatLockEnabled && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={lockPin}
                    onChange={(e) => setLockPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="New 4-6 digit PIN"
                    className="input-base !py-2 text-sm"
                  />
                )}
              </div>

              <button onClick={savePrivacy} className="btn-primary w-full">Save privacy settings</button>
            </>
          )}

          {tab === 'blocked' && (
            <>
              <p className="text-xs text-muted">Search a user and tap Block to add them here. You can also block from any chat profile.</p>
              <input
                type="text"
                placeholder="Search user to block…"
                value={blockSearch}
                onChange={(e) => setBlockSearch(e.target.value)}
                className="input-base !py-2.5 text-sm"
              />
              {blockSearching && <p className="text-xs text-muted">Searching…</p>}
              {blockResults.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {blockResults.map((u) => (
                    <li key={u._id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                      <Avatar username={u.username} size={8} />
                      <span className="flex-1 text-sm truncate">{u.username}</span>
                      <button type="button" onClick={() => blockUser(u._id)} className="text-xs text-red-400 hover:underline shrink-0">
                        Block
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {loadingBlocked ? (
                <p className="text-sm text-muted text-center py-6">Loading…</p>
              ) : blocked.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No blocked contacts</p>
              ) : (
                <ul className="space-y-2">
                  {blocked.map((u) => (
                    <li key={u._id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
                      <Avatar username={u.username} size={9} />
                      <span className="flex-1 text-sm font-medium truncate">{u.username}</span>
                      <button
                        onClick={() => unblock(u._id)}
                        className="text-xs text-cyan hover:underline shrink-0"
                      >
                        Unblock
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'appearance' && (
            <div className="grid grid-cols-2 gap-3">
              {['dark', 'light'].map((t) => (
                <button
                  key={t}
                  onClick={() => saveTheme(t)}
                  className={`rounded-xl border-2 p-4 text-sm font-medium capitalize transition-all ${
                    theme === t ? 'border-cyan bg-cyan/10 text-cyan' : 'border-border bg-card hover:border-muted'
                  }`}
                >
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              ))}
            </div>
          )}

          {tab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <p className="text-xs text-muted">Change your password while logged in.</p>
              <input
                type="password"
                placeholder="Current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="input-base !py-2.5 text-sm"
                autoComplete="current-password"
              />
              <input
                type="password"
                placeholder="New password (min 6)"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="input-base !py-2.5 text-sm"
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="input-base !py-2.5 text-sm"
                autoComplete="new-password"
              />
              <button type="submit" className="btn-primary w-full">Change password</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
