/**
 * The single shape in which a user leaves this API.
 *
 * Explicit field-by-field construction rather than spreading the document:
 * a field can only escape if it is named here, so a schema addition can never
 * silently start appearing in responses.
 *
 * Accepts `managerId` either as a raw ObjectId or populated with a User.
 */
export function serializeUser(user) {
  if (!user) return null;

  const manager = user.managerId;
  const isPopulated = manager && typeof manager === 'object' && manager.name !== undefined;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    managerId: manager ? String(isPopulated ? manager._id : manager) : null,
    manager: isPopulated ? { id: String(manager._id), name: manager.name } : null,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
