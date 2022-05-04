import { STS, Credentials, GetCallerIdentityCommandOutput } from '@aws-sdk/client-sts';

import { timeout } from './time';

const getCurrentProfile = (): string => {
  return process.env.AWS_PROFILE || '';
};

const verifyAndGetCallerIdentity = async (
  credentials?: Partial<Credentials>
): Promise<GetCallerIdentityCommandOutput | void> => {
  let sts: STS;

  if (credentials) {
    console.log('Using custom credentials');
    console.log(credentials);
    sts = new STS({
      credentials: {
        accessKeyId: credentials.AccessKeyId ?? '',
        secretAccessKey: credentials.SecretAccessKey ?? '',
      },
    });
  } else {
    sts = new STS({});
  }

  try {
    const identity = await Promise.race([sts.getCallerIdentity({}), timeout(1500)]);

    return identity;
  } catch (error) {
    throw new Error(`Invalid credentials [AccessKey] or [SecretKey]\n ${error}`);
  }
};

export { getCurrentProfile, verifyAndGetCallerIdentity };
