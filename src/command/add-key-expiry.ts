import chalk from 'chalk';
import prompts from 'prompts';

import { createProfile, deleteProfile, getProfile, getProfileNames } from '../config';

const addKeyExpiry = async (
  name: string | undefined,
  expiryPeriod: number | undefined
): Promise<void> => {
  let profileName = '';
  let expiryInDays: number;

  if (name && expiryPeriod) {
    profileName = name;
    expiryInDays = expiryPeriod;
  } else {
    const choices = getProfileNames().map((profile) => ({ title: profile, value: profile }));

    const answers = await prompts([
      {
        type: 'select',
        name: 'profile',
        message: 'Choose a profile',
        choices: choices,
      },
      {
        type: 'number',
        name: 'period',
        message: 'Enter expiry period in days',
        initial: 90,
      },
    ]);

    profileName = answers.profile;
    expiryInDays = answers.period;

    console.log('After prompts: profileName, expiryInDays', profileName, expiryInDays);
  }

  const selectedProfile = getProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No profile '${profileName}' found.`));

    return;
  }

  if (selectedProfile.awsSecretAccessKeyExpiry) {
    console.warn(
      chalk.yellow(`Profile ${profileName} already has expiry date set, Do you want to update it?.`)
    );

    const choices = ['yes', 'no'].map((answer) => ({ title: answer, value: answer }));

    const answers = await prompts([
      {
        type: 'select',
        name: 'profile',
        message: 'Choose a profile',
        choices: choices,
      },
    ]);

    if (answers.profile === 'no') {
      console.log(
        chalk.yellow(`Access key expiry date on profile ${profileName} has not been updated.`)
      );

      return;
    }
  }

  deleteProfile(profileName);
  createProfile({
    ...selectedProfile,
    awsSecretAccessKeyExpiry: expiryInDays,
  });

  console.log(chalk.green(`Updated access key expiry date on profile '${profileName}'`));
};

export { addKeyExpiry };
