import { format, isToday, isYesterday } from 'date-fns';

/** Pin current user's messages at the top of the thread. */
export function sortMessages(msgs, myId) {
  const pinned = [];
  const rest = [];
  for (const m of msgs) {
    const isPinned = m.pinnedBy?.some((id) => id.toString?.() === myId || id === myId);
    if (isPinned) pinned.push(m);
    else rest.push(m);
  }
  return [...pinned, ...rest];
}

export function groupByDate(messages) {
  const groups = new Map();
  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    let label;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else label = format(date, 'MMMM d, yyyy');

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(msg);
  }
  return Array.from(groups.entries()).map(([dateLabel, msgs]) => ({ dateLabel, msgs }));
}

export function isStarredBy(msg, myId) {
  return msg.starredBy?.some((id) => id.toString?.() === myId || id === myId);
}

export function isPinnedBy(msg, myId) {
  return msg.pinnedBy?.some((id) => id.toString?.() === myId || id === myId);
}

export function dmRoomId(userA, userB) {
  return [userA, userB].sort().join('_');
}
