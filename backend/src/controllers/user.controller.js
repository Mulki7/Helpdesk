/**
 * controllers/user.controller.js
 * Reads request data, calls user service, sends response.
 * No business logic or Prisma calls here.
 */

import * as userService from '../services/user.service.js';

export async function list(req, res, next) {
  try {
    const users = await userService.listUsers();
    res.status(200).json({ data: users });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    const actorId = req.user.sub;
    const user = await userService.updateUser(targetId, actorId, req.body);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}
