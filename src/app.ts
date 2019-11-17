import inquirer from 'inquirer';
import yargs, { Argv } from 'yargs';

import {
  initConfig,
  addNewProfile,
  getProfileNames,
  getProfile,
  writeTemporaryCredentials
} from './config';

import getTemporaryCredentials, { ProfileConfiguration, AWSCredentials } from './mfa-login';
import exportEnvironmentVariables from './exporter';

const profiles = getProfileNames();
let currentProfile = '';

const switchProfile = async (name?: string): Promise<void> => {
  if (profiles.length === 0) {
    console.error(`No profiles are configured, run 'awsx add-profile' first.`);

    return;
  }

  if (name) {
    console.log('switch profile', name);
    currentProfile = name;
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Choose a profile',
        choices: profiles,
        default: currentProfile || profiles[0]
      }
    ]);

    // eslint-disable-next-line require-atomic-updates
    currentProfile = answers.profile;
  }

  const selectedProfile = getProfile(currentProfile);
  if (!selectedProfile) {
    console.error(
      `No profile ${currentProfile} found, make sure you run 'awsx add-profile' first.`
    );

    return;
  }

  if (selectedProfile.mfaEnabled) {
    const mfaAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'token',
        message: 'MFA token'
      }
    ]);

    getTemporaryCredentials(
      selectedProfile,
      mfaAnswer.token,
      (credentials: AWSCredentials): void => {
        writeTemporaryCredentials(selectedProfile, credentials);
        exportEnvironmentVariables(
          selectedProfile.profileName,
          credentials.awsAccessKeyId,
          credentials.awsSecretAccessKey,
          credentials.awsSessionToken
        );
      }
    );
  } else {
    exportEnvironmentVariables(
      selectedProfile.profileName,
      selectedProfile.awsAccessKeyId,
      selectedProfile.awsSecretAccessKey
    );
  }
};

const addProfile = async (
  name?: string,
  accessKey?: string,
  secretKey?: string,
  mfaArn?: string,
  mfaExpiry?: number
): Promise<void> => {
  if (name && accessKey && secretKey) {
    const profile: ProfileConfiguration = {
      profileName: name,
      awsAccessKeyId: accessKey,
      awsSecretAccessKey: secretKey,
      mfaEnabled: false
    };

    if (mfaArn && mfaExpiry) {
      profile.mfaEnabled = true;
      profile.mfaDeviceArn = mfaArn;
      profile.sessionLengthInSeconds = mfaExpiry;
    }

    addNewProfile(profile);
    console.log(`Added new profile '${name}'`);
  } else {
    const profileAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'profile',
        message: 'Name'
      },
      {
        type: 'input',
        name: 'accessKey',
        message: 'Access key'
      },
      {
        type: 'input',
        name: 'secretKey',
        message: 'Secret key'
      },
      {
        type: 'confirm',
        name: 'useMfa',
        message: 'Use MFA'
      }
    ]);

    const profile: ProfileConfiguration = {
      profileName: profileAnswers.profile,
      awsAccessKeyId: profileAnswers.accessKey,
      awsSecretAccessKey: profileAnswers.secretKey,
      mfaEnabled: profileAnswers.useMfa
    };

    if (profileAnswers.useMfa) {
      const mfaAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'mfaArn',
          message: 'MFA device ARN'
        },
        {
          type: 'number',
          name: 'mfaExpiry',
          message: 'MFA token expiry (seconds)',
          default: 3600
        }
      ]);

      profile.mfaDeviceArn = mfaAnswers.mfaArn;
      profile.sessionLengthInSeconds = mfaAnswers.mfaExpiry;
    }

    addNewProfile(profile);
    console.log(`Added new profile '${profile.profileName}'`);
  }
};

yargs
  .scriptName('awsx')
  .usage('$0 [command]')
  .command({
    command: '$0 [profile]',
    describe: 'Switch profiles',
    builder: (yargs): Argv<{ profile?: string }> =>
      yargs.positional('profile', {
        describe: 'The name of the profile to switch to',
        type: 'string'
      }),
    handler: async (args: { profile?: string }): Promise<void> => {
      initConfig();
      await switchProfile(args.profile);
    }
  })
  .command({
    command: 'add-profile [profile] [access-key] [secret-key] [mfa-arn] [mfa-expiry]',
    describe: 'Add profile',
    builder: (
      yargs
    ): Argv<{
      profile?: string;
      'access-key'?: string;
      'secret-key'?: string;
      'mfa-arn'?: string;
      'mfa-expiry'?: number;
    }> =>
      yargs
        .positional('profile', {
          type: 'string',
          describe: 'The name of the profile to create'
        })
        .positional('access-key', {
          type: 'string',
          describe: 'The access key for the new profile'
        })
        .positional('secret-key', {
          type: 'string',
          describe: 'The secret key for the new profile'
        })
        .positional('mfa-arn', {
          type: 'string',
          describe: 'The ARN of the MFA device for the profile '
        })
        .positional('mfa-expiry', {
          type: 'number',
          describe: 'MFA session token duration in seconds (between 900 and 129600)',
          default: 3600
        })
        .implies('profile', ['access-key', 'secret-key']),
    handler: async (args: {
      profile?: string;
      accessKey?: string;
      secretKey?: string;
      mfaArn?: string;
      mfaExpiry?: number;
    }): Promise<void> => {
      initConfig();
      await addProfile(args.profile, args.accessKey, args.secretKey, args.mfaArn, args.mfaExpiry);
    }
  })
  .help().argv;
