import chalk from 'chalk';
import AWS, { STS, IAM } from 'aws-sdk';

import { getCurrentProfile } from '../lib/profile';
import { timeout } from '../lib/time';

const assumedRole = (arn?: string): string | undefined => {
  return arn ? arn.split('/')[1] : undefined;
};

const whoami = async (): Promise<void> => {
  const sts = new STS();
  const iam = new IAM();

  const identity = await Promise.race([sts.getCallerIdentity().promise(), timeout(1500)]);

  if (!identity) {
    console.log(chalk.red(`Session is expired or invalid`));
    process.exit();
  }

  // Should be available if the identity call returns truthy, so shouldn't need a second timed-out race.
  const aliases = await iam.listAccountAliases().promise();

  const whoAmI = {
    Account: identity.Account,
    Aliases: aliases?.AccountAliases,
    Arn: identity.Arn,
    AssumedRole: assumedRole(identity.Arn),
    Profile: getCurrentProfile(),
    Region: AWS.config.region,
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
