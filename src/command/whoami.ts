import chalk from 'chalk';
// import { STS } from '@aws-sdk/client-sts';
import { IAM } from '@aws-sdk/client-iam';

import { getCurrentProfile, verifyAndGetCallerIdentity } from '../lib/profile';
import { getAssumeRoleProfile } from '../config';
// import { timeout } from '../lib/time';

const assumedRole = (arn?: string): string | undefined => {
  return arn ? arn.split('/')[1] : undefined;
};

const whoami = async (): Promise<void> => {
  const currentProfile = await getCurrentProfile();
  const assumeRoleProfile = await getAssumeRoleProfile(currentProfile);

  if (!assumeRoleProfile) {
    console.log(chalk.red('Error loading profile'));

    return;
  }

  const iam = new IAM({});

  const identity = await verifyAndGetCallerIdentity();

  console.log('Identity');
  console.log(identity);

  if (!identity) {
    console.log(chalk.red(`Session is expired or invalid`));
    process.exit();
  }

  // Should be available if the identity call returns truthy, so shouldn't need a second timed-out race.
  const aliases = await iam.listAccountAliases({});

  const whoAmI = {
    Account: identity.Account,
    Aliases: aliases?.AccountAliases,
    Arn: identity.Arn,
    AssumedRole: assumedRole(identity.Arn),
    Profile: getCurrentProfile(),
    Region: assumeRoleProfile.awsDefaultRegion,
    UserId: identity.UserId,
  };

  const maxKeyLength = Math.max.apply(
    null,
    Object.keys(whoAmI).map((k) => k.length)
  );

  for (const [key, value] of Object.entries(whoAmI)) {
    console.log(chalk.green(`${key.padEnd(maxKeyLength)} -> ${value}`));
  }
};

export { assumedRole, whoami };
