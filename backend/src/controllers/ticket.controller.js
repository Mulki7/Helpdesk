/**
 * controllers/ticket.controller.js
 * Handles HTTP requests for tickets. Contains no business logic or database queries.
 */

import * as ticketService from '../services/ticket.service.js';

export async function listTickets(req, res, next) {
  try {
    const result = await ticketService.getTickets({
      ...req.query,
      user: req.user,
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await ticketService.getTicketById(ticketId);
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function getTicketMessages(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const messages = await ticketService.getTicketMessages(ticketId, req.query);
    res.json({ data: messages });
  } catch (err) {
    next(err);
  }
}

export async function claimTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await ticketService.claimTicket(ticketId, req.user);
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function releaseTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await ticketService.releaseTicket(ticketId, req.user);
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function assignTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const { agentId } = req.body;
    const ticket = await ticketService.assignTicket(ticketId, agentId, req.user);
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await ticketService.updateTicket(ticketId, req.body, req.user);
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
}
