import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import StatusPanel from './StatusPanel';
import GroupCreateModal from './GroupCreateModal';
import StarredMessagesModal from './StarredMessagesModal';
import { formatDistanceToNow } from 'date-fns';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

export default function Sidebar({ activeUserId, activeGroupId, onSelectUser, onSelectGroup, onClose, convoRefresh = 0 }) {
  const { user, logout, API } = useAuth();
  const { isOnline, onEvent, connected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [phoneQuery,    setPhoneQuery]    = useState('');
  const [phoneError,    setPhoneError]    = useState('');
  const [myQrDataUrl,   setMyQrDataUrl]   = useState('');
  const [showMyQr,      setShowMyQr]      = useState(false);
  const [scanOpen,      setScanOpen]      = useState(false);
  const [scanError,     setScanError]     = useState('');
  const [showProfile,   setShowProfile]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showStatus,    setShowStatus]    = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showStarred,     setShowStarred]     = useState(false);
  const [groups,        setGroups]        = useState([]);

  const searchTimer = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

  /* Load conversations */
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await API.get('/users/conversations');
      setConversations(data);
    } catch {/* silent */}
    finally { setLoadingConvos(false); }
  }, [API]);

  useEffect(() => { loadConversations(); }, [loadConversations, convoRefresh]);

  const loadGroups = useCallback(async () => {
    try {
      const { data } = await API.get('/groups/mine');
      setGroups(data);
    } catch {/* */}
  }, [API]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  /* Debounced search */
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await API.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      } catch {/* */}
      finally { setSearching(false); }
    }, 350);
  }, [searchQuery, API]);

  const handleSelect = (u) => {
    setSearchQuery('');
    setSearchResults([]);
    onSelectUser(u);
    // Optimistically add to conversations if not already there.
    // If already there, mark unread as seen immediately.
    setConversations(prev => {
      const existing = prev.find(c => c.user._id === u._id);
      if (existing) {
        return prev.map((c) => (c.user._id === u._id ? { ...c, unread: 0 } : c));
      }
      return [{ user: u, lastMessage: null, unread: 0 }, ...prev];
    });
  };

  useEffect(() => {
    if (!connected) return;

    const offReceive = onEvent('message:receive', (msg) => {
      const senderId = msg?.sender?._id?.toString?.() || msg?.sender?.toString?.();
      if (!senderId || senderId === user?._id) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.user._id === senderId);
        const isActiveChat = activeUserId === senderId;
        if (idx === -1) {
          const senderUser = msg?.sender?._id ? msg.sender : { _id: senderId, username: 'New user' };
          return [
            {
              user: senderUser,
              lastMessage: msg,
              unread: isActiveChat ? 0 : 1,
            },
            ...prev,
          ];
        }

        const next = [...prev];
        const item = next[idx];
        next[idx] = {
          ...item,
          lastMessage: msg,
          unread: isActiveChat ? 0 : (item.unread || 0) + 1,
        };
        const [updated] = next.splice(idx, 1);
        next.unshift(updated);
        return next;
      });
    });

    const offRead = onEvent('message:read', ({ readBy }) => {
      // If recipient read our sent messages, clear their unread badge in our list.
      if (!readBy) return;
      setConversations((prev) =>
        prev.map((c) => (c.user._id === readBy ? { ...c, unread: 0 } : c))
      );
    });

    return () => {
      offReceive?.();
      offRead?.();
    };
  }, [onEvent, user?._id, activeUserId, connected]);

  const displayList = searchQuery.trim()
    ? searchResults.map(u => ({ user: u, lastMessage: null, unread: 0 }))
    : conversations;

  const handleAddByPhone = async () => {
    setPhoneError('');
    const phone = phoneQuery.trim();
    if (!/^[0-9]{10,15}$/.test(phone)) {
      setPhoneError('Enter a valid 10-15 digit phone number');
      return;
    }
    try {
      const { data } = await API.get(`/users/by-phone/${encodeURIComponent(phone)}`);
      try {
        await API.post(`/users/contacts/${data._id}`);
      } catch {/* may already be saved */}
      handleSelect(data);
      setPhoneQuery('');
    } catch (err) {
      setPhoneError(err.response?.data?.message || 'Could not find user');
    }
  };

  const openMyQr = async () => {
    try {
      const payload = `chatapp:user:${user?._id}`;
      const dataUrl = await QRCode.toDataURL(payload, { width: 220, margin: 1 });
      setMyQrDataUrl(dataUrl);
      setShowMyQr(true);
    } catch {
      setPhoneError('Failed to generate QR');
    }
  };

  const stopScanner = useCallback(() => {
    if (scanTimerRef.current) {
      cancelAnimationFrame(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanOpen(false);
  }, []);

  const handleQrPayload = useCallback(async (payload) => {
    if (!payload?.startsWith('chatapp:user:')) return false;
    const userId = payload.replace('chatapp:user:', '').trim();
    if (!userId || userId === user?._id) {
      setScanError('Invalid QR code');
      return true;
    }
    try {
      const { data } = await API.get(`/users/${encodeURIComponent(userId)}`);
      handleSelect(data);
      stopScanner();
      return true;
    } catch {
      setScanError('User not found for this QR');
      return true;
    }
  }, [API, user?._id, stopScanner]);

  const startScanner = () => {
    setScanError('');
    setScanOpen(true);
  };

  useEffect(() => {
    if (!scanOpen) return;

    let cancelled = false;

    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = async () => {
          if (cancelled || !videoRef.current || !ctx) return;
          const video = videoRef.current;
          if (video.readyState >= 2) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code?.data) {
              const consumed = await handleQrPayload(code.data);
              if (consumed) return;
            }
          }
          scanTimerRef.current = requestAnimationFrame(scanFrame);
        };

        scanTimerRef.current = requestAnimationFrame(scanFrame);
      } catch {
        if (!cancelled) {
          setScanError('Camera access denied or unavailable');
          setScanOpen(false);
        }
      }
    };

    const t = setTimeout(run, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
      stopScanner();
    };
  }, [scanOpen, handleQrPayload, stopScanner]);

  useEffect(() => () => stopScanner(), [stopScanner]);

  return (
    <div className="w-full h-full bg-surface border-r border-border flex flex-col">

      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition-opacity"
        >
          <div className="relative">
            <Avatar username={user?.username} size={9} />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-surface" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.username}</p>
            <p className="text-xs text-muted truncate">{user?.status || user?.email}</p>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowStatus(true)} title="Statuses" className="p-2 rounded-lg hover:bg-card text-muted text-sm">◎</button>
          <button onClick={() => setShowSettings(true)} title="Settings" className="p-2 rounded-lg hover:bg-card text-muted text-sm">⚙</button>
          <button
            onClick={logout}
            title="Sign out"
            className="p-2 rounded-lg hover:bg-card text-muted hover:text-red-400 transition-colors"
          >
            <LogoutIcon />
          </button>
          <button onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-card text-muted">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Scrollable body: search, tools, groups, chats */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
      <div className="p-3 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search users…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base !py-2.5 pl-9 pr-4 text-sm"
          />

          {searching && (
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 shrink-0 border-b border-border space-y-2.5">
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="Add by phone number"
            value={phoneQuery}
            onChange={(e) => setPhoneQuery(e.target.value.replace(/\s+/g, ''))}
            className="input-base !py-2.5 text-sm"
          />
          <button type="button" onClick={handleAddByPhone} className="btn-ghost !px-3 !py-2.5 text-xs">Add</button>
        </div>
        {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={openMyQr} className="btn-ghost flex-1 !py-2 text-xs min-w-[80px]">My QR</button>
          <button type="button" onClick={startScanner} className="btn-ghost flex-1 !py-2 text-xs min-w-[80px]">Scan QR</button>
          <button type="button" onClick={() => setShowStarred(true)} className="btn-ghost flex-1 !py-2 text-xs min-w-[80px]">★ Starred</button>
        </div>
      </div>

      <div className="px-3 pb-2 shrink-0 flex gap-2">
        <button type="button" onClick={() => setShowGroupCreate(true)} className="btn-ghost flex-1 !py-2 text-xs">+ New group</button>
      </div>

      {groups.length > 0 && (
        <div className="px-4 pb-1 shrink-0">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted">Groups</p>
        </div>
      )}
      {groups.length > 0 && (
        <div className="px-1 pb-2 shrink-0">
          {groups.map((g) => (
            <button
              key={g._id}
              type="button"
              onClick={() => onSelectGroup?.(g)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm mx-1 ${
                activeGroupId === g._id ? 'bg-cyan/10 border border-cyan/20 text-cyan' : 'hover:bg-card'
              }`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              👥 {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pb-2 shrink-0">
        <p className="text-xs font-semibold tracking-widest uppercase text-muted">
          {searchQuery ? 'Search Results' : 'Messages'}
        </p>
      </div>

      <div className="flex-1 min-h-[120px]">
        {loadingConvos && !searchQuery ? (
          <SkeletonList />
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted text-sm gap-2 px-4 text-center">
            {searchQuery ? (
              <>
                <span className="text-2xl">🔍</span>
                <p>No users found for "{searchQuery}"</p>
              </>
            ) : (
              <>
                <span className="text-2xl">💬</span>
                <p>No conversations yet.<br/>Search for someone to start chatting!</p>
              </>
            )}
          </div>
        ) : (
          displayList.map(({ user: u, lastMessage, unread }) => (
            <ConvoItem
              key={u._id}
              user={u}
              lastMessage={lastMessage}
              unread={unread}
              isActive={activeUserId === u._id}
              isOnline={isOnline(u._id, u.showOnlineStatus !== false)}
              onSelect={() => handleSelect(u)}
            />
          ))
        )}
      </div>
      </div>

      <p className="shrink-0 px-3 py-2 text-[10px] text-muted text-center border-t border-border">
        Block/unblock: Settings → Blocked or chat profile
      </p>

      {showMyQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowMyQr(false)}>
          <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col items-center gap-3 max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm">My QR code</h3>
            <img src={myQrDataUrl} alt="My chat QR code" className="w-52 h-52 rounded-lg bg-white p-2" />
            <p className="text-xs text-muted text-center">Let others scan to start a chat with you</p>
            <button type="button" onClick={() => setShowMyQr(false)} className="btn-primary w-full text-sm">Close</button>
          </div>
        </div>
      )}

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={stopScanner}>
          <div className="bg-surface border border-border rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm">Scan QR code</h3>
            <video ref={videoRef} className="w-full rounded-lg bg-black/50 max-h-[50vh]" muted playsInline />
            <p className="text-xs text-muted">Point camera at a chat QR code</p>
            {scanError && <p className="text-xs text-red-400">{scanError}</p>}
            <button type="button" onClick={stopScanner} className="btn-ghost w-full text-sm">Close</button>
          </div>
        </div>
      )}

      {showProfile && (
        <ProfileModal userId={user?._id} isOwn onClose={() => setShowProfile(false)} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showStatus && <StatusPanel onClose={() => setShowStatus(false)} />}
      {showGroupCreate && (
        <GroupCreateModal
          onClose={() => setShowGroupCreate(false)}
          onCreated={(g) => { loadGroups(); onSelectGroup?.(g); }}
        />
      )}
      {showStarred && <StarredMessagesModal onClose={() => setShowStarred(false)} />}
    </div>
  );
}

function ConvoItem({ user, lastMessage, unread, isActive, isOnline: online, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-3 px-3 py-3 mx-1 rounded-xl
        text-left transition-all duration-150
        ${isActive ? 'bg-cyan/10 border border-cyan/20' : 'hover:bg-card border border-transparent'}
      `}
      style={{ width: 'calc(100% - 8px)' }}
    >
      <div className="relative shrink-0">
        <Avatar username={user.username} size={10} />
        {online && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-surface" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-cyan' : ''}`}>
            {user.username}
          </p>
          {lastMessage && (
            <span className="text-xs text-muted shrink-0">
              {formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-muted truncate">
            {lastMessage
              ? (lastMessage.deleted
                ? '🗑 Message deleted'
                : lastMessage.messageType === 'voice'
                  ? '🎤 Voice message'
                  : lastMessage.messageType === 'video'
                    ? '🎬 Video'
                    : lastMessage.content)
              : (online ? 'Online' : 'Tap to chat')}
          </p>
          {unread > 0 && (
            <span className="shrink-0 min-w-5 h-5 bg-cyan text-base text-xs font-bold rounded-full flex items-center justify-center px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-1 px-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-card animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 bg-card rounded animate-pulse w-2/3" />
            <div className="h-2.5 bg-card rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Icons */
function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
