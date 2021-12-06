import chalk from 'chalk';
import { STS } from '@aws-sdk/client-sts';
import { IAM } from '@aws-sdk/client-iam';

import { getCurrentProfile } from '../lib/profile';
import { getProfile } from '../config';
import { timeout } from '../lib/time';

const assumedRole = (arn?: string): string | undefined => {
  return arn ? arn.split('/')[1] : undefined;
};

const whoami = async (): Promise<void> => {
  const profile = getProfile(getCurrentProfile());

  if (!profile) {
    console.log(chalk.red('Error loading profile'));

    return;
  }

  const credentials = {
    accessKeyId: profile.awsAccessKeyId,
    secretAccessKey: profile.awsSecretAccessKey,
  };

  const sts = new STS({ credentials });
  const iam = new IAM({ credentials });

  const identity = await Promise.race([sts.getCallerIdentity({}), timeout(1500)]);

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
    Region: profile.awsDefaultRegion,
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
