/** Small denylist used at registration and password change. Not a substitute for a full HIBP check. */
export const COMMON_PASSWORDS = new Set(
  [
    'password123',
    'password1234',
    'password12345',
    'qwerty12345',
    'qwertyuiop',
    '1234567890',
    '12345678901',
    'letmein123',
    'welcome123',
    'admin12345',
    'playaround1',
    'playaround12',
    'iloveyou123',
    'monkey1234',
    'dragon1234',
    'baseball12',
    'football12',
    'abc1234567',
    '1111111111',
    '0000000000',
  ].map((value) => value.toLowerCase()),
);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
