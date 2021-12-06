import chalk from 'chalk';

import { getProfiles } from '../config';
import { getDaysBeforeExpiry } from '../lib/time';

const getExpiryStatus = (expiryInDays: number): [string, chalk.Chalk] => {
  let expiryText = '';
  let chalkColor;

  if (expiryInDays > 2) {
    expiryText = `expires in ${expiryInDays} days`;
    chalkColor = chalk.green;
  } else if ([0, 1].includes(expiryInDays)) {
    expiryText = expiryInDays === 1 ? 'expires tomorrow' : 'expires today';
    chalkColor = chalk.yellow;
  } else {
    expiryText = 'has expired ✘';
    chalkColor = chalk.red;
  }

  return [expiryText, chalkColor];
};

const checkSecretKeyExpiry = (): void => {
  const profiles = getProfiles();

  for (const profile of profiles) {
    const expiryInDays = getDaysBeforeExpiry(profile?.awsSecretAccessKeyExpiry);
    const [expires, chalkColor] = getExpiryStatus(expiryInDays);

    if (expiryInDays && profile?.profileName) {
      console.log(chalkColor(`⚠ Your secret key of profile ${profile.profileName} ${expires}`));
    }
  }
};

export { checkSecretKeyExpiry };
