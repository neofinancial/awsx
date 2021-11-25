import { assumedRole } from '../../src/command/whoami';

describe('whoami', () => {
  test('assumedRole', () => {
    expect(
      assumedRole('arn:aws:sts::111111111111:assumed-role/foo-bar/aws-sdk-js-1111111111111')
    ).toEqual('foo-bar');
  });
});
