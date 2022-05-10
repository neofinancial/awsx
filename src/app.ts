import chalk from 'chalk';
import prompts from 'prompts';
import yargs, { Argv } from 'yargs';
import updateNotifier from 'update-notifier';

import { onCancel } from './lib/prompts';

import {
  configFileCheck,
  backupConfig,
  initConfig,
  getProfileNames,
  getProfile,
  getCredentials,
  writeTemporaryCredentials,
  createProfile,
  deleteProfile,
  createAssumeRoleProfile,
  getAssumeRoleProfiles,
  deleteAssumeRoleProfile,
  getAssumeRoleProfile,
} from './config';
import getTemporaryCredentials, {
  ProfileConfiguration,
  AWSCredentials,
  AssumeRoleProfileConfiguration,
} from './mfa-login';
import exportEnvironmentVariables from './exporter';
import pkg from '../package.json';
import { getCurrentProfile, verifyAndGetCallerIdentity } from './lib/profile';
import { whoami } from './command/whoami';
import { checkSecretKeyAge } from './command/check-secret-expiry';
import { setKeyMaxAge } from './command/set-key-max-age';

const profiles = getProfileNames();

let currentProfile = getCurrentProfile();

const validateMfaExpiry = (mfaExpiry: number): boolean | string => {
  if (mfaExpiry <= 0) {
    return 'mfaExpiry must be greater than 0';
  } else if (mfaExpiry > 129600) {
    return 'mfaExpiry must be less than or equal to 129600';
  } else {
    return true;
  }
};

const switchAssumeRoleProfile = async (
  parentProfileName: string,
  assumeRoleProfileName?: string
): Promise<string | undefined> => {
  const assumeRoleProfiles = getAssumeRoleProfiles(parentProfileName).map((profile) =>
    profile.profileName.replace('profile ', '')
  );

  if (assumeRoleProfileName) {
    if (assumeRoleProfiles.includes(assumeRoleProfileName)) {
      exportEnvironmentVariables(assumeRoleProfileName);

      return assumeRoleProfileName;
    } else {
      console.error(chalk.red(`No profile '${assumeRoleProfileName}' found.`));
    }
  } else if (assumeRoleProfiles.length > 0) {
    const rootProfileOption = { title: 'root profile', value: parentProfileName };
    const choices = [
      rootProfileOption,
      ...assumeRoleProfiles.map((profile) => ({ title: profile, value: profile })),
    ];

    const answers = await prompts(
      {
        type: 'select',
        name: 'profile',
        message: 'Choose an assume role profile',
        choices,
        initial: choices.findIndex(
          (choice) => choice.value === currentProfile || choice.value === assumeRoleProfiles[0]
        ),
      },
      { onCancel: () => onCancel() }
    );

    if (answers.profile !== rootProfileOption) {
      exportEnvironmentVariables(answers.profile);

      return answers.profile;
    }
  }
};

const switchProfile = async (
  name?: string,
  assumeRoleProfileName?: string,
  forceMFA?: boolean
): Promise<void> => {
  if (profiles.length === 0) {
    console.warn(chalk.yellow(`No profiles are configured, run 'awsx add-profile' first.`));

    process.exit(1);
  }

  if (name) {
    currentProfile = name;
  } else {
    const answers = await prompts({
      type: 'select',
      name: 'profile',
      message: 'Choose a profile',
      choices: profiles.map((profile) => ({ title: profile, value: profile })),
    });

    currentProfile = answers.profile;
  }

  const selectedProfile = getProfile(currentProfile);

  if (!selectedProfile) {
    console.error(
      chalk.red(`No profile ${currentProfile} found, make sure you run 'awsx add-profile' first.`)
    );

    process.exit(1);
  }

  if (selectedProfile.mfaEnabled) {
    const lastCredentials = getCredentials(selectedProfile.profileName);

    if (!forceMFA && lastCredentials && selectedProfile.mfaSessionValid) {
      exportEnvironmentVariables(selectedProfile.profileName);

      await checkSecretKeyAge(selectedProfile, lastCredentials);

      const activeProfile = await switchAssumeRoleProfile(
        selectedProfile.profileName,
        assumeRoleProfileName
      );

      console.log(
        chalk.green(
          `Switched to profile ${selectedProfile.profileName}${
            activeProfile ? ` -> ${activeProfile}` : ''
          }`
        )
      );

      return;
    }

    const mfaAnswer = await prompts({
      type: 'text',
      name: 'token',
      message: 'MFA token',
    });

    await getTemporaryCredentials(
      selectedProfile,
      mfaAnswer.token,
      async (credentials: AWSCredentials): Promise<void> => {
        await checkSecretKeyAge(selectedProfile, credentials);

        writeTemporaryCredentials(selectedProfile, credentials);
        exportEnvironmentVariables(selectedProfile.profileName);
      }
    );
  } else {
    exportEnvironmentVariables(selectedProfile.profileName);
  }

  const activeProfile = await switchAssumeRoleProfile(
    selectedProfile.profileName,
    assumeRoleProfileName
  );

  console.log(
    chalk.green(
      `Switched to profile ${selectedProfile.profileName}${
        activeProfile ? ` -> ${activeProfile}` : ''
      }`
    )
  );
};

const addProfile = async (
  name?: string,
  accessKey?: string,
  secretKey?: string,
  keyMaxAge?: number,
  defaultRegion?: string,
  outputFormat?: string,
  mfaArn?: string,
  mfaExpiry?: number
): Promise<void> => {
  if (name && accessKey && secretKey && defaultRegion && outputFormat && keyMaxAge) {
    const profile: ProfileConfiguration = {
      profileName: name,
      awsAccessKeyId: accessKey.trim(),
      awsSecretAccessKey: secretKey.trim(),
      awsAccessKeyMaxAge: keyMaxAge,
      awsDefaultRegion: defaultRegion.trim(),
      awsOutputFormat: outputFormat,
      mfaEnabled: false,
    };

    if (mfaArn && mfaExpiry) {
      profile.mfaEnabled = true;
      profile.mfaDeviceArn = mfaArn;
      profile.sessionLengthInSeconds = mfaExpiry;
    }

    createProfile(profile);
    console.log(chalk.green(`Added new profile '${name}'`));
  } else {
    const profileAnswers = await prompts(
      [
        {
          type: 'text',
          name: 'profile',
          message: 'Name',
        },
        {
          type: 'text',
          name: 'accessKey',
          message: 'Access key',
        },
        {
          type: 'text',
          name: 'secretKey',
          message: 'Secret key',
        },
        {
          type: 'number',
          name: 'keyMaxAge',
          message: 'Secret key maximum age in days',
          initial: 90,
        },
        {
          type: 'text',
          name: 'defaultRegion',
          message: 'Default region',
        },
        {
          type: 'select',
          name: 'outputFormat',
          message: 'Output format',
          choices: [
            { title: 'json', value: 'json' },
            { title: 'yaml', value: 'yaml' },
            { title: 'text', value: 'text' },
            { title: 'table', value: 'table' },
          ],
          initial: 1,
        },
        {
          type: 'confirm',
          name: 'useMfa',
          message: 'Use MFA',
        },
      ],
      { onCancel: () => onCancel('Cancelling add profile') }
    );

    await verifyAndGetCallerIdentity({
      AccessKeyId: profileAnswers.accessKey.trim(),
      SecretAccessKey: profileAnswers.secretKey.trim(),
    });

    const profile: ProfileConfiguration = {
      profileName: profileAnswers.profile,
      awsAccessKeyId: profileAnswers.accessKey.trim(),
      awsSecretAccessKey: profileAnswers.secretKey.trim(),
      awsAccessKeyMaxAge: profileAnswers.keyMaxAge,
      awsDefaultRegion: profileAnswers.defaultRegion.trim(),
      awsOutputFormat: profileAnswers.outputFormat,
      mfaEnabled: profileAnswers.useMfa,
    };

    if (profileAnswers.useMfa) {
      const mfaAnswers = await prompts(
        [
          {
            type: 'text',
            name: 'mfaArn',
            message: 'MFA device ARN',
            validate: (mfaArn: string): boolean | string =>
              mfaArn ? true : 'MFA device ARN is required',
          },
          {
            type: 'number',
            name: 'mfaExpiry',
            message: 'MFA token expiry (seconds)',
            initial: 3600,
            validate: validateMfaExpiry,
          },
        ],
        { onCancel: () => onCancel('Cancelling add profile') }
      );

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
    const choices = profiles.map((profile) => ({ title: profile, value: profile }));
    const answers = await prompts(
      {
        type: 'select',
        name: 'profile',
        message: 'Choose a profile',
        choices: choices,
        initial: choices.findIndex((choice) => choice.value === currentProfile),
      },
      { onCancel: () => onCancel('Cancelling remove profile') }
    );

    profileName = answers.profile;
  }

  const selectedProfile = getProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No profile '${profileName}' found.`));

    return;
  }

  const confirmAnswer = await prompts([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove profile '${profileName}'?`,
    },
  ]);

  if (profileName && confirmAnswer.confirm) {
    deleteProfile(profileName);
    console.log(chalk.green(`Removed profile '${profileName}'`));
  }
};

const removeAssumeRoleProfile = async (name?: string): Promise<void> => {
  let profileName: string;

  const assumeRoleProfiles = getAssumeRoleProfiles();

  if (name) {
    profileName = name;
  } else {
    const choices = assumeRoleProfiles.map((profile) => ({
      title: profile.profileName.replace('profile ', ''),
      value: profile.profileName.replace('profile ', ''),
    }));
    const answers = await prompts(
      {
        type: 'list',
        name: 'profile',
        message: 'Choose a profile',
        choices: choices,
        initial: choices.findIndex(
          (choice) =>
            choice.value === currentProfile ||
            choice.value === assumeRoleProfiles[0].profileName.replace('profile ', '')
        ),
      },
      { onCancel: () => onCancel('Cancelling remove assume profile') }
    );

    profileName = answers.profile;
  }

  const selectedProfile = getAssumeRoleProfile(profileName);

  if (!selectedProfile) {
    console.error(chalk.red(`No assumed role profile '${profileName}' found.`));

    return;
  }

  const confirmAnswer = await prompts([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove assumed role profile '${profileName}'?`,
    },
  ]);

  if (profileName && confirmAnswer.confirm) {
    deleteAssumeRoleProfile(profileName);
    console.log(chalk.green(`Removed assumed role profile '${profileName}'`));
  }
};

const addAssumeRoleProfile = async (
  name?: string,
  parentProfile?: string,
  roleArn?: string
): Promise<void> => {
  let profileName: string;
  let parentProfileName: string;
  let awsRoleArn: string;

  if (name && parentProfile && roleArn) {
    profileName = name;
    parentProfileName = parentProfile;
    awsRoleArn = roleArn;
  } else {
    const profileAnswers = await prompts([
      {
        type: 'text',
        name: 'profile',
        message: 'Name',
      },
      {
        type: 'select',
        name: 'parentProfile',
        message: 'Choose a parent profile',
        choices: profiles.map((profile) => ({ title: profile, value: profile })),
      },
      {
        type: 'text',
        name: 'roleArn',
        message: 'Role ARN',
      },
    ]);

    profileName = profileAnswers.profile;
    parentProfileName = profileAnswers.parentProfile;
    awsRoleArn = profileAnswers.roleArn;
  }

  const parent = getProfile(parentProfileName);

  if (!parent) {
    console.error(chalk.red(`No parent profile '${parentProfileName}' found.`));

    return;
  }

  const existingProfile = getProfile(profileName);
  const existingAssumeRoleProfile = getAssumeRoleProfile(profileName);

  if (existingProfile || existingAssumeRoleProfile) {
    console.error(chalk.red(`Profile named '${profileName}' already exists.`));

    return;
  }

  const choices = [
    { title: 'json', value: 'json' },
    { title: 'yaml', value: 'yaml' },
    { title: 'text', value: 'text' },
    { title: 'table', value: 'table' },
  ];
  const configAnswers = await prompts([
    {
      type: 'text',
      name: 'defaultRegion',
      message: 'Default region',
      initial: parent.awsDefaultRegion,
    },
    {
      type: 'select',
      name: 'outputFormat',
      message: 'Output format',
      choices: choices,
      initial: choices.findIndex((choice) => choice.value === parent.awsOutputFormat),
    },
  ]);

  const profile: AssumeRoleProfileConfiguration = {
    profileName,
    parentProfileName,
    awsRoleArn,
    awsDefaultRegion: configAnswers.defaultRegion,
    awsOutputFormat: configAnswers.outputFormat,
  };

  createAssumeRoleProfile(profile);
};

const enableMfa = async (name?: string): Promise<void> => {
  let profileName = '';

  if (name) {
    profileName = name;
  } else {
    const choices = profiles.map((profile) => ({ title: profile, value: profile }));
    const answers = await prompts(
      {
        type: 'select',
        name: 'profile',
        message: 'Choose a profile',
        choices: choices,
        initial: choices.findIndex(
          (choice) => choice.value === currentProfile || choice.value === profiles[0]
        ),
      },
      { onCancel: () => onCancel() }
    );

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

  const choices = [
    { title: 'json', value: 'json' },
    { title: 'yaml', value: 'yaml' },
    { title: 'text', value: 'text' },
    { title: 'table', value: 'table' },
  ];
  const profileAnswers = await prompts([
    {
      type: 'text',
      name: 'accessKey',
      message: 'Access key',
      initial: selectedProfile.awsAccessKeyId,
    },
    {
      type: 'text',
      name: 'secretKey',
      message: 'Secret key',
      initial: selectedProfile.awsSecretAccessKey,
    },
    {
      type: 'text',
      name: 'defaultRegion',
      message: 'Default region',
      initial: selectedProfile.awsDefaultRegion,
    },
    {
      type: 'select',
      name: 'outputFormat',
      message: 'Output format',
      choices: choices,
      initial: choices.findIndex((choice) => choice.value === selectedProfile.awsOutputFormat),
    },
    {
      type: 'text',
      name: 'mfaArn',
      message: 'MFA device ARN',
    },
    {
      type: 'number',
      name: 'mfaExpiry',
      message: 'MFA token expiry (seconds)',
      initial: 3600,
      validate: validateMfaExpiry,
    },
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
    sessionLengthInSeconds: profileAnswers.mfaExpiry,
  });

  console.log(chalk.green(`Enabled MFA on profile '${profileName}'`));
};

const disableMfa = async (name?: string): Promise<void> => {
  let profileName = '';

  if (name) {
    profileName = name;
  } else {
    const choices = profiles.map((profile) => ({ title: profile, value: profile }));
    const answers = await prompts([
      {
        type: 'select',
        name: 'profile',
        message: 'Choose a profile',
        choices: choices,
        initial: choices.findIndex(
          (choice) => choice.value === currentProfile || choice.value === profiles[0]
        ),
      },
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

  const profileAnswers = await prompts(
    [
      {
        type: 'text',
        name: 'accessKey',
        message: 'Access key',
        initial: selectedProfile.awsAccessKeyId,
      },
      {
        type: 'text',
        name: 'secretKey',
        message: 'Secret key',
        initial: selectedProfile.awsSecretAccessKey,
      },
      {
        type: 'text',
        name: 'defaultRegion',
        message: 'Default region',
        initial: selectedProfile.awsDefaultRegion,
      },
      {
        type: 'text',
        name: 'outputFormat',
        message: 'Output format',
        initial: selectedProfile.awsOutputFormat,
      },
    ],
    { onCancel: () => onCancel() }
  );

  deleteProfile(profileName);
  createProfile({
    profileName: profileName,
    awsAccessKeyId: profileAnswers.accessKey,
    awsSecretAccessKey: profileAnswers.secretKey,
    awsDefaultRegion: profileAnswers.defaultRegion,
    awsOutputFormat: profileAnswers.outputFormat,
    mfaEnabled: false,
  });

  console.log(chalk.green(`Disabled MFA on profile '${profileName}'`));
};

const awsx = (): void => {
  try {
    configFileCheck();
  } catch {
    process.exit(1);
  }

  updateNotifier({ pkg }).notify();

  yargs
    .scriptName('awsx')
    .usage('$0 [command]')
    .command({
      command: '$0 [profile] [assume-role-profile]',
      describe: 'Switch profiles',
      builder: (
        yargs
      ): Argv<{ profile?: string; assumeRoleProfile?: string; forceMfa?: boolean }> =>
        yargs
          .positional('profile', {
            describe: 'The name of the profile to switch to',
            type: 'string',
          })
          .positional('assume-role-profile', {
            describe: 'The name of the assumed role profile to switch to',
            type: 'string',
          })
          .option('force-mfa', {
            alias: 'f',
            describe: 'If the selected profile has MFA enabled, forces a new MFA login',
            type: 'boolean',
            default: false,
          }),
      handler: async (args: {
        profile?: string;
        assumeRoleProfile?: string;
        forceMfa?: boolean;
      }): Promise<void> => {
        try {
          initConfig();
          await switchProfile(args.profile, args.assumeRoleProfile, args.forceMfa);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
    })
    .command({
      command:
        'add-profile [profile] [access-key] [secret-key] [key-max-age] [default-region] [output-format] [mfa-arn] [mfa-expiry]',
      describe: 'Add profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
        'access-key'?: string;
        'secret-key'?: string;
        'key-max-age'?: number;
        'default-region'?: string;
        'output-format'?: string;
        'mfa-arn'?: string;
        'mfa-expiry'?: number;
      }> =>
        yargs
          .positional('profile', {
            type: 'string',
            describe: 'The name of the profile to create',
          })
          .positional('access-key', {
            type: 'string',
            describe: 'The access key for the new profile',
          })
          .positional('secret-key', {
            type: 'string',
            describe: 'The secret key for the new profile',
          })
          .positional('key-max-age', {
            type: 'number',
            describe: 'The secret key maximum age in days',
          })
          .positional('default-region', {
            type: 'string',
            describe: 'The default AWS region for the new profile',
          })
          .positional('output-format', {
            type: 'string',
            describe: 'The default AWS CLI output format for the new profile',
          })
          .positional('mfa-arn', {
            type: 'string',
            describe: 'The ARN of the MFA device for the new profile',
          })
          .positional('mfa-expiry', {
            type: 'number',
            describe: 'MFA session token duration in seconds (between 900 and 129600)',
            default: 3600,
          })
          .implies('profile', ['access-key', 'secret-key']),
      handler: async (args: {
        profile?: string;
        accessKey?: string;
        secretKey?: string;
        keyMaxAge?: number;
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
            args.keyMaxAge,
            args.defaultRegion,
            args.outputFormat,
            args.mfaArn,
            args.mfaExpiry
          );
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
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
          describe: 'The name of the profile to delete',
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await removeProfile(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
    })
    .command({
      command: 'current-profile',
      describe: 'Show the current profile',
      handler: (): void => {
        console.log(chalk.green(`${currentProfile}`));
      },
    })
    .command({
      command:
        'add-assume-role-profile [profile] [parent-profile] [role-arn] [default-region] [output-format]',
      describe: 'Add assume role profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
        'parent-profile'?: string;
        'role-arn'?: string;
        'default-region'?: string;
        'output-format'?: string;
      }> =>
        yargs
          .positional('profile', {
            type: 'string',
            describe: 'The name of the profile to create',
          })
          .positional('parent-profile', {
            type: 'string',
            describe: 'The name of the parent profile',
          })
          .positional('role-arn', {
            type: 'string',
            describe: 'The arn of the role to assume',
          })
          .implies('profile', ['parent-profile', 'role-arn']),
      handler: async (args: {
        profile?: string;
        parentProfile?: string;
        roleArn?: string;
      }): Promise<void> => {
        try {
          initConfig();
          await addAssumeRoleProfile(args.profile, args.parentProfile, args.roleArn);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
    })
    .command({
      command: 'remove-assume-role-profile [profile]',
      describe: 'Remove assume role profile',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
      }> =>
        yargs.positional('profile', {
          type: 'string',
          describe: 'The name of the profile to delete',
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await removeAssumeRoleProfile(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
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
          describe: 'The name of the profile to enable MFA',
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await enableMfa(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
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
          describe: 'The name of the profile to disable MFA',
        }),
      handler: async (args: { profile?: string }): Promise<void> => {
        try {
          await disableMfa(args.profile);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      },
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
      },
    })
    .command({
      command: ['whoami', 'status'],
      describe: "Show what AWS account and identity you're using",
      handler: async (): Promise<void> => {
        try {
          await whoami();
        } catch (error) {
          console.log(chalk.red(error.message));
        }
      },
    })
    .command({
      command: 'set-key-max-age [profile] [max-age]',
      describe: 'Set maximum age of AWS access key in days',
      builder: (
        yargs
      ): Argv<{
        profile?: string;
      }> =>
        yargs
          .positional('profile', {
            type: 'string',
            describe: 'The name of the profile to add expiry to',
          })
          .positional('max-age', {
            type: 'number',
            describe: 'Maximum age of access key in days',
          }),
      handler: async (args: { profile?: string; maxAge?: number }): Promise<void> => {
        try {
          await setKeyMaxAge(args.profile, args.maxAge);
        } catch (error) {
          console.log(chalk.red(error.message));
        }
      },
    })
    .wrap(yargs.terminalWidth() <= 120 ? yargs.terminalWidth() : 120)
    .help().argv;
};

if (process.env.NODE_ENV === 'development') {
  awsx();
}

export default awsx;
export { validateMfaExpiry };
