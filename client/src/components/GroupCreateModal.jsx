import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function GroupCreateModal({ onClose, onCreated }) {
  const { API } = useAuth();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    try {
      const { data } = await API.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch {/* */}
  };

  const toggle = (u) => {
    setSelected((prev) =>
      prev.some((x) => x._id === u._id) ? prev.filter((x) => x._id !== u._id) : [...prev, u]
    );
  };

  const create = async () => {
    if (!name.trim()) { setErr('Group name required'); return; }
    setLoading(true);
    setErr('');
    try {
      const { data } = await API.post('/groups', {
        name: name.trim(),
        memberIds: selected.map((u) => u._id),
      });
      onCreated?.(data);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold">Create group</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="input-base text-sm"
        />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); doSearch(e.target.value); }}
          placeholder="Search members to add"
          className="input-base text-sm"
        />
        {selected.length > 0 && (
          <p className="text-xs text-muted">{selected.length} member(s) selected</p>
        )}
        <ul className="max-h-40 overflow-y-auto space-y-1">
          {results.map((u) => (
            <li key={u._id}>
              <button
                type="button"
                onClick={() => toggle(u)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selected.some((s) => s._id === u._id) ? 'bg-cyan/15 text-cyan' : 'hover:bg-card'
                }`}
              >
                {u.username} {selected.some((s) => s._id === u._id) ? '✓' : ''}
              </button>
            </li>
          ))}
        </ul>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={create} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
