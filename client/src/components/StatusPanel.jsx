import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

export default function StatusPanel({ onClose }) {
  const { user, API } = useAuth();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  const loadFeed = async () => {
    try {
      const { data } = await API.get('/statuses/feed');
      setFeed(data);
    } catch {/* */}
    finally { setLoading(false); }
  };

  useEffect(() => { loadFeed(); }, []);

  const postStatus = async (file) => {
    setPosting(true);
    try {
      const form = new FormData();
      if (postText.trim()) form.append('text', postText.trim());
      if (file) form.append('file', file);
      await API.post('/statuses', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPostText('');
      await loadFeed();
    } catch {/* */}
    finally { setPosting(false); }
  };

  const openViewer = async (item, index = 0) => {
    setViewing(item);
    setViewIndex(index);
    const post = item.posts[index];
    if (post) {
      try {
        await API.post(`/statuses/${post._id}/view`);
        await loadFeed();
      } catch {/* */}
    }
  };

  const currentPost = viewing?.posts?.[viewIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="font-semibold">Statuses</h2>
          <button onClick={onClose} className="text-muted hover:text-slate-200">✕</button>
        </div>

        <div className="p-4 border-b border-border space-y-2">
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Add a status update…"
            rows={2}
            className="input-base text-sm resize-none"
          />
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => postStatus(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={posting} className="btn-ghost flex-1 text-xs">📷 Image</button>
            <button onClick={() => postStatus()} disabled={posting || !postText.trim()} className="btn-primary flex-1 text-xs">
              {posting ? 'Posting…' : 'Post status'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-center text-muted text-sm py-8">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No statuses yet. Post one or add contacts!</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {feed.map((item) => (
                <button
                  key={item.user._id}
                  onClick={() => openViewer(item, 0)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div className={`p-0.5 rounded-full ${item.hasUnviewed ? 'bg-gradient-to-tr from-cyan to-green-400' : 'bg-border'}`}>
                    <Avatar username={item.user.username} size={14} />
                  </div>
                  <span className="text-xs text-muted max-w-[72px] truncate">{item.user.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {viewing && currentPost && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-6" onClick={() => setViewing(null)}>
            <div className="max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
              <Avatar username={viewing.user.username} size={12} className="mx-auto mb-3" />
              <p className="text-sm font-semibold mb-4">{viewing.user.username}</p>
              {currentPost.mediaUrl && currentPost.mediaType === 'image' && (
                <img src={currentPost.mediaUrl} alt="" className="rounded-xl max-h-64 mx-auto mb-4" />
              )}
              {currentPost.text && <p className="text-slate-200 mb-6">{currentPost.text}</p>}
              <div className="flex gap-2 justify-center">
                {viewIndex > 0 && (
                  <button onClick={() => openViewer(viewing, viewIndex - 1)} className="btn-ghost text-xs">Prev</button>
                )}
                {viewIndex < viewing.posts.length - 1 && (
                  <button onClick={() => openViewer(viewing, viewIndex + 1)} className="btn-ghost text-xs">Next</button>
                )}
                <button onClick={() => setViewing(null)} className="btn-primary text-xs">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
