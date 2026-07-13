import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client.
 *
 * Purpose: create ONE database connection for the whole app and reuse it
 * everywhere, instead of calling `new PrismaClient()` in every file.
 * Opening many connections can exhaust the database, so a single shared
 * instance is the recommended pattern.
 *
 * Any file that needs the database can now do:
 *   import prisma from '../database/prisma.js';
 */
const prisma = new PrismaClient();

export default prisma;
