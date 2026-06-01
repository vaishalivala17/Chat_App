const mongoose = require('mongoose');

function dmQuery(myId, otherId) {
  const me = myId instanceof mongoose.Types.ObjectId ? myId : new mongoose.Types.ObjectId(myId);
  const other = otherId instanceof mongoose.Types.ObjectId ? otherId : new mongoose.Types.ObjectId(otherId);
  const now = new Date();

  return {
    $and: [
      {
        $or: [
          { sender: me, receiver: other },
          { sender: other, receiver: me },
        ],
      },
      { $or: [{ group: null }, { group: { $exists: false } }] },
      { deleted: false },
      { deletedFor: { $nin: [me] } },
      {
        $or: [
          { disappearsAt: null },
          { disappearsAt: { $exists: false } },
          { disappearsAt: { $gt: now } },
        ],
      },
    ],
  };
}

function conversationMatch(myId) {
  const me = myId instanceof mongoose.Types.ObjectId ? myId : new mongoose.Types.ObjectId(myId);
  const now = new Date();

  return {
    $or: [{ sender: me }, { receiver: me }],
    deleted: false,
    $or: [
      { group: null },
      { group: { $exists: false } },
    ],
    deletedFor: { $nin: [me] },
    $and: [
      {
        $or: [
          { disappearsAt: null },
          { disappearsAt: { $exists: false } },
          { disappearsAt: { $gt: now } },
        ],
      },
    ],
  };
}

module.exports = { dmQuery, conversationMatch };
