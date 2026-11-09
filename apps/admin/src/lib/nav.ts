import type { UserRole } from '@playaround/contracts';

export const NAV = [
  { href: '/overview', label: 'Overview', roles: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/arrangements', label: 'Venue arrangements', roles: ['OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/users', label: 'Users', roles: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/sessions', label: 'Sessions', roles: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/payments', label: 'Payments', roles: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/disputes', label: 'Disputes', roles: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/venues', label: 'Venues', roles: ['OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/sports', label: 'Sports', roles: ['OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/reports', label: 'Reports', roles: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] },
  { href: '/settings', label: 'Settings', roles: ['SUPER_ADMIN'] },
  { href: '/audit', label: 'Audit log', roles: ['SUPER_ADMIN'] },
] as const;

export function canAccess(role: UserRole | undefined, href: string) {
  const item = NAV.find((row) => href === row.href || href.startsWith(`${row.href}/`));
  if (!item) return Boolean(role && role !== 'USER');
  return role ? (item.roles as readonly string[]).includes(role) : false;
}
