const Message = require('../models/Message');

/** User IDs the current user has an active DM thread with (plus self). */
async function getContactUserIds(myId, blockedIds = []) {
  const oid = myId;
  const blocked = new Set(blockedIds.map((id) => id.toString()));

  const [senders, receivers] = await Promise.all([
    Message.distinct('sender', {
      $or: [{ sender: oid }, { receiver: oid }],
      group: { $exists: false },
      deleted: false,
    }),
    Message.distinct('receiver', {
      $or: [{ sender: oid }, { receiver: oid }],
      group: { $exists: false },
      deleted: false,
      receiver: { $ne: null },
    }),
  ]);

  const ids = new Set([oid.toString()]);
  for (const id of [...senders, ...receivers]) {
    const s = id?.toString?.();
    if (s && s !== oid.toString() && !blocked.has(s)) ids.add(s);
  }
  return [...ids];
}

module.exports = { getContactUserIds };
