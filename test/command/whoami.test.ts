import { assumedRole } from '../../src/command/whoami';

describe('whoami', () => {
  test('assumedRole', () => {
    expect(
      assumedRole('arn:aws:sts::736289482636:assumed-role/foo-bar/aws-sdk-js-1634417672672')
    ).toEqual('foo-bar');
  });
});
