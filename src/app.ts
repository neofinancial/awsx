import inquirer from 'inquirer';
import yargs, { Argv } from 'yargs';

const profiles = ['development', 'staging', 'production'];
let currentProfile = '';

const switchProfile = async (name?: string): Promise<void> => {
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

    console.log(answers);
    // eslint-disable-next-line require-atomic-updates
    currentProfile = answers.profile;

    return;
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
    console.log('add profile', name, accessKey, secretKey);

    if (mfaArn && mfaExpiry) {
      console.log('profile mfa', mfaArn, mfaExpiry);
    }
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

      console.log(profileAnswers, mfaAnswers);
    } else {
      console.log(profileAnswers);
    }
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
          describe: 'The secret key for the new profile',
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
      await addProfile(args.profile, args.accessKey, args.secretKey, args.mfaArn, args.mfaExpiry);
    }
  })
  .help().argv;
