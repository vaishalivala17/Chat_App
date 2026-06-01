const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

async function isBlocked(userId, otherId) {
  const user = await User.findById(userId).select('blockedUsers');
  if (!user) return false;
  return user.blockedUsers.some((id) => id.toString() === otherId.toString());
}

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const me = await User.findById(req.user._id).select('blockedUsers');
    const blockedIds = me.blockedUsers.map((id) => id.toString());

    const users = await User.find({
      _id: { $ne: req.user._id, $nin: blockedIds },
      username: { $regex: q, $options: 'i' },
    })
      .select('-password')
      .limit(20);

    res.json(users.map((u) => u.toPublicJSON()));
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('blockedUsers');
    const blockedIds = me.blockedUsers.map((id) => id.toString());

    const users = await User.find({
      _id: { $ne: req.user._id, $nin: blockedIds },
    })
      .select('-password')
      .sort({ username: 1 })
      .limit(50);

    res.json(users.map((u) => u.toPublicJSON()));
  } catch (err) {
    console.error('Suggestions error:', err);
    res.status(500).json({ message: 'Failed to load users' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const myId = req.user._id;
    const me = await User.findById(myId).select('blockedUsers');
    const blockedIds = me.blockedUsers.map((id) => id.toString());

    const pipeline = [
      {
        $match: {
          $or: [{ sender: myId }, { receiver: myId }],
          deleted: false,
          group: { $exists: false },
          deletedFor: { $ne: myId },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', myId] },
              '$receiver',
              '$sender',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unread: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', myId] },
                    { $eq: ['$read', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $limit: 50 },
    ];

    const groups = await Message.aggregate(pipeline);

    const userIds = groups
      .map((g) => g._id?.toString())
      .filter((id) => id && !blockedIds.includes(id));

    const users = await User.find({ _id: { $in: userIds } }).select('-password');
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const conversations = groups
      .filter((g) => userMap[g._id?.toString()])
      .map((g) => ({
        user: userMap[g._id.toString()].toPublicJSON(),
        lastMessage: g.lastMessage,
        unread: g.unread,
      }));

    res.json(conversations);
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ message: 'Failed to load conversations' });
  }
});

router.get('/by-phone/:phone', async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    if (!/^[0-9]{10,15}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const target = await User.findOne({ phone }).select('-password');
    if (!target) {
      return res.status(404).json({ message: 'No user found with this phone number' });
    }

    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    if (await isBlocked(req.user._id, target._id)) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    if (await isBlocked(target._id, req.user._id)) {
      return res.status(403).json({ message: 'This user is not available' });
    }

    res.json(target.toPublicJSON());
  } catch (err) {
    console.error('By-phone error:', err);
    res.status(500).json({ message: 'Lookup failed' });
  }
});

router.get('/blocked', async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate('blockedUsers', '-password');
    res.json(me.blockedUsers.map((u) => u.toPublicJSON()));
  } catch (err) {
    console.error('Blocked list error:', err);
    res.status(500).json({ message: 'Failed to load blocked users' });
  }
});

router.post('/block/:userId', async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    const me = await User.findById(req.user._id);
    const already = me.blockedUsers.some((id) => id.toString() === targetId);
    if (!already) {
      me.blockedUsers.push(targetId);
      await me.save();
    }

    res.json({ message: 'User blocked', blocked: true });
  } catch (err) {
    console.error('Block error:', err);
    res.status(500).json({ message: 'Failed to block user' });
  }
});

router.delete('/block/:userId', async (req, res) => {
  try {
    const targetId = req.params.userId;
    const me = await User.findById(req.user._id);
    me.blockedUsers = me.blockedUsers.filter((id) => id.toString() !== targetId);
    await me.save();
    res.json({ message: 'User unblocked', blocked: false });
  } catch (err) {
    console.error('Unblock error:', err);
    res.status(500).json({ message: 'Failed to unblock user' });
  }
});

router.get('/:id/block-status', async (req, res) => {
  try {
    const targetId = req.params.id;
    const blocked = await isBlocked(req.user._id, targetId);
    res.json({ blocked });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check block status' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select('-password');
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (await isBlocked(req.user._id, target._id)) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    const json = target.toPublicJSON();
    json.showOnlineStatus = target.settings?.showOnlineStatus ?? true;
    res.json(json);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

module.exports = router;
