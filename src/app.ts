import inquirer from 'inquirer';
import yargs, { Argv } from 'yargs';

import {
  initConfig,
  addNewProfile,
  getProfileNames,
  getProfile,
  writeTemporaryCredentials,
  getCredentials
} from './config';

import getTemporaryCredentials, { ProfileConfiguration, AWSCredentials } from './mfa-login';
import exportEnvironmentVariables from './exporter';

const profiles = getProfileNames();
let currentProfile = '';

const switchProfile = async (name?: string, forceMFA?: boolean): Promise<void> => {
  if (profiles.length === 0) {
    console.error(`No profiles are configured, run 'awsx add-profile' first.`);

    return;
  }

  if (name) {
    console.log('switched to profile', name);
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
    const lastCredentials = getCredentials(selectedProfile.profileName);

    if (!forceMFA && lastCredentials && selectedProfile.mfaSessionValid) {
      exportEnvironmentVariables(
        selectedProfile.profileName,
        lastCredentials.awsAccessKeyId,
        lastCredentials.awsSecretAccessKey,
        selectedProfile.awsDefaultRegion,
        lastCredentials.awsSessionToken
      );

      return;
    }

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
          selectedProfile.awsDefaultRegion,
          credentials.awsSessionToken
        );
      }
    );
  } else {
    exportEnvironmentVariables(
      selectedProfile.profileName,
      selectedProfile.awsAccessKeyId,
      selectedProfile.awsSecretAccessKey,
      selectedProfile.awsDefaultRegion
    );
  }
};

const addProfile = async (
  name?: string,
  accessKey?: string,
  secretKey?: string,
  defaultRegion?: string,
  mfaArn?: string,
  mfaExpiry?: number
): Promise<void> => {
  if (name && accessKey && secretKey && defaultRegion) {
    const profile: ProfileConfiguration = {
      profileName: name,
      awsAccessKeyId: accessKey,
      awsSecretAccessKey: secretKey,
      awsDefaultRegion: defaultRegion,
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
        type: 'input',
        name: 'defaultRegion',
        message: 'Default region'
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
      awsDefaultRegion: profileAnswers.defaultRegion,
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
    builder: (yargs): Argv<{ profile?: string; f?: boolean }> =>
      yargs
        .positional('profile', {
          describe: 'The name of the profile to switch to',
          type: 'string'
        })
        .option('force-mfa', {
          alias: 'f',
          describe: 'If the selected profile has MFA enabled, forces a new MFA session',
          type: 'boolean',
          default: false
        }),
    handler: async (args: { profile?: string; forceMfa?: boolean }): Promise<void> => {
      initConfig();
      await switchProfile(args.profile, args.forceMfa);
    }
  })
  .command({
    command:
      'add-profile [profile] [access-key] [secret-key] [default-region] [mfa-arn] [mfa-expiry]',
    describe: 'Add profile',
    builder: (
      yargs
    ): Argv<{
      profile?: string;
      'access-key'?: string;
      'secret-key'?: string;
      'default-region'?: string;
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
        .positional('default-region', {
          type: 'string',
          describe: 'The default AWS region for the new profile'
        })
        .positional('mfa-arn', {
          type: 'string',
          describe: 'The ARN of the MFA device for the new profile'
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
      defaultRegion?: string;
      mfaArn?: string;
      mfaExpiry?: number;
    }): Promise<void> => {
      initConfig();
      await addProfile(
        args.profile,
        args.accessKey,
        args.secretKey,
        args.defaultRegion,
        args.mfaArn,
        args.mfaExpiry
      );
    }
  })
  .help().argv;
