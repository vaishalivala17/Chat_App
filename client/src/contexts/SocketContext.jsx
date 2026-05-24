import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
import { SOCKET_URL } from '../utils/constants';

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('users:online', (ids) => setOnlineUsers(Array.isArray(ids) ? ids : []));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  const sendMessage = useCallback((receiverId, content, extras = {}) => {
    socketRef.current?.emit('message:send', {
      receiverId,
      content,
      messageType: extras.messageType || 'text',
      mediaUrl: extras.mediaUrl || '',
      mediaDuration: extras.mediaDuration || 0,
      disappearingSeconds: extras.disappearingSeconds ?? 0,
    });
  }, []);

  const sendGroupMessage = useCallback((groupId, content, extras = {}) => {
    socketRef.current?.emit('message:send', {
      groupId,
      content,
      messageType: extras.messageType || 'text',
      mediaUrl: extras.mediaUrl || '',
      mediaDuration: extras.mediaDuration || 0,
      disappearingSeconds: extras.disappearingSeconds ?? 0,
    });
  }, []);

  const sendTypingStart = useCallback((target, isGroup = false) => {
    if (isGroup) {
      socketRef.current?.emit('typing:start', { groupId: target });
    } else {
      socketRef.current?.emit('typing:start', { receiverId: target });
    }
  }, []);

  const sendTypingStop = useCallback((target, isGroup = false) => {
    if (isGroup) {
      socketRef.current?.emit('typing:stop', { groupId: target });
    } else {
      socketRef.current?.emit('typing:stop', { receiverId: target });
    }
  }, []);

  const markRead = useCallback((senderId, room) => {
    socketRef.current?.emit('message:read', { senderId, room });
  }, []);

  const updatePresence = useCallback((showOnlineStatus) => {
    socketRef.current?.emit('settings:presence', { showOnlineStatus });
  }, []);

  const onEvent = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, []);

  const isOnline = useCallback(
    (userId, contactAllowsOnline = true) =>
      contactAllowsOnline !== false && onlineUsers.includes(userId?.toString?.() || userId),
    [onlineUsers]
  );

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        onlineUsers,
        isOnline,
        sendMessage,
        sendGroupMessage,
        sendTypingStart,
        sendTypingStop,
        markRead,
        updatePresence,
        onEvent,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
