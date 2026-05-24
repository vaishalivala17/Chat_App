const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }],
    });
    if (existing) {
      return res.status(409).json({ message: 'Email or username already in use' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      phone: phone?.trim() || '',
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({ token, user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    res.json({ message: 'Password changed successfully. Please sign in.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user.toPublicJSON(req.user._id) });
});

router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const {
      showOnlineStatus,
      theme,
      chatLockEnabled,
      chatLockPin,
      defaultDisappearingSeconds,
    } = req.body;

    if (!user.settings) user.settings = {};

    if (showOnlineStatus !== undefined) {
      user.settings.showOnlineStatus = Boolean(showOnlineStatus);
    }
    if (theme !== undefined && ['dark', 'light'].includes(theme)) {
      user.settings.theme = theme;
    }
    if (defaultDisappearingSeconds !== undefined) {
      const allowed = [0, 60, 300, 3600, 86400];
      user.settings.defaultDisappearingSeconds = allowed.includes(Number(defaultDisappearingSeconds))
        ? Number(defaultDisappearingSeconds)
        : 0;
    }
    if (chatLockEnabled !== undefined) {
      user.settings.chatLockEnabled = Boolean(chatLockEnabled);
    }
    if (chatLockPin !== undefined) {
      if (chatLockPin === '') {
        user.settings.chatLockPinHash = '';
        user.settings.chatLockEnabled = false;
      } else if (/^\d{4,6}$/.test(chatLockPin)) {
        user.settings.chatLockPinHash = await bcrypt.hash(chatLockPin, 10);
        user.settings.chatLockEnabled = true;
      } else {
        return res.status(400).json({ message: 'PIN must be 4-6 digits' });
      }
    }

    await user.save();
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

router.post('/verify-lock', authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.settings?.chatLockEnabled || !user.settings?.chatLockPinHash) {
      return res.json({ valid: true });
    }
    const valid = await bcrypt.compare(pin || '', user.settings.chatLockPinHash);
    res.json({ valid });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed' });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, bio, status, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (username && username.trim() !== user.username) {
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: user._id } });
      if (taken) {
        return res.status(409).json({ message: 'Username already taken' });
      }
      user.username = username.trim();
    }

    if (bio !== undefined) user.bio = bio.trim().slice(0, 200);
    if (status !== undefined) user.status = status.trim().slice(0, 120);
    if (phone !== undefined) {
      const trimmed = phone.trim();
      if (trimmed && !/^[0-9]{10,15}$/.test(trimmed)) {
        return res.status(400).json({ message: 'Phone must be 10 to 15 digits' });
      }
      user.phone = trimmed;
    }

    await user.save();
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;
