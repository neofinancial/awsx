import { isMfaSessionStillValid } from '../src/config';

describe('config', (): void => {
  test('isMfaSessionStillValid', () => {
    const lastLoginTime = Date.now() / 1000 - 3600;

    expect(isMfaSessionStillValid(lastLoginTime, 7200)).toBe(true);
    expect(isMfaSessionStillValid(lastLoginTime, 3600)).toBe(false);
    expect(isMfaSessionStillValid(lastLoginTime, 600)).toBe(false);
  });
});
