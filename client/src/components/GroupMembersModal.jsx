import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';

export default function GroupMembersModal({ groupId, groupName, onClose, onGroupUpdated }) {
  const { user: me, API } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState(null);
  const [blockLoading, setBlockLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get(`/groups/${groupId}`);
      setGroup(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [groupId]);

  const handleBlock = async (memberId) => {
    if (memberId === me._id) return;
    if (!window.confirm('Block this contact? They will not be able to message you.')) return;
    setBlockLoading(memberId);
    try {
      await API.post(`/users/block/${memberId}`);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to block');
    } finally {
      setBlockLoading(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <div
          className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{groupName || group?.name || 'Group'}</h2>
              <p className="text-xs text-muted">{group?.members?.length || 0} members</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-card text-muted">✕</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {loading ? (
              <p className="text-sm text-muted text-center py-8">Loading members…</p>
            ) : error && !group ? (
              <p className="text-red-400 text-sm text-center py-8">{error}</p>
            ) : (
              <ul className="space-y-2">
                {group?.members?.map((m) => {
                  const isMe = m._id === me._id || m._id?.toString?.() === me._id;
                  return (
                    <li
                      key={m._id}
                      className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
                    >
                      <Avatar username={m.username} size={9} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.username}
                          {isMe && <span className="text-muted text-xs ml-1">(you)</span>}
                        </p>
                        <p className="text-xs text-muted truncate">{m.phone || m.status || '—'}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setProfileUserId(m._id)}
                          className="text-xs text-cyan hover:underline"
                        >
                          View
                        </button>
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => handleBlock(m._id)}
                            disabled={blockLoading === m._id}
                            className="text-xs text-red-400 hover:underline"
                          >
                            {blockLoading === m._id ? '…' : 'Block'}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {error && group && <p className="text-red-400 text-xs mt-2 px-1">{error}</p>}
          </div>

          <div className="p-3 border-t border-border shrink-0">
            <p className="text-xs text-muted text-center">
              Block from here or open a chat → profile → Block. Manage all blocked contacts in Settings → Blocked.
            </p>
          </div>
        </div>
      </div>

      {profileUserId && (
        <ProfileModal
          userId={profileUserId}
          isOwn={profileUserId === me._id}
          onClose={() => setProfileUserId(null)}
          onBlocked={() => {
            setProfileUserId(null);
            onGroupUpdated?.();
          }}
        />
      )}
    </>
  );
}
