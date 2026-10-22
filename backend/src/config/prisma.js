/**
 * config/prisma.js
 * Singleton Prisma client shared across the application.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export default prisma;

