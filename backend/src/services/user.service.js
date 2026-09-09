import User, { ROLES } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Escapes regex metacharacters before a search term is compiled into a RegExp.
 *
 * Without this, a search for "a+++++++++b" compiles into a pattern that can
 * pin the event loop, and characters like `.` or `|` silently change what the
 * search matches.
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Loads a user by id or throws a 404. Used by every admin mutation below. */
async function findUserOr404(id) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
  return user;
}

export async function updateOwnProfile(user, { name }) {
  user.name = name;
  await user.save();
  return user;
}

export async function listUsers({ page, limit, role, search }) {
  const filter = {};
  if (role) filter.role = role;

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('managerId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getStats() {
  const [total, active, byRoleRows] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);

  // Start from zero for every role so the response shape is stable even when a
  // role has no members. A missing key would force the client to guard reads.
  const byRole = Object.fromEntries(ROLES.map((r) => [r, 0]));
  for (const row of byRoleRows) {
    if (row._id in byRole) byRole[row._id] = row.count;
  }

  return { total, active, inactive: total - active, byRole };
}

export async function changeRole(actor, targetId, role) {
  // A lone admin who demotes themselves locks every administrative function out
  // of the system, recoverable only by editing the database directly.
  if (String(actor._id) === String(targetId)) {
    throw ApiError.badRequest('You cannot change your own role.', 'SELF_ROLE_CHANGE');
  }

  const target = await findUserOr404(targetId);

  // Demoting a manager who still has reports leaves those reports pointing at a
  // non-manager. BR-07 accepts that for v1.0: the UI shows them as unassigned.
  target.role = role;
  await target.save();

  return target;
}

export async function changeStatus(actor, targetId, isActive) {
  if (String(actor._id) === String(targetId)) {
    throw ApiError.badRequest('You cannot deactivate your own account.', 'SELF_STATUS_CHANGE');
  }

  const target = await findUserOr404(targetId);
  target.isActive = isActive;
  await target.save();

  return target;
}

export async function assignManager(targetId, managerId) {
  if (managerId && String(managerId) === String(targetId)) {
    throw ApiError.badRequest('A user cannot be their own manager.', 'SELF_MANAGER');
  }

  const target = await findUserOr404(targetId);

  if (managerId) {
    const manager = await User.findById(managerId);
    if (!manager) {
      throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
    }
    if (manager.role !== 'manager') {
      throw ApiError.badRequest(
        'The assigned user does not hold the manager role.',
        'NOT_A_MANAGER'
      );
    }
  }

  target.managerId = managerId;
  await target.save();
  await target.populate('managerId', 'name');

  return target;
}

export async function getTeam(manager) {
  const team = await User.find({ managerId: manager._id }).sort({ name: 1 });
  return { team, count: team.length };
}
