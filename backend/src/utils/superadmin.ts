/**
 * Shared utility to determine if a user is the global Super Administrator.
 * Allows changing the Super Admin identity dynamically via process.env.SUPER_ADMIN_EMAIL.
 */
export const isSuperAdmin = (user: any): boolean => {
  if (!user) return false;
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@gym.com';
  return user.email === superAdminEmail;
};
