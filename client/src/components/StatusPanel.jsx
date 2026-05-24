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
  const [postError, setPostError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const fileRef = useRef(null);
  const editFileRef = useRef(null);

  const myId = user?._id?.toString?.() || user?._id;

  const loadFeed = async () => {
    try {
      const { data } = await API.get('/statuses/feed');
      setFeed(data);
    } catch {
      setPostError('Failed to load statuses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const postStatus = async (file) => {
    if (!postText.trim() && !file) {
      setPostError('Enter text or choose an image');
      return;
    }
    setPosting(true);
    setPostError('');
    try {
      const form = new FormData();
      if (postText.trim()) form.append('text', postText.trim());
      if (file) form.append('file', file);
      await API.post('/statuses', form);
      setPostText('');
      if (fileRef.current) fileRef.current.value = '';
      await loadFeed();
    } catch (e) {
      setPostError(e.response?.data?.message || 'Failed to post status');
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async (file) => {
    const post = viewing?.posts?.[viewIndex];
    if (!post) return;
    setPosting(true);
    setPostError('');
    try {
      const form = new FormData();
      form.append('text', editText.trim());
      if (file) form.append('file', file);
      await API.patch(`/statuses/${post._id}`, form);
      setEditing(false);
      await loadFeed();
      const { data } = await API.get('/statuses/feed');
      setFeed(data);
      const item = data.find((i) => i.user._id?.toString?.() === myId || i.user._id === myId);
      if (item) {
        setViewing(item);
        setViewIndex(Math.min(viewIndex, item.posts.length - 1));
      }
    } catch (e) {
      setPostError(e.response?.data?.message || 'Failed to update status');
    } finally {
      setPosting(false);
    }
  };

  const deleteStatus = async (postId) => {
    try {
      await API.delete(`/statuses/${postId}`);
      setViewing(null);
      setEditing(false);
      await loadFeed();
    } catch (e) {
      setPostError(e.response?.data?.message || 'Failed to delete status');
    }
  };

  const openViewer = async (item, index = 0) => {
    setViewing(item);
    setViewIndex(index);
    setEditing(false);
    const post = item.posts[index];
    if (post) {
      try {
        await API.post(`/statuses/${post._id}/view`);
        await loadFeed();
      } catch {/* */}
    }
  };

  const currentPost = viewing?.posts?.[viewIndex];
  const isOwnStatus = viewing?.user?._id?.toString?.() === myId || viewing?.user?._id === myId;

  const startEdit = () => {
    setEditText(currentPost?.text || '');
    setEditing(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
          <h2 className="font-semibold">Statuses</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-slate-200">✕</button>
        </div>

        <div className="p-4 border-b border-border space-y-2 shrink-0">
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Add a status update…"
            rows={2}
            className="input-base text-sm resize-none"
          />
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) postStatus(f);
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={posting} className="btn-ghost flex-1 text-xs">
              Image
            </button>
            <button
              type="button"
              onClick={() => postStatus()}
              disabled={posting || !postText.trim()}
              className="btn-primary flex-1 text-xs"
            >
              {posting ? 'Posting…' : 'Post status'}
            </button>
          </div>
          {postError && !viewing && <p className="text-red-400 text-xs">{postError}</p>}
          <p className="text-xs text-muted">Only saved contacts see your status in their feed.</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {loading ? (
            <p className="text-center text-muted text-sm py-8">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No statuses yet. Save contacts to share with them.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {feed.map((item) => (
                <button
                  key={item.user._id}
                  type="button"
                  onClick={() => openViewer(item, 0)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div className={`p-0.5 rounded-full ${item.hasUnviewed ? 'bg-gradient-to-tr from-cyan to-green-400' : 'bg-border'}`}>
                    <Avatar username={item.user.username} size={14} />
                  </div>
                  <span className="text-xs text-muted max-w-[72px] truncate">
                    {item.user._id === myId || item.user._id?.toString?.() === myId ? 'My status' : item.user.username}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {viewing && currentPost && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-6" onClick={() => { setViewing(null); setEditing(false); }}>
            <div className="max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
              <Avatar username={viewing.user.username} size={12} className="mx-auto mb-3" />
              <p className="text-sm font-semibold mb-4">{viewing.user.username}</p>

              {editing ? (
                <div className="space-y-3 mb-4 text-left">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="input-base text-sm w-full resize-none"
                  />
                  <input
                    ref={editFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) saveEdit(f);
                    }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editFileRef.current?.click()} className="btn-ghost flex-1 text-xs">
                      New image
                    </button>
                    <button type="button" onClick={() => saveEdit()} disabled={posting} className="btn-primary flex-1 text-xs">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {currentPost.mediaUrl && currentPost.mediaType === 'image' && (
                    <img src={currentPost.mediaUrl} alt="" className="rounded-xl max-h-64 mx-auto mb-4 object-contain" />
                  )}
                  {currentPost.text && <p className="text-slate-200 mb-6">{currentPost.text}</p>}
                </>
              )}

              {postError && viewing && <p className="text-red-400 text-xs mb-3">{postError}</p>}

              <div className="flex gap-2 justify-center flex-wrap">
                {viewIndex > 0 && (
                  <button type="button" onClick={() => openViewer(viewing, viewIndex - 1)} className="btn-ghost text-xs">
                    Prev
                  </button>
                )}
                {viewIndex < viewing.posts.length - 1 && (
                  <button type="button" onClick={() => openViewer(viewing, viewIndex + 1)} className="btn-ghost text-xs">
                    Next
                  </button>
                )}
                {isOwnStatus && !editing && (
                  <>
                    <button type="button" onClick={startEdit} className="btn-ghost text-xs">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteStatus(currentPost._id)}
                      className="btn-ghost text-xs text-red-400"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button type="button" onClick={() => { setViewing(null); setEditing(false); }} className="btn-primary text-xs">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
