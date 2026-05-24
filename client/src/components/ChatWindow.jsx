import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import Avatar from './Avatar';
import MessageInput from './MessageInput';
import ProfileModal from './ProfileModal';
import { format } from 'date-fns';
import { sortMessages, groupByDate } from '../utils/messages';

export default function ChatWindow({ targetUserId, onOpenSidebar, onChatDeleted }) {
  const { user, API }                       = useAuth();
  const { onEvent, sendMessage, markRead, isOnline, connected } = useSocket();

  const [messages,     setMessages]     = useState([]);
  const [targetUser,   setTargetUser]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [typingUsers,  setTypingUsers]  = useState([]);
  const [showProfile,  setShowProfile]  = useState(false);
  const [sendError,    setSendError]    = useState('');
  const [selectMode,   setSelectMode]   = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [chatDisappear, setChatDisappear] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);

  const disappearingDefault = user?.settings?.defaultDisappearingSeconds ?? 0;
  const myId = user?._id?.toString?.() || user?._id;

  const bottomRef = useRef(null);
  const listRef   = useRef(null);

  /* Load target user info */
  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, blockRes] = await Promise.all([
          API.get(`/users/${targetUserId}`),
          API.get(`/users/${targetUserId}/block-status`),
        ]);
        setTargetUser(userRes.data);
        setBlocked(blockRes.data.blocked);
        if (userRes.data.isSavedContact) {
          try {
            const { data: st } = await API.get(`/statuses/active/${targetUserId}`);
            setHasActiveStory(st.hasActive);
          } catch {
            setHasActiveStory(false);
          }
        } else {
          setHasActiveStory(false);
        }
      } catch {/* */}
    };
    load();
    const saved = localStorage.getItem(`disappear_${targetUserId}`);
    setChatDisappear(saved ? Number(saved) : 0);
    setSelectMode(false);
    setSelected(new Set());
  }, [targetUserId, API]);

  /* Load message history */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const { data } = await API.get(`/messages/${targetUserId}`);
        if (!cancelled) setMessages(data);
      } catch {/* */}
      finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [targetUserId, API]);

  /* Scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers.length]);

  /* Socket events */
  useEffect(() => {
    if (!connected) return;

    const offReceive = onEvent('message:receive', (msg) => {
      if (
        msg.sender._id === targetUserId ||
        msg.sender._id?.toString() === targetUserId
      ) {
        setMessages(prev => [...prev, msg]);
        markRead(targetUserId, [user._id, targetUserId].sort().join('_'));
      }
    });

    const offSent = onEvent('message:sent', (msg) => {
      const receiverId = msg.receiver?.toString?.() || msg.receiver?._id?.toString?.() || msg.receiver;
      if (receiverId !== targetUserId && receiverId?.toString?.() !== targetUserId) return;

      setMessages((prev) => {
        const idx = prev.findLastIndex((m) => m._optimistic);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = msg;
          return next;
        }
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    const offDelivered = onEvent('message:delivered', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, delivered: true } : m))
      );
    });

    const offTypingStart = onEvent('typing:start', ({ userId }) => {
      if (userId === targetUserId) {
        setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    });

    const offTypingStop = onEvent('typing:stop', ({ userId }) => {
      if (userId === targetUserId) {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      }
    });

    const offRead = onEvent('message:read', ({ readBy, room }) => {
      const activeRoom = [user._id, targetUserId].sort().join('_');
      if (readBy !== targetUserId || room !== activeRoom) return;
      setMessages((prev) =>
        prev.map((m) =>
          (m.sender._id === user._id || m.sender._id?.toString?.() === user._id)
            ? { ...m, read: true, delivered: true }
            : m
        )
      );
    });

    const offError = onEvent('message:error', ({ message }) => {
      setSendError(message || 'Failed to send message');
      setTimeout(() => setSendError(''), 4000);
    });

    return () => {
      offReceive?.();
      offSent?.();
      offDelivered?.();
      offTypingStart?.();
      offTypingStop?.();
      offRead?.();
      offError?.();
    };
  }, [targetUserId, onEvent, markRead, user._id, connected]);

  /* Mark messages as read when conversation changes or updates */
  useEffect(() => {
    if (!targetUserId || !messages.length) return;
    markRead(targetUserId, [user._id, targetUserId].sort().join('_'));
  }, [targetUserId, messages.length, markRead, user._id]);

  const handleSend = useCallback((payload) => {
    const { content, messageType = 'text', mediaUrl = '', mediaDuration = 0 } = payload;
    if (!content?.trim() && !mediaUrl) return;

    const optimistic = {
      _id:       `opt_${Date.now()}`,
      _optimistic: true,
      sender:    { _id: user._id, username: user.username },
      receiver:  targetUserId,
      content:   content || (messageType === 'voice' ? 'Voice message' : 'Video'),
      messageType,
      mediaUrl,
      mediaDuration,
      createdAt: new Date().toISOString(),
      delivered: false,
      read:      false,
    };

    setMessages(prev => [...prev, optimistic]);
    const ttl = chatDisappear || disappearingDefault;
    sendMessage(targetUserId, content || '', { messageType, mediaUrl, mediaDuration, disappearingSeconds: ttl });
  }, [sendMessage, targetUserId, user, chatDisappear, disappearingDefault]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePin = async (msg) => {
    const pinned = msg.pinnedBy?.some((id) => id.toString?.() === myId || id === myId);
    try {
      if (pinned) {
        await API.delete(`/messages/${msg._id}/pin`);
      } else {
        await API.post(`/messages/${msg._id}/pin`);
      }
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== msg._id) return m;
          const list = m.pinnedBy || [];
          return {
            ...m,
            pinnedBy: pinned
              ? list.filter((id) => (id.toString?.() || id) !== myId)
              : [...list, myId],
          };
        })
      );
    } catch {/* */}
  };

  const deleteChat = async () => {
    if (!targetUserId) return;
    if (!window.confirm(`Delete entire chat with ${targetUser?.username || 'this user'}? Starred messages are kept.`)) return;
    try {
      await API.delete(`/messages/conversation/${targetUserId}`);
      setMessages([]);
      onChatDeleted?.();
    } catch {
      setSendError('Failed to delete chat');
      setTimeout(() => setSendError(''), 4000);
    }
  };

  const toggleBlock = async () => {
    try {
      if (blocked) {
        await API.delete(`/users/block/${targetUserId}`);
        setBlocked(false);
      } else {
        await API.post(`/users/block/${targetUserId}`);
        setBlocked(true);
        onChatDeleted?.();
      }
    } catch {
      setSendError(blocked ? 'Failed to unblock' : 'Failed to block');
      setTimeout(() => setSendError(''), 4000);
    }
  };

  const toggleStar = async (msg) => {
    const starred = msg.starredBy?.some((id) => id.toString() === myId || id === myId);
    try {
      if (starred) {
        await API.delete(`/messages/${msg._id}/star`);
      } else {
        await API.post(`/messages/${msg._id}/star`);
      }
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== msg._id) return m;
          const list = m.starredBy || [];
          return {
            ...m,
            starredBy: starred
              ? list.filter((id) => (id.toString?.() || id) !== myId)
              : [...list, myId],
          };
        })
      );
    } catch {/* */}
  };

  const deleteSelected = async (forEveryone = false) => {
    const ids = [...selected].filter((id) => !id.startsWith('opt_'));
    if (!ids.length) { setSelectMode(false); setSelected(new Set()); return; }
    try {
      await API.post('/messages/bulk-delete', { messageIds: ids, forEveryone });
      setMessages((prev) =>
        forEveryone
          ? prev.map((m) => (ids.includes(m._id) ? { ...m, deleted: true, content: '' } : m))
          : prev.filter((m) => !ids.includes(m._id))
      );
    } catch {/* */}
    setSelectMode(false);
    setSelected(new Set());
  };

  const sorted = useMemo(() => sortMessages(messages, myId), [messages, myId]);
  const grouped = useMemo(() => groupByDate(sorted), [sorted]);

  const headerSubtitle = () => {
    if (typingUsers.length > 0) {
      return <span className="text-cyan animate-pulse">typing…</span>;
    }
    if (isOnline(targetUser._id, targetUser.showOnlineStatus !== false)) {
      return 'Online';
    }
    if (targetUser.isSavedContact && targetUser.status) {
      return targetUser.status;
    }
    return 'Offline';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-surface flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-card text-muted-hi mr-1"
        >
          <MenuIcon />
        </button>

        {targetUser ? (
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
          >
            <div className="relative">
              <Avatar username={targetUser.username} size={10} />
              {hasActiveStory && (
                <span className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-cyan to-green-400 -z-10" />
              )}
              {isOnline(targetUser._id, targetUser.showOnlineStatus !== false) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-surface" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{targetUser.username}</p>
              <p className="text-xs text-muted truncate">{headerSubtitle()}</p>
            </div>
          </button>
        ) : (
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full bg-card animate-pulse" />
            <div className="h-3 w-28 bg-card rounded animate-pulse" />
          </div>
        )}
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={deleteChat}
            className="p-2 rounded-lg hover:bg-card text-muted hover:text-red-400 text-xs"
            title="Delete chat"
          >
            🗑
          </button>
          <button
            type="button"
            onClick={toggleBlock}
            className={`p-2 rounded-lg hover:bg-card text-xs ${blocked ? 'text-cyan' : 'text-muted hover:text-red-400'}`}
            title={blocked ? 'Unblock' : 'Block'}
          >
            {blocked ? '⊘' : '⊗'}
          </button>
          <button
            type="button"
            onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}
            className="p-2 rounded-lg hover:bg-card text-muted text-xs"
            title="Select messages"
          >
            ☑
          </button>
          <select
            value={chatDisappear}
            onChange={(e) => {
              const v = Number(e.target.value);
              setChatDisappear(v);
              localStorage.setItem(`disappear_${targetUserId}`, String(v));
            }}
            className="text-xs bg-card border border-border rounded-lg px-2 py-1 text-muted"
            title="Disappearing messages"
          >
            <option value={0}>Disappear: off</option>
            <option value={60}>1 min</option>
            <option value={300}>5 min</option>
            <option value={3600}>1 hr</option>
            <option value={86400}>24 hr</option>
          </select>
        </div>
      </div>

      {selectMode && (
        <div className="shrink-0 px-4 py-2 bg-card border-b border-border flex items-center gap-2 text-xs">
          <span className="text-muted">{selected.size} selected</span>
          <button onClick={() => deleteSelected(false)} className="btn-ghost !py-1 !px-2">Delete for me</button>
          <button onClick={() => deleteSelected(true)} className="btn-ghost !py-1 !px-2 text-red-400">Delete for all</button>
          <button onClick={() => { setSelectMode(false); setSelected(new Set()); }} className="ml-auto text-cyan">Cancel</button>
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {loading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted text-sm">
            <span className="text-3xl">👋</span>
            <p>Start the conversation with <strong className="text-slate-300">{targetUser?.username}</strong></p>
          </div>
        ) : (
          grouped.map(({ dateLabel, msgs }) => (
            <div key={dateLabel}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-mono text-muted px-2">{dateLabel}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {/* Messages in this group */}
              {msgs.map((msg, i) => {
                const isMine   = msg.sender._id === user._id || msg.sender._id?.toString() === user._id;
                const prevMsg  = msgs[i - 1];
                const isChained = prevMsg && prevMsg.sender._id === msg.sender._id;
                const isStarred = msg.starredBy?.some((id) => id.toString?.() === myId || id === myId);
                const isPinned = msg.pinnedBy?.some((id) => id.toString?.() === myId || id === myId);
                return (
                  <MessageBubble
                    key={msg._id}
                    message={msg}
                    isMine={isMine}
                    isChained={isChained}
                    targetUsername={targetUser?.username}
                    selectMode={selectMode}
                    selected={selected.has(msg._id)}
                    isStarred={isStarred}
                    isPinned={isPinned}
                    onToggleSelect={() => toggleSelect(msg._id)}
                    onToggleStar={() => toggleStar(msg)}
                    onTogglePin={() => togglePin(msg)}
                  />
                );
              })}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-end gap-2 animate-fade-in">
            <Avatar username={targetUser?.username} size={7} />
            <div className="bg-panel border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {sendError && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20">{sendError}</div>
      )}
      <MessageInput
        targetUserId={targetUserId}
        onSend={handleSend}
        disappearingSeconds={chatDisappear || disappearingDefault}
      />

      {showProfile && (
        <ProfileModal
          userId={targetUserId}
          isOwn={false}
          onClose={() => setShowProfile(false)}
          onBlocked={() => {
            setShowProfile(false);
            window.history.back();
          }}
        />
      )}
    </div>
  );
}

function MessageBubble({
  message, isMine, isChained, targetUsername,
  selectMode, selected, isStarred, isPinned, onToggleSelect, onToggleStar, onTogglePin,
}) {
  const deleted = message.deleted;
  const type = message.messageType || 'text';
  const mediaSrc = message.mediaUrl
    ? (message.mediaUrl.startsWith('http') ? message.mediaUrl : message.mediaUrl)
    : '';

  return (
    <div
      className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''} ${isChained ? 'mt-0.5' : 'mt-3'} animate-fade-in ${selected ? 'ring-1 ring-cyan rounded-lg' : ''}`}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      {selectMode && (
        <input type="checkbox" checked={selected} readOnly className="shrink-0 accent-cyan" />
      )}
      <div className="w-7 shrink-0">
        {!isMine && !isChained && (
          <Avatar username={targetUsername} size={7} className="text-xs" />
        )}
      </div>

      <div className={`max-w-[70%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        <div
          className={`
            relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed
            ${isMine
              ? 'bg-[#1e3a4a] text-slate-100 rounded-br-sm'
              : 'bg-panel text-slate-200 rounded-bl-sm border border-border'}
            ${message._optimistic ? 'opacity-70' : ''}
            ${deleted ? 'italic text-muted' : ''}
          `}
        >
          {deleted ? (
            '🗑 This message was deleted'
          ) : type === 'voice' && mediaSrc ? (
            <audio controls src={mediaSrc} className="max-w-full h-8" preload="metadata" />
          ) : type === 'video' && mediaSrc ? (
            <video controls src={mediaSrc} className="max-w-full rounded-lg max-h-60" preload="metadata" />
          ) : type === 'image' && mediaSrc ? (
            <img src={mediaSrc} alt="Shared" className="max-w-full rounded-lg max-h-60" />
          ) : (
            message.content
          )}
        </div>

        <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
          {isPinned && <span className="text-xs text-cyan" title="Pinned">📌</span>}
          {!selectMode && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className="text-xs text-muted hover:text-cyan" title={isPinned ? 'Unpin' : 'Pin'}>
                {isPinned ? '📌' : '📍'}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggleStar?.(); }} className="text-xs text-muted hover:text-yellow-400" title={isStarred ? 'Unstar' : 'Star'}>
                {isStarred ? '★' : '☆'}
              </button>
            </>
          )}
          {message.disappearsAt && (
            <span className="text-xs text-muted" title="Disappearing">⏱</span>
          )}
          <span className="text-xs font-mono text-muted">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
          {isMine && (
            <span className={`text-xs ${message.read ? 'text-cyan' : 'text-muted'}`}>
              {message._optimistic
                ? '⏳'
                : message.read
                  ? '✓✓'
                  : message.delivered
                    ? '✓✓'
                    : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-card animate-pulse shrink-0" />
          <div
            className={`h-10 bg-card rounded-2xl animate-pulse ${i % 2 === 0 ? 'bg-card/50' : ''}`}
            style={{ width: `${120 + (i * 27) % 120}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
