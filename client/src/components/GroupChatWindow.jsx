import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import MessageInput from './MessageInput';
import GroupMembersModal from './GroupMembersModal';
import { groupByDate } from '../utils/messages';

export default function GroupChatWindow({ groupId, onOpenSidebar }) {
  const { user, API } = useAuth();
  const { onEvent, sendGroupMessage, connected } = useSocket();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef(null);
  const disappearing = user?.settings?.defaultDisappearingSeconds ?? 0;

  useEffect(() => {
    API.get('/groups/mine').then(({ data }) => {
      const g = data.find((x) => x._id === groupId);
      setGroup(g);
    }).catch(() => {});
  }, [groupId, API]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await API.get(`/groups/${groupId}/messages`);
        setMessages(data);
      } catch {/* */}
      finally { setLoading(false); }
    };
    load();
  }, [groupId, API]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!connected) return;
    const off = onEvent('group:message:receive', ({ groupId: gid, message }) => {
      if (gid === groupId) setMessages((prev) => [...prev, message]);
    });
    const offSent = onEvent('message:sent', (msg) => {
      const gid = msg.group?._id?.toString?.() || msg.group?.toString?.();
      if (gid === groupId) {
        setMessages((prev) => {
          const idx = prev.findLastIndex((m) => m._optimistic);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = msg;
            return next;
          }
          return [...prev, msg];
        });
      }
    });
    return () => { off?.(); offSent?.(); };
  }, [groupId, connected, onEvent]);

  const handleSend = useCallback((payload) => {
    const { content, messageType = 'text', mediaUrl = '', mediaDuration = 0, disappearingSeconds = 0 } = payload;
    if (!content?.trim() && !mediaUrl) return;
    const optimistic = {
      _id: `opt_${Date.now()}`,
      _optimistic: true,
      sender: { _id: user._id, username: user.username },
      group: groupId,
      content: content || 'Media',
      messageType,
      mediaUrl,
      mediaDuration,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    sendGroupMessage(groupId, content || '', { messageType, mediaUrl, mediaDuration, disappearingSeconds });
  }, [groupId, sendGroupMessage, user]);

  const grouped = useMemo(() => groupByDate(messages), [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-border bg-surface flex items-center gap-3">
        <button onClick={onOpenSidebar} className="lg:hidden p-2 rounded-lg hover:bg-card text-muted-hi">
          <MenuIcon />
        </button>
        <button
          type="button"
          onClick={() => setShowMembers(true)}
          className="flex-1 min-w-0 text-left hover:opacity-90"
        >
          <p className="font-semibold text-sm">{group?.name || 'Group'}</p>
          <p className="text-xs text-muted">{group?.members?.length || 0} members — tap for details</p>
        </button>
      </div>

      {showMembers && (
        <GroupMembersModal
          groupId={groupId}
          groupName={group?.name}
          onClose={() => setShowMembers(false)}
          onGroupUpdated={() => {
            API.get('/groups/mine').then(({ data }) => {
              setGroup(data.find((x) => x._id === groupId));
            }).catch(() => {});
          }}
        />
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-muted text-sm text-center">Loading…</p>
        ) : (
          grouped.map(({ dateLabel, msgs }) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-mono text-muted">{dateLabel}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {msgs.map((msg) => {
                const isMine = msg.sender._id === user._id || msg.sender._id?.toString() === user._id;
                const type = msg.messageType || 'text';
                const mediaSrc = msg.mediaUrl || '';
                return (
                  <div key={msg._id} className={`mb-2 ${isMine ? 'text-right' : ''}`}>
                    {!isMine && <p className="text-xs text-cyan mb-0.5">{msg.sender.username}</p>}
                    <div className={`inline-block px-4 py-2 rounded-2xl text-sm ${isMine ? 'bg-[#1e3a4a]' : 'bg-panel border border-border'}`}>
                      {type === 'image' && mediaSrc ? (
                        <img src={mediaSrc} alt="" className="max-h-48 rounded-lg" />
                      ) : type === 'video' && mediaSrc ? (
                        <video controls src={mediaSrc} className="max-h-48 rounded-lg" />
                      ) : type === 'voice' && mediaSrc ? (
                        <audio controls src={mediaSrc} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <MessageInput groupId={groupId} onSend={handleSend} disappearingSeconds={disappearing} />
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
