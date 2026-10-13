// Creates the admin account, or resets its password, without touching other data.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...] npm run admin:create
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrateur';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.$transaction([
      prisma.user.update({ where: { email }, data: { passwordHash, role: 'ADMIN', name } }),
      prisma.refreshToken.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log(`Updated admin ${email} (password reset, sessions revoked)`);
  } else {
    await prisma.user.create({ data: { email, name, passwordHash, role: 'ADMIN' } });
    console.log(`Created admin ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
