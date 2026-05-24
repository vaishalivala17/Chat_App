const mongoose = require('mongoose');

const statusPostSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '', maxlength: 500 },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['text', 'image'], default: 'text' },
    expiresAt: { type: Date, required: true },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

statusPostSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
statusPostSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('StatusPost', statusPostSchema);
