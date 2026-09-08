/**
 * Seeds one account per role so every RBAC path can be exercised by hand.
 *
 *   npm run seed            create anything missing, leave existing users alone
 *   npm run seed -- --reset delete every user first, then create fresh
 *
 * Idempotent by default: re-running it will not duplicate accounts and will not
 * silently reset a password you have since changed.
 */
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const reset = process.argv.includes('--reset');

const SEED_USERS = [
  {
    key: 'admin',
    name: 'Aarti Deshpande',
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: 'admin',
  },
  {
    key: 'manager',
    name: 'Rahul Verma',
    email: env.SEED_MANAGER_EMAIL,
    password: env.SEED_MANAGER_PASSWORD,
    role: 'manager',
  },
  {
    key: 'employee',
    name: 'Priya Sharma',
    email: env.SEED_EMPLOYEE_EMAIL,
    password: env.SEED_EMPLOYEE_PASSWORD,
    role: 'employee',
  },
];

async function seed() {
  await connectDB();

  // Build the indexes declared on the schema and drop any that no longer are.
  // Worth doing explicitly: autoIndex should be disabled in production, so
  // index creation cannot be left to happen implicitly on first model use.
  await User.syncIndexes();
  console.log('[seed] indexes synced');

  if (reset) {
    const { deletedCount } = await User.deleteMany({});
    console.log(`[seed] --reset: removed ${deletedCount} existing user(s)`);
  }

  const created = {};
  const results = [];

  for (const { key, name, email, password, role } of SEED_USERS) {
    const existing = await User.findByEmail(email);

    if (existing) {
      created[key] = existing;
      results.push({ email, role: existing.role, action: 'skipped (already exists)' });
      continue;
    }

    const user = await User.create({ name, email, password, role });
    created[key] = user;
    results.push({ email, role: user.role, action: 'created' });
  }

  // Give the manager a report, so the team view has something to show and the
  // "manager sees only their own reports" rule is actually testable.
  const { manager, employee } = created;
  if (manager && employee && String(employee.managerId) !== String(manager._id)) {
    employee.managerId = manager._id;
    await employee.save();
    console.log(`[seed] assigned ${employee.email} to manager ${manager.email}`);
  }

  console.log('\n[seed] summary');
  console.table(results);

  const total = await User.countDocuments();
  console.log(`[seed] users in database: ${total}`);
  console.log('[seed] passwords are in backend/.env under SEED_* — not printed here\n');
}

seed()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed] failed:', err.message);
    if (err.errors) {
      for (const [path, detail] of Object.entries(err.errors)) {
        console.error(`  - ${path}: ${detail.message}`);
      }
    }
    await disconnectDB().catch(() => {});
    process.exit(1);
  });
