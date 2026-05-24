const express = require('express');
const path = require('path');
const multer = require('multer');
const StatusPost = require('../models/StatusPost');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const uploadsDir = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    cb(null, `status-${Date.now()}${path.extname(file.originalname) || '.jpg'}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function getSavedContactIds(myId) {
  const me = await User.findById(myId).select('savedContacts blockedUsers');
  const blocked = new Set(me.blockedUsers.map((id) => id.toString()));
  const ids = me.savedContacts
    .map((id) => id.toString())
    .filter((id) => !blocked.has(id));
  ids.push(myId.toString());
  return ids;
}

router.get('/feed', async (req, res) => {
  try {
    const myId = req.user._id;
    const allowedIds = await getSavedContactIds(myId);

    const now = new Date();
    const posts = await StatusPost.find({
      user: { $in: allowedIds },
      expiresAt: { $gt: now },
    })
      .populate('user', 'username _id avatarUrl')
      .sort({ createdAt: -1 });

    const byUser = {};
    for (const post of posts) {
      const uid = post.user._id.toString();
      if (!byUser[uid]) {
        byUser[uid] = { user: post.user, posts: [], hasUnviewed: false };
      }
      byUser[uid].posts.push(post);
      if (!post.viewers.some((v) => v.toString() === myId.toString())) {
        byUser[uid].hasUnviewed = true;
      }
    }

    res.json(Object.values(byUser));
  } catch (err) {
    console.error('Status feed error:', err);
    res.status(500).json({ message: 'Failed to load statuses' });
  }
});

router.get('/active/:userId', async (req, res) => {
  try {
    const now = new Date();
    const count = await StatusPost.countDocuments({
      user: req.params.userId,
      expiresAt: { $gt: now },
    });
    res.json({ hasActive: count > 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check status' });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let mediaUrl = '';
    let mediaType = 'text';
    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
      mediaType = 'image';
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ message: 'Status text or image required' });
    }

    const post = await StatusPost.create({
      user: req.user._id,
      text,
      mediaUrl,
      mediaType,
      expiresAt,
      viewers: [req.user._id],
    });

    const populated = await StatusPost.findById(post._id).populate('user', 'username _id');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create status error:', err);
    res.status(500).json({ message: 'Failed to post status' });
  }
});

router.patch('/:statusId', upload.single('file'), async (req, res) => {
  try {
    const post = await StatusPost.findById(req.params.statusId);
    if (!post) return res.status(404).json({ message: 'Status not found' });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    if (req.body.text !== undefined) {
      post.text = (req.body.text || '').trim();
    }
    if (req.file) {
      post.mediaUrl = `/uploads/${req.file.filename}`;
      post.mediaType = 'image';
    }

    if (!post.text && !post.mediaUrl) {
      return res.status(400).json({ message: 'Status text or image required' });
    }

    await post.save();
    const populated = await StatusPost.findById(post._id).populate('user', 'username _id');
    res.json(populated);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

router.post('/:statusId/view', async (req, res) => {
  try {
    const post = await StatusPost.findById(req.params.statusId);
    if (!post) return res.status(404).json({ message: 'Status not found' });

    const myId = req.user._id.toString();
    if (!post.viewers.some((v) => v.toString() === myId)) {
      post.viewers.push(req.user._id);
      await post.save();
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark viewed' });
  }
});

router.delete('/:statusId', async (req, res) => {
  try {
    const post = await StatusPost.findById(req.params.statusId);
    if (!post) return res.status(404).json({ message: 'Status not found' });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    await post.deleteOne();
    res.json({ message: 'Status deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete status' });
  }
});

module.exports = router;
