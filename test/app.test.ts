import { assumedRole, validateMfaExpiry } from '../src/app';

describe('app', (): void => {
  test('assumedRole', () => {
    expect(
      assumedRole('arn:aws:sts::736289482636:assumed-role/foo-bar/aws-sdk-js-1634417672672')
    ).toEqual('foo-bar');
  });

  test('validateMfaExpiry', () => {
    expect(validateMfaExpiry(0)).toBe('mfaExpiry must be greater than 0');
    expect(validateMfaExpiry(129601)).toBe('mfaExpiry must be less than or equal to 129600');
    expect(validateMfaExpiry(129600)).toBe(true);
    expect(validateMfaExpiry(3600)).toBe(true);
  });
});
