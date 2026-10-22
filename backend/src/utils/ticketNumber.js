/**
 * utils/ticketNumber.js
 * Ticket number is not stored in DB. It is derived from the ticket id.
 * Example: id 7 → "HD-0007"
 */

/**
 * @param {number} id
 * @returns {string}
 */
export function formatTicketNumber(id) {
  return `HD-${String(id).padStart(4, '0')}`;
}
