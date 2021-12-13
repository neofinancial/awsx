import { ListAccessKeysCommand } from '@aws-sdk/client-iam';
import chalk from 'chalk';

import { AWSCredentials, ProfileConfiguration } from '../mfa-login';

import { DEFAULT_SECRET_KEY_EXPIRY_DAYS, getDaysAfterCreated } from '../lib/time';
import { createIAMClient, createStsClient } from '../lib/create-aws-client';

const getExpiryStatus = (
  dateCreated: Date,
  expiryInDays: number
): [string | undefined, chalk.Chalk | undefined] => {
  const days = getDaysAfterCreated(dateCreated.getTime());

  let expiryText;
  let chalkColor;

  const daysLeft = expiryInDays - days;

  if ([0, 1].includes(daysLeft)) {
    expiryText = daysLeft === 1 ? 'expires tomorrow' : 'expires today';
    chalkColor = chalk.yellow;
  } else if (daysLeft < 0) {
    expiryText = 'has expired ✘';
    chalkColor = chalk.red;
  }

  return [expiryText, chalkColor];
};

const getUserName = (arn?: string): string | undefined => {
  return arn ? arn.split('/')[1] : undefined;
};

const checkSecretKeyExpiry = async (
  profile: ProfileConfiguration,
  credentials: AWSCredentials
): Promise<void> => {
  try {
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

    const expiryPeriod = profile.awsSecretAccessKeyExpiry || DEFAULT_SECRET_KEY_EXPIRY_DAYS;

    const [expired, chalkColor] = getExpiryStatus(currentKey.CreateDate, expiryPeriod);

    if (expired && chalkColor) {
      console.log(
        chalkColor(`⚠ Your secret key of profile ${profile.profileName} has expiry period of ${expiryPeriod} days.
      Secret key status : ${expired}`)
      );
    }
  } catch (error) {
    console.log(
      chalk.red(`Couldn't get the keys of profile ${profile.profileName}: ${error.message}`)
    );
  }
};

export { checkSecretKeyExpiry };
