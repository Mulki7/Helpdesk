/**
 * services/presence.service.js
 * Tracks staff presence and broadcasts `presence:update` to customers.
 */

// userId -> Set<socketId>
const staffSocketMap = new Map();

/**
 * Returns true if at least one staff socket is currently connected.
 * @returns {boolean}
 */
export function hasStaffOnline() {
  return staffSocketMap.size > 0;
}

/**
 * Register a connected staff socket.
 * If status changes from offline to online, broadcast to all customer sockets.
 * @param {import('socket.io').Server} io
 * @param {number} userId
 * @param {string} socketId
 */
export function registerStaffSocket(io, userId, socketId) {
  const previouslyOnline = hasStaffOnline();

  if (!staffSocketMap.has(userId)) {
    staffSocketMap.set(userId, new Set());
  }
  staffSocketMap.get(userId).add(socketId);

  const currentlyOnline = hasStaffOnline();
  if (!previouslyOnline && currentlyOnline) {
    broadcastPresence(io, true);
  }
}

/**
 * Unregister a disconnected staff socket.
 * If status changes from online to offline, broadcast to all customer sockets.
 * @param {import('socket.io').Server} io
 * @param {number} userId
 * @param {string} socketId
 */
export function unregisterStaffSocket(io, userId, socketId) {
  const previouslyOnline = hasStaffOnline();

  if (staffSocketMap.has(userId)) {
    const socketSet = staffSocketMap.get(userId);
    socketSet.delete(socketId);
    if (socketSet.size === 0) {
      staffSocketMap.delete(userId);
    }
  }

  const currentlyOnline = hasStaffOnline();
  if (previouslyOnline && !currentlyOnline) {
    broadcastPresence(io, false);
  }
}

/**
 * Broadcast presence status to all customer sockets in the 'customers' room.
 * @param {import('socket.io').Server} io
 * @param {boolean} agentsOnline
 */
export function broadcastPresence(io, agentsOnline) {
  io.to('customers').emit('presence:update', { agentsOnline });
}

/**
 * Send the current presence status to a newly connected customer socket.
 * @param {import('socket.io').Socket} socket
 */
export function sendInitialPresence(socket) {
  socket.emit('presence:update', { agentsOnline: hasStaffOnline() });
}
