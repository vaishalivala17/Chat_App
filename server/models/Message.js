const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    content: { type: String, default: '' },
    messageType: {
      type: String,
      enum: ['text', 'voice', 'video', 'image'],
      default: 'text',
    },
    mediaUrl: { type: String, default: '' },
    mediaDuration: { type: Number, default: 0 },
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    disappearsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ disappearsAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
