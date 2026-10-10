// Centralize the rule allowing users to access themselves and admins to access all.
export const isAdmin = (user) => user.role === "admin";

export const canAccessUser = (actor, targetId) =>
  actor.id === targetId || isAdmin(actor);
