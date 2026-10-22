/**
 * events/eventBus.js
 * Decoupled event emitter for publishing application events
 * (such as ticket updates or user deactivations) without direct dependencies on Socket.IO.
 */

import EventEmitter from 'node:events';

class AppEventBus extends EventEmitter {}

export const eventBus = new AppEventBus();
export default eventBus;
