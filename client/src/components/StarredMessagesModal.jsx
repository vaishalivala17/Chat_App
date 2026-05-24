import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

export default function StarredMessagesModal({ onClose }) {
  const { user, API } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const myId = user?._id?.toString?.() || user?._id;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/messages/starred');
      setMessages(data);
    } catch {/* */}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, []);

  const unstar = async (msg) => {
    try {
      await API.delete(`/messages/${msg._id}/star`);
      setMessages((prev) => prev.filter((m) => m._id !== msg._id));
    } catch {/* */}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
          <h2 className="font-semibold">Starred messages</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-slate-200">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {loading ? (
            <p className="text-center text-muted text-sm py-8">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No starred messages yet.</p>
          ) : (
            <ul className="space-y-2">
              {messages.map((msg) => {
                const peer =
                  msg.sender?._id?.toString?.() === myId || msg.sender?._id === myId
                    ? msg.receiver
                    : msg.sender;
                const peerName = peer?.username || 'Chat';
                return (
                  <li key={msg._id} className="bg-card border border-border rounded-xl p-3">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="text-xs text-cyan font-medium">{peerName}</span>
                      <button
                        type="button"
                        onClick={() => unstar(msg)}
                        className="text-xs text-yellow-400 hover:underline shrink-0"
                      >
                        Unstar
                      </button>
                    </div>
                    <p className="text-sm text-slate-200 break-words">{msg.content || '(media)'}</p>
                    <p className="text-xs text-muted mt-1">
                      {format(new Date(msg.createdAt), 'MMM d, HH:mm')}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
