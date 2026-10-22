/**
 * config/prisma.js
 * Singleton Prisma client shared across the application.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
