// Seed a demo admin account used by the admin dashboard.
//
// The admin dashboard (frontend /admin) lets a presenter flip between the
// help-seeker, volunteer, and organization views from one login. It signs in
// through the normal /api/auth/login path, so it needs a real user row whose
// role is "admin". We can't create this through signup (that path rejects the
// "admin" role and enforces a 12-char password policy), so we seed it directly
// here with the same password hashing the app uses.
//
// Usage (from backend/):  node prisma/seedAdmin.js
//
// Safe to re-run: it upserts by email, so running it again just refreshes the
// admin's password/role rather than creating duplicates.
//
// NOTE: credentials are intentionally simple ("admin" / "admin") for demoing.
// This account is for local/demo use only — do not seed it in production.

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../services/auth/authService.js';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = 'admin';

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: 'admin', name: 'Admin' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Admin',
      role: 'admin',
      location: 'Demo',
    },
  });

  console.log(`Seeded admin account: ${admin.email} (password: "${ADMIN_PASSWORD}")`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
