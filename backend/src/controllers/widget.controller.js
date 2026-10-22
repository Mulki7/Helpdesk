/**
 * controllers/widget.controller.js
 * Handles customer widget requests.
 */

import * as widgetService from '../services/widget.service.js';

export async function createSession(req, res, next) {
  try {
    const session = await widgetService.getOrCreateSession(req.body);
    res.json({ data: session });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(req, res, next) {
  try {
    const visitorToken = req.headers['x-visitor-token'];
    const conversation = await widgetService.getConversation(visitorToken, req.query);
    res.json({ data: conversation });
  } catch (err) {
    next(err);
  }
}
