import * as userService from '../services/user.service.js';
import { serializeUser } from '../utils/serializeUser.js';

export async function updateMe(req, res) {
  const user = await userService.updateOwnProfile(req.user, req.body);
  res.json({ success: true, data: { user: serializeUser(user) } });
}

export async function list(req, res) {
  // Express 5 makes req.query read-only, so the validated copy lives here.
  const { users, pagination } = await userService.listUsers(req.validatedQuery);

  res.json({
    success: true,
    data: { users: users.map(serializeUser), pagination },
  });
}

export async function stats(_req, res) {
  res.json({ success: true, data: await userService.getStats() });
}

export async function changeRole(req, res) {
  const user = await userService.changeRole(req.user, req.params.id, req.body.role);
  res.json({ success: true, data: { user: serializeUser(user) } });
}

export async function changeStatus(req, res) {
  const user = await userService.changeStatus(req.user, req.params.id, req.body.isActive);
  res.json({ success: true, data: { user: serializeUser(user) } });
}

export async function assignManager(req, res) {
  const user = await userService.assignManager(req.params.id, req.body.managerId);
  res.json({ success: true, data: { user: serializeUser(user) } });
}

export async function team(req, res) {
  const { team: members, count } = await userService.getTeam(req.user);
  res.json({ success: true, data: { team: members.map(serializeUser), count } });
}
