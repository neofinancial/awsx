/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import ini from 'ini';
import path from 'path';

import { ProfileConfiguration, AWSCredentials, AssumeRoleProfileConfiguration } from './mfa-login';

const HOME = process.env.HOME as string;
const AWSX_HOME = path.join(HOME, '.awsx');
const AWS_HOME = path.join(HOME, '.aws');
const AWSX_PROFILE_PATH = path.join(AWSX_HOME, 'profiles');
const AWS_CREDENTIALS_PATH = path.join(AWS_HOME, 'credentials');
const AWS_CONFIG_PATH = path.join(AWS_HOME, 'config');

const configFileCheck = (): void => {
  const hasCredentials = fs.existsSync(AWS_CREDENTIALS_PATH);
  const hasConfig = fs.existsSync(AWS_CONFIG_PATH);

  !hasCredentials && console.error(`You are missing a required file at: ${AWS_CREDENTIALS_PATH}`);

  !hasConfig && console.error(`You are missing a required file at: ${AWS_CONFIG_PATH}`);

  if (!hasCredentials || !hasConfig) {
    console.error(
      `Run aws configure to fix this error: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html`
    );

    throw new Error('Missing a required configuration file');
  }
};

const copyFileIfExists = (sourcePath: string, destPath: string): void => {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
  }
};

const backupConfig = (): void => {
  const backupSuffix = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

  copyFileIfExists(AWS_CONFIG_PATH, `${AWS_CONFIG_PATH}.${backupSuffix}`);
  copyFileIfExists(AWS_CREDENTIALS_PATH, `${AWS_CREDENTIALS_PATH}.${backupSuffix}`);
  copyFileIfExists(AWSX_PROFILE_PATH, `${AWSX_PROFILE_PATH}.${backupSuffix}`);
};

const initConfig = (): void => {
  if (!fs.existsSync(AWS_HOME)) {
    fs.mkdirSync(AWS_HOME);
  }

  if (!fs.existsSync(AWSX_HOME)) {
    fs.mkdirSync(AWSX_HOME);

    backupConfig();
  }
};

const isMfaSessionStillValid = (
  lastLoginTimeInSeconds: number,
  sessionLengthInSeconds: number
): boolean => {
  return (
    lastLoginTimeInSeconds + (sessionLengthInSeconds - 30) > Math.floor(new Date().getTime() / 1000)
  );
};

const getConfig = (filePath: string): any => {
  try {
    return ini.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
};

const getProfiles = (): ProfileConfiguration[] => {
  const awsxConfig = getConfig(AWSX_PROFILE_PATH);
  const awsCredentials = getConfig(AWS_CREDENTIALS_PATH);
  const awsConfig = getConfig(AWS_CONFIG_PATH);

  const profiles = [];

  for (const profile in awsCredentials) {
    if (awsxConfig[profile]?.mfaEnabled) {
      profiles.push({
        profileName: awsxConfig[profile].profileName,
        awsAccessKeyId: awsxConfig[profile].awsAccessKeyId,
        awsSecretAccessKey: awsxConfig[profile].awsSecretAccessKey,
        awsSecretAccessKeyExpiry: Number(awsxConfig[profile]?.awsSecretAccessKeyExpiry),
        awsDefaultRegion: awsConfig[profile] ? awsConfig[profile].region : null,
        awsOutputFormat: awsConfig[profile] ? awsConfig[profile].output : null,
        mfaEnabled: true,
        mfaDeviceArn: awsxConfig[profile].mfaDeviceArn,
        lastLoginTimeInSeconds: Number(awsxConfig[profile].lastLoginTimeInSeconds),
        sessionLengthInSeconds: Number(awsxConfig[profile].sessionLengthInSeconds),
        mfaSessionValid: isMfaSessionStillValid(
          Number(awsxConfig[profile].lastLoginTimeInSeconds),
          Number(awsxConfig[profile].sessionLengthInSeconds)
        ),
      });
    } else {
      profiles.push({
        profileName: profile,
        awsAccessKeyId: awsCredentials[profile].aws_access_key_id,
        awsSecretAccessKey: awsCredentials[profile].aws_secret_access_key,
        awsSecretAccessKeyExpiry: Number(awsxConfig[profile]?.awsSecretAccessKeyExpiry),
        awsDefaultRegion: awsConfig[profile] ? awsConfig[profile].region : null,
        awsOutputFormat: awsConfig[profile] ? awsConfig[profile].output : null,
        mfaEnabled: false,
      });
    }
  }

  return profiles;
};

const getProfileNames = (): string[] => {
  return getProfiles().map((profile) => profile.profileName);
};

const getProfile = (profileName: string): ProfileConfiguration | undefined => {
  return getProfiles().find((profile) => profile.profileName === profileName);
};

const getCredentials = (profileName: string): AWSCredentials | null => {
  const credentials = getConfig(AWS_CREDENTIALS_PATH)[profileName];

  if (!credentials) {
    return null;
  }

  return {
    profileName: profileName,
    awsAccessKeyId: credentials.aws_access_key_id,
    awsSecretAccessKey: credentials.aws_secret_access_key,
    awsSessionToken: credentials.aws_session_token,
  };
};

const writeConfig = (filePath: string, object: any): void => {
  fs.writeFileSync(filePath, ini.stringify(object));
};

const writeTemporaryCredentials = (
  profile: ProfileConfiguration,
  credentials: AWSCredentials
): void => {
  if (profile.mfaEnabled) {
    // record login time
    const awsxProfiles = getConfig(AWSX_PROFILE_PATH);

    awsxProfiles[profile.profileName].lastLoginTimeInSeconds = Math.floor(
      new Date().getTime() / 1000
    );

    writeConfig(AWSX_PROFILE_PATH, awsxProfiles);

    // write temporary credentials to aws credentials file
    const awsCredentials = getConfig(AWS_CREDENTIALS_PATH);

    awsCredentials[profile.profileName] = {
      aws_access_key_id: credentials.awsAccessKeyId,
      aws_secret_access_key: credentials.awsSecretAccessKey,
      aws_session_token: credentials.awsSessionToken,
    };

    writeConfig(AWS_CREDENTIALS_PATH, awsCredentials);
  }
};

const createProfile = (profile: ProfileConfiguration): void => {
  if (profile.mfaEnabled) {
    const awsxConfig = getConfig(AWSX_PROFILE_PATH);

    awsxConfig[profile.profileName] = profile;
    writeConfig(AWSX_PROFILE_PATH, awsxConfig);
  }

  const awsConfig = getConfig(AWS_CONFIG_PATH);

  awsConfig[profile.profileName] = {
    region: profile.awsDefaultRegion,
    output: profile.awsOutputFormat,
  };

  writeConfig(AWS_CONFIG_PATH, awsConfig);

  const awsCredentials = getConfig(AWS_CREDENTIALS_PATH);

  awsCredentials[profile.profileName] = {
    aws_access_key_id: profile.awsAccessKeyId,
    aws_secret_access_key: profile.awsSecretAccessKey,
  };

  writeConfig(AWS_CREDENTIALS_PATH, awsCredentials);
};

const deleteProfile = (profileName: string): void => {
  const awsxConfig = getConfig(AWSX_PROFILE_PATH);

  delete awsxConfig[profileName];
  writeConfig(AWSX_PROFILE_PATH, awsxConfig);

  const awsConfig = getConfig(AWS_CONFIG_PATH);

  delete awsConfig[profileName];
  writeConfig(AWS_CONFIG_PATH, awsConfig);

  const awsCredentials = getConfig(AWS_CREDENTIALS_PATH);

  delete awsCredentials[profileName];
  writeConfig(AWS_CREDENTIALS_PATH, awsCredentials);
};

const getAssumeRoleProfiles = (parentProfile?: string): AssumeRoleProfileConfiguration[] => {
  const awsConfig = getConfig(AWS_CONFIG_PATH);

  const profiles: AssumeRoleProfileConfiguration[] = [];

  for (const profile of Object.keys(awsConfig)) {
    if (awsConfig[profile]?.role_arn) {
      profiles.push({
        profileName: profile,
        parentProfileName: awsConfig[profile].source_profile,
        awsRoleArn: awsConfig[profile].role_arn,
        awsDefaultRegion: awsConfig[profile].region,
        awsOutputFormat: awsConfig[profile].output,
      });
    }
  }

  if (parentProfile) {
    return profiles.filter((profile) => profile.parentProfileName === parentProfile);
  } else {
    return profiles;
  }
};

const getAssumeRoleProfile = (profileName: string): AssumeRoleProfileConfiguration | undefined => {
  return getAssumeRoleProfiles().find(
    (profile) => profile.profileName === `profile ${profileName}`
  );
};

const createAssumeRoleProfile = (profile: AssumeRoleProfileConfiguration): void => {
  const awsConfig = getConfig(AWS_CONFIG_PATH);

  awsConfig[`profile ${profile.profileName}`] = {
    role_arn: profile.awsRoleArn,
    source_profile: profile.parentProfileName,
    region: profile.awsDefaultRegion,
    output: profile.awsOutputFormat,
  };

  writeConfig(AWS_CONFIG_PATH, awsConfig);
};

const deleteAssumeRoleProfile = (profileName: string): void => {
  const awsConfig = getConfig(AWS_CONFIG_PATH);

  delete awsConfig[`profile ${profileName}`];
  writeConfig(AWS_CONFIG_PATH, awsConfig);
};

export {
  configFileCheck,
  backupConfig,
  initConfig,
  isMfaSessionStillValid,
  getProfileNames,
  getProfile,
  getCredentials,
  writeTemporaryCredentials,
  createProfile,
  deleteProfile,
  getAssumeRoleProfiles,
  getAssumeRoleProfile,
  createAssumeRoleProfile,
  deleteAssumeRoleProfile,
  AWSX_HOME,
};
