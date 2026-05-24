const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    avatarUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

groupSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    members: this.members,
    admins: this.admins,
    createdBy: this.createdBy,
    avatarUrl: this.avatarUrl,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Group', groupSchema);
