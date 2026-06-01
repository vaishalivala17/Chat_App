import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import GroupChatWindow from '../components/GroupChatWindow';
import ChatLockScreen from '../components/ChatLockScreen';
import { useAuth } from '../contexts/AuthContext';

export default function ChatPage() {
  const { userId, groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locked, setLocked] = useState(false);

  const isGroupRoute = location.pathname.startsWith('/group/');

  useEffect(() => {
    const needsLock = user?.settings?.chatLockEnabled;
    const unlocked = sessionStorage.getItem('chat_unlocked') === '1';
    setLocked(Boolean(needsLock && !unlocked));
  }, [user?.settings?.chatLockEnabled]);

  const handleSelectUser = (u) => {
    navigate(`/${u._id}`);
    setSidebarOpen(false);
  };

  const handleSelectGroup = (g) => {
    navigate(`/group/${g._id}`);
    setSidebarOpen(false);
  };

  if (locked) {
    return <ChatLockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="h-full flex bg-base overflow-hidden">
      <div className={`
        fixed inset-y-0 left-0 z-40 w-80
        lg:relative lg:flex lg:w-80
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          activeUserId={!isGroupRoute ? userId : null}
          activeGroupId={isGroupRoute ? groupId : null}
          onSelectUser={handleSelectUser}
          onSelectGroup={handleSelectGroup}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {isGroupRoute && groupId ? (
          <GroupChatWindow key={groupId} groupId={groupId} onOpenSidebar={() => setSidebarOpen(true)} />
        ) : userId ? (
          <ChatWindow key={userId} targetUserId={userId} onOpenSidebar={() => setSidebarOpen(true)} />
        ) : (
          <EmptyState onOpenSidebar={() => setSidebarOpen(true)} username={user?.username} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onOpenSidebar, username }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8 relative">
      <button onClick={onOpenSidebar} className="lg:hidden absolute top-4 left-4 p-2 rounded-lg hover:bg-surface text-muted-hi">
        <MenuIcon />
      </button>
      <div className="w-20 h-20 rounded-3xl bg-surface border border-border flex items-center justify-center text-4xl">💬</div>
      <div>
        <h2 className="text-xl font-semibold mb-1">Hey, {username}!</h2>
        <p className="text-muted text-sm max-w-xs leading-relaxed">
          Select a chat, open Statuses, create a group, or open Settings from the sidebar.
        </p>
      </div>
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
