import inquirer from 'inquirer';
import chalk from 'chalk';
import yargs, { Argv } from 'yargs';
import updateNotifier from 'update-notifier';

import {
  backupConfig,
  initConfig,
  getProfileNames,
  getProfile,
  getCredentials,
  writeTemporaryCredentials,
  createProfile,
  deleteProfile
} from './config';
import getTemporaryCredentials, { ProfileConfiguration, AWSCredentials } from './mfa-login';
import exportEnvironmentVariables from './exporter';
import pkg from '../package.json';

updateNotifier({ pkg }).notify();

const profiles = getProfileNames();
let currentProfile = process.env.AWS_PROFILE || '';

const validateMfaExpiry = (mfaExpiry: number): boolean | string => {
  if (mfaExpiry <= 0) {
    return 'mfaExpiry must be greater than 0';
  } else if (mfaExpiry > 129600) {
    return 'mfaExpiry must be less than or equal to 129600';
  } else {
    return true;
  }
};

const switchProfile = async (name?: string, forceMFA?: boolean): Promise<void> => {
  if (profiles.length === 0) {
    console.warn(chalk.yellow(`No profiles are configured, run 'awsx add-profile' first.`));

    return;
  }

  if (name) {
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

    currentProfile = answers.profile;
  }

  const selectedProfile = getProfile(currentProfile);

  if (!selectedProfile) {
    console.error(
      chalk.red(`No profile ${currentProfile} found, make sure you run 'awsx add-profile' first.`)
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
        selectedProfile.awsOutputFormat,
        lastCredentials.awsSessionToken
      );

      if (name) {
        console.log(chalk.green(`Switched to profile ${selectedProfile.profileName}`));
      }

      return;
    }

    const mfaAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'token',
        message: 'MFA token'
      }
    ]);

    await getTemporaryCredentials(
      selectedProfile,
      mfaAnswer.token,
      (credentials: AWSCredentials): void => {
        writeTemporaryCredentials(selectedProfile, credentials);

        exportEnvironmentVariables(
          selectedProfile.profileName,
          credentials.awsAccessKeyId,
          credentials.awsSecretAccessKey,
          selectedProfile.awsDefaultRegion,
          selectedProfile.awsOutputFormat,
          credentials.awsSessionToken
        );
      }
    );
  } else {
    exportEnvironmentVariables(
      selectedProfile.profileName,
      selectedProfile.awsAccessKeyId,
      selectedProfile.awsSecretAccessKey,
      selectedProfile.awsDefaultRegion,
      selectedProfile.awsOutputFormat
    );
  }

  if (name) {
    console.log(chalk.green(`Switched to profile ${selectedProfile.profileName}`));
  }
};

const addProfile = async (
  name?: string,
  accessKey?: string,
  secretKey?: string,
  defaultRegion?: string,
  outputFormat?: string,
  mfaArn?: string,
  mfaExpiry?: number
): Promise<void> => {
  if (name && accessKey && secretKey && defaultRegion && outputFormat) {
    const profile: ProfileConfiguration = {
      profileName: name,
      awsAccessKeyId: accessKey,
      awsSecretAccessKey: secretKey,
      awsDefaultRegion: defaultRegion,
      awsOutputFormat: outputFormat,
      mfaEnabled: false
    };

    if (mfaArn && mfaExpiry) {
      profile.mfaEnabled = true;
      profile.mfaDeviceArn = mfaArn;
      profile.sessionLengthInSeconds = mfaExpiry;
    }

    createProfile(profile);
    console.log(chalk.green(`Added new profile '${name}'`));
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
        type: 'list',
        name: 'outputFormat',
        message: 'Output format',
        choices: ['json', 'yaml', 'text', 'table'],
        default: 'json'
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
      awsOutputFormat: profileAnswers.outputFormat,
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
          default: 3600,
          validate: validateMfaExpiry
        }
      ]);

      profile.mfaDeviceArn = mfaAnswers.mfaArn;
      profile.sessionLengthInSeconds = mfaAnswers.mfaExpiry;
    }

    createProfile(profile);
    console.log(chalk.green(`Added new profile '${profile.profileName}'`));
  }
};

const removeProfile = async (name?: string): Promise<void> => {
  let profileName = '';

  if (name) {
    profileName = name;
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

    profileName = answers.profile;
  }

  const selectedProfile = getProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No profile '${profileName}' found.`));

    return;
  }

  const confirmAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove profile '${profileName}'?`
    }
  ]);

  if (profileName && confirmAnswer.confirm) {
    deleteProfile(profileName);
    console.log(chalk.green(`Removed profile '${profileName}'`));
  }
};

const enableMfa = async (name?: string): Promise<void> => {
  let profileName = '';

  if (name) {
    profileName = name;
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

    profileName = answers.profile;
  }

  const selectedProfile = getProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No profile '${profileName}' found.`));

    return;
  }

  if (selectedProfile.mfaEnabled) {
    console.warn(chalk.yellow(`Profile ${profileName} already has MFA enabled.`));

    return;
  }

  const profileAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'accessKey',
      message: 'Access key',
      default: selectedProfile.awsAccessKeyId
    },
    {
      type: 'input',
      name: 'secretKey',
      message: 'Secret key',
      default: selectedProfile.awsSecretAccessKey
    },
    {
      type: 'input',
      name: 'defaultRegion',
      message: 'Default region',
      default: selectedProfile.awsDefaultRegion
    },
    {
      type: 'list',
      name: 'outputFormat',
      message: 'Output format',
      choices: ['json', 'yaml', 'text', 'table'],
      default: selectedProfile.awsOutputFormat || 'json'
    },
    {
      type: 'input',
      name: 'mfaArn',
      message: 'MFA device ARN'
    },
    {
      type: 'number',
      name: 'mfaExpiry',
      message: 'MFA token expiry (seconds)',
      default: 3600,
      validate: validateMfaExpiry
    }
  ]);

  deleteProfile(profileName);
  createProfile({
    profileName: profileName,
    awsAccessKeyId: profileAnswers.accessKey,
    awsSecretAccessKey: profileAnswers.secretKey,
    awsDefaultRegion: profileAnswers.defaultRegion,
    awsOutputFormat: profileAnswers.outputFormat,
    mfaEnabled: true,
    mfaDeviceArn: profileAnswers.mfaArn,
    sessionLengthInSeconds: profileAnswers.mfaExpiry
  });

  console.log(chalk.green(`Enabled MFA on profile '${profileName}'`));
};

const disableMfa = async (name?: string): Promise<void> => {
  let profileName = '';

  if (name) {
    profileName = name;
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

    profileName = answers.profile;
  }

  const selectedProfile = getProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No profile '${profileName}' found.`));

    return;
  }

  if (!selectedProfile.mfaEnabled) {
    console.warn(chalk.yellow(`Profile ${profileName} already has MFA disabled.`));

    return;
  }

  const profileAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'accessKey',
      message: 'Access key',
      default: selectedProfile.awsAccessKeyId
    },
    {
      type: 'input',
      name: 'secretKey',
      message: 'Secret key',
      default: selectedProfile.awsSecretAccessKey
    },
    {
      type: 'input',
      name: 'defaultRegion',
      message: 'Default region',
      default: selectedProfile.awsDefaultRegion
    },
    {
      type: 'input',
      name: 'outputFormat',
      message: 'Output format',
      default: selectedProfile.awsOutputFormat
    }
  ]);

  deleteProfile(profileName);
  createProfile({
    profileName: profileName,
    awsAccessKeyId: profileAnswers.accessKey,
    awsSecretAccessKey: profileAnswers.secretKey,
    awsDefaultRegion: profileAnswers.defaultRegion,
    awsOutputFormat: profileAnswers.outputFormat,
    mfaEnabled: false
  });

  console.log(chalk.green(`Disabled MFA on profile '${profileName}'`));
};

const awsx = (): void => {
  yargs
    .scriptName('awsx')
    .usage('$0 [command]')
    .command({
      command: '$0 [profile]',
      describe: 'Switch profiles',
      builder: (yargs): Argv<{ profile?: string; forceMfa?: boolean }> =>
        yargs
          .positional('profile', {
            describe: 'The name of the profile to switch to',
            type: 'string'
          })
          .option('force-mfa', {
            alias: 'f',
            describe: 'If the selected profile has MFA enabled, forces a new MFA login',
            type: 'boolean',
            default: false
          }),
      handler: async (args: { profile?: string; forceMfa?: boolean }): Promise<void> => {
        try {
          initConfig();
          await switchProfile(args.profile, args.forceMfa);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
    })
    .command({
      command:
        'add-profile [profile] [access-key] [secret-key] [default-region] [output-format] [mfa-arn] [mfa-expiry]',
      describe: 'Add profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
        'access-key'?: string;
        'secret-key'?: string;
        'default-region'?: string;
        'output-format'?: string;
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
          .positional('output-format', {
            type: 'string',
            describe: 'The default AWS CLI output format for the new profile'
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
        outputFormat?: string;
        mfaArn?: string;
        mfaExpiry?: number;
      }): Promise<void> => {
        try {
          initConfig();
          await addProfile(
            args.profile,
            args.accessKey,
            args.secretKey,
            args.defaultRegion,
            args.outputFormat,
            args.mfaArn,
            args.mfaExpiry
          );
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
    })
    .command({
      command: 'remove-profile [profile]',
      describe: 'Remove profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
      }> =>
        yargs.positional('profile', {
          type: 'string',
          describe: 'The name of the profile to delete'
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await removeProfile(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
    })
    .command({
      command: 'enable-mfa [profile]',
      describe: 'Enable MFA on an existing profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
      }> =>
        yargs.positional('profile', {
          type: 'string',
          describe: 'The name of the profile to enable MFA'
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await enableMfa(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
    })
    .command({
      command: 'disable-mfa [profile]',
      describe: 'Disable MFA on an existing profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
      }> =>
        yargs.positional('profile', {
          type: 'string',
          describe: 'The name of the profile to disable MFA'
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await disableMfa(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
    })
    .command({
      command: 'backup-config',
      describe: 'Create a backup of your AWS and awsx config files',
      handler: (): void => {
        try {
          backupConfig();

          console.log(chalk.green('Backed up all AWS CLI and awsx config files'));
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
    })
    .wrap(yargs.terminalWidth() <= 120 ? yargs.terminalWidth() : 120)
    .help().argv;
};

if (process.env.NODE_ENV === 'development') {
  awsx();
}

export default awsx;
export { validateMfaExpiry };
