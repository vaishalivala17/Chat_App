import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

export default function ProfileModal({ userId, isOwn, onClose, onBlocked }) {
  const { user: me, API, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(isOwn);
  const [form, setForm] = useState({ username: '', bio: '', status: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [savedContact, setSavedContact] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (isOwn) {
          const { data } = await API.get('/auth/me');
          setProfile(data.user);
          setForm({
            username: data.user.username || '',
            bio: data.user.bio || '',
            status: data.user.status || '',
            phone: data.user.phone || '',
          });
        } else {
          const [userRes, blockRes] = await Promise.all([
            API.get(`/users/${userId}`),
            API.get(`/users/${userId}/block-status`),
          ]);
          setProfile(userRes.data);
          setBlocked(blockRes.data.blocked);
          setSavedContact(Boolean(userRes.data.isSavedContact));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, isOwn, API]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await API.put('/auth/profile', form);
      setProfile(data.user);
      await refreshUser();
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContact = async () => {
    setContactLoading(true);
    setError('');
    try {
      if (savedContact) {
        await API.delete(`/users/contacts/${userId}`);
        setSavedContact(false);
        setProfile((p) => (p ? { ...p, isSavedContact: false } : p));
      } else {
        await API.post(`/users/contacts/${userId}`);
        setSavedContact(true);
        setProfile((p) => (p ? { ...p, isSavedContact: true } : p));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update contact');
    } finally {
      setContactLoading(false);
    }
  };

  const handleBlock = async () => {
    setBlockLoading(true);
    setError('');
    try {
      if (blocked) {
        await API.delete(`/users/block/${userId}`);
        setBlocked(false);
      } else {
        await API.post(`/users/block/${userId}`);
        setBlocked(true);
        onBlocked?.();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setBlockLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">{isOwn ? 'My Profile' : 'Contact Profile'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-card text-muted">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-card animate-pulse" />
              <div className="h-4 w-32 bg-card rounded animate-pulse" />
            </div>
          ) : error && !profile ? (
            <p className="text-red-400 text-sm text-center">{error}</p>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3">
                <Avatar username={profile?.username} size={16} />
                {!editing && (
                  <>
                    <h3 className="text-lg font-semibold">{profile?.username}</h3>
                    <p className="text-sm text-muted text-center">{profile?.status}</p>
                  </>
                )}
              </div>

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}

              {isOwn && editing ? (
                <div className="space-y-3">
                  <Field label="Username" value={form.username} onChange={(v) => setForm((p) => ({ ...p, username: v }))} />
                  <Field label="Status" value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} />
                  <Field label="Bio" value={form.bio} onChange={(v) => setForm((p) => ({ ...p, bio: v }))} multiline />
                  <Field label="Phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v.replace(/\s+/g, '') }))} />
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                      {saving ? 'Saving…' : 'Save Profile'}
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-ghost flex-1">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <InfoRow label="Email" value={isOwn ? profile?.email : 'Hidden'} />
                  <InfoRow label="Phone" value={profile?.phone || 'Not set'} />
                  <InfoRow label="Bio" value={profile?.bio || 'No bio yet'} />
                  <InfoRow label="Member since" value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'} />

                  {isOwn ? (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setEditing(true)} className="btn-primary flex-1">Edit Profile</button>
                      <button onClick={logout} className="btn-ghost flex-1 text-red-400">Sign Out</button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted text-center">
                        Save contact to see their profile status and 24h stories. Block/unblock in Settings → Blocked.
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveContact}
                        disabled={contactLoading}
                        className="w-full py-3 rounded-xl text-sm font-medium border border-cyan/30 text-cyan hover:bg-cyan/10 transition-colors"
                      >
                        {contactLoading ? 'Please wait…' : savedContact ? 'Remove from contacts' : 'Save contact'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBlock}
                        disabled={blockLoading}
                        className={`w-full py-3 rounded-xl text-sm font-medium border transition-colors ${
                          blocked
                            ? 'border-border text-muted-hi hover:bg-card'
                            : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        }`}
                      >
                        {blockLoading ? 'Please wait…' : blocked ? 'Unblock Contact' : 'Block Contact'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  const cls = 'input-base !py-2.5 text-sm';
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-hi">{label}</label>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <p className="text-xs text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-slate-200 break-words">{value}</p>
    </div>
  );
}
