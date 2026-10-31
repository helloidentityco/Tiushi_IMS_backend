import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { db } from './index.js';
import { users } from './schema.js';
import { hashPassword } from '../utils/authUtils.js';

async function seed() {
  console.log('Seeding initial administrator account...');

  const existingUsers = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users);

  const adminUser = existingUsers.find((u) => u.email === 'admin@mail.com');

  if (adminUser) {
    console.log('Admin user already exists:', adminUser.email, `(Role: ${adminUser.role})`);
    process.exit(0);
  }

  const hashedPassword = await hashPassword('12345');

  const [newAdmin] = await db
    .insert(users)
    .values({
      email: 'admin@mail.com',
      password: hashedPassword,
      role: 'Admin',
      status: 'active',
    })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    });

  console.log('Successfully seeded admin user:');
  console.log(newAdmin);
  console.log('Credentials: admin@mail.com / 12345');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
