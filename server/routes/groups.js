const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/mine', async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'username _id')
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (err) {
    console.error('Groups list error:', err);
    res.status(500).json({ message: 'Failed to load groups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const uniqueMembers = [...new Set([req.user._id.toString(), ...memberIds])];
    const group = await Group.create({
      name: name.trim().slice(0, 50),
      members: uniqueMembers,
      admins: [req.user._id],
      createdBy: req.user._id,
    });

    const populated = await Group.findById(group._id).populate('members', 'username _id');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

router.get('/:groupId/messages', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group || !group.members.some((m) => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const messages = await Message.find({
      group: group._id,
      deletedFor: { $ne: req.user._id },
      deleted: false,
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'username _id');

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load group messages' });
  }
});

module.exports = router;
