const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: { type: String, default: '', trim: true },
    bio: { type: String, default: '', maxlength: 200 },
    status: { type: String, default: 'Hey there! I am using PULSE.', maxlength: 120 },
    avatarUrl: { type: String, default: '' },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    savedContacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    settings: {
      showOnlineStatus: { type: Boolean, default: true },
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
      chatLockEnabled: { type: Boolean, default: false },
      chatLockPinHash: { type: String, default: '' },
      defaultDisappearingSeconds: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.methods.toPublicJSON = function (viewerId = null) {
  const base = {
    _id: this._id,
    username: this.username,
    email: this.email,
    phone: this.phone,
    bio: this.bio,
    status: this.status,
    avatarUrl: this.avatarUrl,
    createdAt: this.createdAt,
    settings: {
      showOnlineStatus: this.settings?.showOnlineStatus ?? true,
      theme: this.settings?.theme ?? 'dark',
      defaultDisappearingSeconds: this.settings?.defaultDisappearingSeconds ?? 0,
      chatLockEnabled: this.settings?.chatLockEnabled ?? false,
    },
  };
  if (viewerId && viewerId.toString() === this._id.toString()) {
    base.settings.chatLockEnabled = this.settings?.chatLockEnabled ?? false;
  }
  return base;
};

module.exports = mongoose.model('User', userSchema);
