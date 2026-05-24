require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const statusRoutes = require('./routes/statuses');

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/statuses', statusRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const onlineUsers = new Map();

function buildPresenceList() {
  const visible = [];
  for (const [userId, meta] of onlineUsers.entries()) {
    if (meta.showOnline) visible.push(userId);
  }
  return visible;
}

function broadcastPresence() {
  io.emit('users:online', buildPresenceList());
}

async function isBlocked(userId, otherId) {
  const user = await User.findById(userId).select('blockedUsers');
  if (!user) return false;
  return user.blockedUsers.some((id) => id.toString() === otherId.toString());
}

function calcDisappearsAt(seconds) {
  if (!seconds || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

async function cleanupDisappearingMessages() {
  try {
    const now = new Date();
    await Message.deleteMany({ disappearsAt: { $lte: now, $ne: null } });
  } catch (err) {
    console.error('Disappearing cleanup error:', err);
  }
}

setInterval(cleanupDisappearingMessages, 60 * 1000);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return next(new Error('User not found'));

    socket.user = user;
    socket.showOnline = user.settings?.showOnlineStatus !== false;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user._id.toString();
  onlineUsers.set(userId, { socketId: socket.id, showOnline: socket.showOnline });

  broadcastPresence();

  socket.on('message:send', async (payload) => {
    try {
      const {
        receiverId,
        groupId,
        content = '',
        messageType = 'text',
        mediaUrl = '',
        mediaDuration = 0,
        disappearingSeconds = 0,
      } = payload || {};

      const sender = await User.findById(userId).select('settings');
      const ttl = disappearingSeconds || sender?.settings?.defaultDisappearingSeconds || 0;
      const disappearsAt = calcDisappearsAt(ttl);

      if (groupId) {
        const group = await Group.findById(groupId);
        if (!group || !group.members.some((m) => m.toString() === userId)) {
          socket.emit('message:error', { message: 'Not a group member' });
          return;
        }

        const message = await Message.create({
          sender: userId,
          group: groupId,
          content: content.trim(),
          messageType,
          mediaUrl,
          mediaDuration,
          disappearsAt,
          delivered: true,
        });

        const populated = await Message.findById(message._id).populate('sender', 'username _id');
        socket.emit('message:sent', populated);

        for (const memberId of group.members) {
          const mid = memberId.toString();
          if (mid === userId) continue;
          const sid = onlineUsers.get(mid)?.socketId;
          if (sid) io.to(sid).emit('group:message:receive', { groupId, message: populated });
        }
        return;
      }

      if (!receiverId) return;

      if (await isBlocked(userId, receiverId)) {
        socket.emit('message:error', { message: 'You have blocked this user' });
        return;
      }

      if (await isBlocked(receiverId, userId)) {
        socket.emit('message:error', { message: 'This user is not available' });
        return;
      }

      const receiverOnline = onlineUsers.has(receiverId);

      const message = await Message.create({
        sender: userId,
        receiver: receiverId,
        content: content.trim(),
        messageType,
        mediaUrl,
        mediaDuration,
        disappearsAt,
        delivered: receiverOnline,
        read: false,
      });

      const populated = await Message.findById(message._id).populate('sender', 'username _id');

      socket.emit('message:sent', populated);

      const receiverMeta = onlineUsers.get(receiverId);
      if (receiverMeta?.socketId) {
        io.to(receiverMeta.socketId).emit('message:receive', populated);
        io.to(receiverMeta.socketId).emit('message:delivered', { messageId: populated._id });
        populated.delivered = true;
        await populated.save();
        socket.emit('message:delivered', { messageId: populated._id });
      }
    } catch (err) {
      console.error('message:send error:', err);
      socket.emit('message:error', { message: 'Failed to send message' });
    }
  });

  socket.on('settings:presence', ({ showOnlineStatus }) => {
    socket.showOnline = showOnlineStatus !== false;
    const meta = onlineUsers.get(userId);
    if (meta) {
      meta.showOnline = socket.showOnline;
      onlineUsers.set(userId, meta);
    }
    broadcastPresence();
  });

  socket.on('typing:start', ({ receiverId, groupId }) => {
    if (groupId) {
      Group.findById(groupId).then((group) => {
        if (!group) return;
        group.members.forEach((memberId) => {
          const mid = memberId.toString();
          if (mid === userId) return;
          const sid = onlineUsers.get(mid)?.socketId;
          if (sid) {
            io.to(sid).emit('typing:start', { userId, username: socket.user.username, groupId });
          }
        });
      });
      return;
    }
    const receiverMeta = onlineUsers.get(receiverId);
    if (receiverMeta?.socketId) {
      io.to(receiverMeta.socketId).emit('typing:start', {
        userId,
        username: socket.user.username,
      });
    }
  });

  socket.on('typing:stop', ({ receiverId, groupId }) => {
    if (groupId) {
      Group.findById(groupId).then((group) => {
        if (!group) return;
        group.members.forEach((memberId) => {
          const mid = memberId.toString();
          if (mid === userId) return;
          const sid = onlineUsers.get(mid)?.socketId;
          if (sid) io.to(sid).emit('typing:stop', { userId, groupId });
        });
      });
      return;
    }
    const receiverMeta = onlineUsers.get(receiverId);
    if (receiverMeta?.socketId) {
      io.to(receiverMeta.socketId).emit('typing:stop', { userId });
    }
  });

  socket.on('message:read', async ({ senderId, room }) => {
    try {
      if (!senderId) return;

      await Message.updateMany(
        { sender: senderId, receiver: userId, read: false },
        { read: true, delivered: true }
      );

      const senderMeta = onlineUsers.get(senderId);
      if (senderMeta?.socketId) {
        io.to(senderMeta.socketId).emit('message:read', { readBy: userId, room });
      }
    } catch (err) {
      console.error('message:read error:', err);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    broadcastPresence();
  });
});

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp')
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
