import { ListAccessKeysCommand } from '@aws-sdk/client-iam';
import chalk from 'chalk';

import { AWSCredentials, ProfileConfiguration } from '../mfa-login';

import { getKeyAgeInDays } from '../lib/time';
import { createIAMClient, createStsClient } from '../lib/create-aws-client';

const getExpiryStatus = (
  dateCreated: Date,
  maxAge: number | undefined
): { text: string; textColor: chalk.Chalk } | undefined => {
  let textColor;
  const keyAge = getKeyAgeInDays(dateCreated.getTime());

  if (maxAge) {
    const daysLeft = maxAge - keyAge;

    if (daysLeft < 0) {
      return { text: `✘ has expired`, textColor: chalk.red };
    } else if ([0, 1].includes(daysLeft)) {
      return {
        text: `${daysLeft === 1 ? '⚠ expires tomorrow' : '⚠ expires today'}`,
        textColor: chalk.yellow,
      };
    } else if (daysLeft < 7) {
      return { text: `⚠ expires in ${daysLeft} days`, textColor: chalk.yellow };
    } else if (daysLeft < 30) {
      return {
        text: `✓ expires in ${keyAge} days`,
        textColor: chalk.green,
      };
    } else return;
  } else {
    if (keyAge < 10) return;

    if (keyAge > 180) {
      textColor = chalk.red;
    } else if (keyAge > 20) {
      textColor = chalk.yellow;
    } else {
      textColor = chalk.green;
    }

    return { text: `${keyAge}`, textColor };
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
      (k) => k.AccessKeyId === profile.awsAccessKeyId
    );

    if (!currentKey || !currentKey.CreateDate) {
      return;
    }

    const keyMaxAge = profile.awsAccessKeyMaxAge;
    const expiryStatus = getExpiryStatus(currentKey.CreateDate, keyMaxAge);

    if (keyMaxAge && expiryStatus?.text) {
      console.log(
        expiryStatus.textColor(`Your AccessKey of profile ${profile.profileName} has expiry period of ${keyMaxAge} days.
      AccessKey status : ${expiryStatus.text}`)
      );
    } else if (expiryStatus?.text) {
      console.log(
        expiryStatus.textColor(
          `Your AccessKey of profile ${profile.profileName} is ${expiryStatus.text} days old.`
        )
      );
    } else {
      return;
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
