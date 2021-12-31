import { ListAccessKeysCommand } from '@aws-sdk/client-iam';
import chalk from 'chalk';

import { AWSCredentials, ProfileConfiguration } from '../mfa-login';

import { getKeyAgeInDays } from '../lib/time';
import { createIAMClient, createStsClient } from '../lib/create-aws-client';

const getKeyAgeMessage = (keyAge: number, keyMaxAge?: number): string => {
  return keyMaxAge
    ? `Access key is ${keyAge} days old (maximum age is ${keyMaxAge} days)`
    : `Access key is ${keyAge} days old`;
};

const printKeyMaxAgeMessage = (keyAge: number, keyMaxAge: number): void => {
  const daysLeft = keyMaxAge - keyAge;

  if (daysLeft < 0) {
    console.log(chalk.red(`✘ ${getKeyAgeMessage(keyAge, keyMaxAge)}`));

    return;
  } else if (daysLeft < 7) {
    console.log(chalk.yellow(`⚠ ${getKeyAgeMessage(keyAge, keyMaxAge)}`));

    return;
  } else if (daysLeft < 30) {
    console.log(chalk.blue(` ⓘ ${getKeyAgeMessage(keyAge, keyMaxAge)}`));

    return;
  } else {
    return;
  }
};

const printKeyAgeMessage = (keyAge: number): void => {
  if (keyAge < 10) return;

  if (keyAge > 180) {
    console.log(chalk.red(getKeyAgeMessage(keyAge)));

    return;
  } else if (keyAge > 90) {
    console.log(chalk.yellow(getKeyAgeMessage(keyAge)));

    return;
  } else {
    console.log(chalk.blue(getKeyAgeMessage(keyAge)));
  }
};

const getUserName = (arn?: string): string | undefined => {
  return arn ? arn.split('/')[1] : undefined;
};

const checkSecretKeyAge = async (
  profile: ProfileConfiguration,
  credentials: AWSCredentials
): Promise<void> => {
  try {
    if (profile.awsAccessKeyMaxAge === 0) {
      return;
    }

    let userName = getUserName(profile.mfaDeviceArn);

    userName = userName
      ? userName
      : getUserName((await createStsClient(profile).getCallerIdentity({})).Arn);

    const iamClient = createIAMClient(credentials, profile.awsDefaultRegion);
    const keys = await iamClient.send(new ListAccessKeysCommand({ UserName: userName }));

    const currentKey = keys.AccessKeyMetadata?.find(
      (key) => key.AccessKeyId === profile.awsAccessKeyId
    );

    if (!currentKey || !currentKey.CreateDate) {
      return;
    }

    const keyMaxAge = profile.awsAccessKeyMaxAge;
    const keyAge = getKeyAgeInDays(currentKey.CreateDate.getTime());

    if (keyMaxAge) {
      printKeyMaxAgeMessage(keyAge, keyMaxAge);
      console.log();
    } else {
      printKeyAgeMessage(keyAge);

      console.log(
        chalk.blue(
          `Change this setting with 'awsx set-key-max-age [profile] <days>' (use 0 days for no maximum age)`
        )
      );
      console.log();
    }
  } catch {
    return;
  }
};

export { checkSecretKeyAge };
