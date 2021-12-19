import { ListAccessKeysCommand } from '@aws-sdk/client-iam';
import chalk from 'chalk';

import { AWSCredentials, ProfileConfiguration } from '../mfa-login';

import { getKeyAgeInDays } from '../lib/time';
import { createIAMClient, createStsClient } from '../lib/create-aws-client';

const getKeyAgeStatus = (
  keyAge: number,
  keyMaxAge: number
): { text: string; textColor: chalk.Chalk } | undefined => {
  const daysLeft = keyMaxAge - keyAge;

  if (daysLeft < 0) {
    return { text: `✘ maximum age is exceeded`, textColor: chalk.red };
  } else if ([0, 1].includes(daysLeft)) {
    return {
      text: `${daysLeft === 1 ? '⚠ maximum age exceeds tomorrow' : '⚠ maximum age exceeds today'}`,
      textColor: chalk.yellow,
    };
  } else if (daysLeft < 7) {
    return { text: `⚠ maximum age exceeds in ${daysLeft} days`, textColor: chalk.yellow };
  } else if (daysLeft < 30) {
    return {
      text: `✓ maximum age exceeds in ${keyAge} days`,
      textColor: chalk.green,
    };
  } else return;
};

const getTextColor = (keyAge: number): chalk.Chalk | undefined => {
  if (keyAge < 10) return;

  if (keyAge > 180) {
    return chalk.red;
  } else if (keyAge > 20) {
    return chalk.yellow;
  } else {
    return chalk.green;
  }
};

const getUserName = (arn?: string): string | undefined => {
  return arn ? arn.split('/')[1] : undefined;
};

const checkSecretKeyExpiry = async (
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
      const status = getKeyAgeStatus(keyAge, keyMaxAge);

      if (!status) return;

      console.log(
        status.textColor(`Maximum AccessKey age of profile ${profile.profileName} is set to ${keyMaxAge} days.
        AccessKey status : ${status}`)
      );
    } else {
      const textColor = getTextColor(keyAge);

      if (!textColor) return;

      console.log(
        textColor(`Your AccessKey of profile ${profile.profileName} is ${keyAge} days old.`)
      );
    }

    console.log(
      chalk.blue(
        `ⓘ To turn off this notification, please set AccessKey maximum age to 0 in your profile:
  Usage : 'add-key-max-age [profile] 0'`
      )
    );
  } catch {
    return;
  }
};

export { checkSecretKeyExpiry };
