const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Message = require('../models/Message');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { dmQuery, dmPairQuery } = require('../utils/messageQuery');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(audio|video|image)\//.test(file.mimetype);
    cb(null, allowed);
  },
});

router.use(authMiddleware);

async function isBlocked(userId, otherId) {
  const user = await User.findById(userId).select('blockedUsers');
  if (!user) return false;
  return user.blockedUsers.some((id) => id.toString() === otherId.toString());
}

function messageFilter(myId) {
  const now = new Date();
  return {
    deleted: false,
    deletedFor: { $ne: myId },
    $or: [{ disappearsAt: null }, { disappearsAt: { $gt: now } }],
  };
}

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const mediaUrl = `/uploads/${req.file.filename}`;
  let messageType = 'text';
  if (req.file.mimetype.startsWith('audio/')) messageType = 'voice';
  else if (req.file.mimetype.startsWith('video/')) messageType = 'video';
  else if (req.file.mimetype.startsWith('image/')) messageType = 'image';

  res.json({ mediaUrl, messageType, filename: req.file.filename });
});

router.get('/starred', async (req, res) => {
  try {
    const myId = req.user._id;
    const now = new Date();
    const messages = await Message.find({
      starredBy: myId,
      deleted: false,
      $or: [{ disappearsAt: null }, { disappearsAt: { $exists: false } }, { disappearsAt: { $gt: now } }],
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('sender', 'username _id')
      .populate('receiver', 'username _id');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load starred messages' });
  }
});

router.delete('/conversation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (await isBlocked(myId, userId) || await isBlocked(userId, myId)) {
      return res.status(403).json({ message: 'Cannot delete this conversation' });
    }

    const result = await Message.updateMany(
      {
        ...dmPairQuery(myId, userId),
        starredBy: { $nin: [myId] },
      },
      { $addToSet: { deletedFor: myId } }
    );

    res.json({ message: 'Chat deleted', count: result.modifiedCount });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ message: 'Failed to delete chat' });
  }
});

router.post('/bulk-delete', async (req, res) => {
  try {
    const { messageIds = [], forEveryone = false } = req.body;
    if (!messageIds.length) {
      return res.status(400).json({ message: 'No messages selected' });
    }

    const messages = await Message.find({ _id: { $in: messageIds } });
    const myId = req.user._id.toString();

    for (const msg of messages) {
      const isSender = msg.sender.toString() === myId;
      if (forEveryone && isSender) {
        msg.deleted = true;
        msg.content = '';
        await msg.save();
      } else {
        if (!msg.deletedFor.some((id) => id.toString() === myId)) {
          msg.deletedFor.push(req.user._id);
        }
        await msg.save();
      }
    }

    res.json({ message: 'Messages deleted', count: messages.length });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Failed to delete messages' });
  }
});

router.post('/:messageId/star', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const myId = req.user._id.toString();
    const idx = msg.starredBy.findIndex((id) => id.toString() === myId);
    if (idx === -1) {
      msg.starredBy.push(req.user._id);
    }
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Failed to star message' });
  }
});

router.delete('/:messageId/star', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    msg.starredBy = msg.starredBy.filter((id) => id.toString() !== req.user._id.toString());
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Failed to unstar message' });
  }
});

router.post('/:messageId/pin', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const myId = req.user._id.toString();
    if (!msg.pinnedBy.some((id) => id.toString() === myId)) {
      msg.pinnedBy.push(req.user._id);
    }
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Failed to pin message' });
  }
});

router.delete('/:messageId/pin', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    msg.pinnedBy = msg.pinnedBy.filter((id) => id.toString() !== req.user._id.toString());
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Failed to unpin message' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;

    if (await isBlocked(myId, userId) || await isBlocked(userId, myId)) {
      return res.status(403).json({ message: 'Cannot access this conversation' });
    }

    const messages = await Message.find(dmQuery(myId, userId))
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'username _id');

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ message: 'Failed to load messages' });
  }
});

router.delete('/:messageId', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const myId = req.user._id.toString();
    if (msg.sender.toString() === myId) {
      msg.deleted = true;
      msg.content = '';
    } else {
      if (!msg.deletedFor.some((id) => id.toString() === myId)) {
        msg.deletedFor.push(req.user._id);
      }
    }
    await msg.save();

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

module.exports = router;
