import chalk from 'chalk';
import prompts from 'prompts';

import { createProfile, deleteProfile, getProfile, getProfileNames } from '../config';

const setKeyMaxAge = async (
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
        message: 'Access key maximum age in days (use 0 for no maximum age)',
        initial: 0,
      },
    ]);

    profileName = answers.profile;
    expiryInDays = answers.period;
  }

  const selectedProfile = getProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No profile '${profileName}' found.`));

    return;
  }

  if (selectedProfile.awsAccessKeyMaxAge) {
    console.warn(
      chalk.yellow(
        `Profile '${profileName}' already has AccessKey maximum age set. Do you want to update it?.`
      )
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
        chalk.yellow(`AccessKey maximum age on profile ${profileName} has not been updated.`)
      );

      return;
    }
  }

  deleteProfile(profileName);
  createProfile({
    ...selectedProfile,
    awsAccessKeyMaxAge: expiryInDays,
  });

  console.log(chalk.green(`Updated AccessKey maximum age on profile '${profileName}'`));
};

export { setKeyMaxAge };
