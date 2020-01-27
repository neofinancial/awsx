/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/camelcase */
import fs from 'fs';
import ini from 'ini';

import { ProfileConfiguration, AWSCredentials } from './mfa-login';

export const AWSX_HOME = `${process.env.HOME}/.awsx`;

const AWS_HOME = `${process.env.HOME}/.aws`;

const AWSX_PROFILE_PATH = `${AWSX_HOME}/profiles`;
const AWS_CREDENTIALS_PATH = `${AWS_HOME}/credentials`;
const AWS_CONFIG_PATH = `${AWS_HOME}/config`;

const backupConfig = (): void => {
  const backupSuffix = new Date()
    .toISOString()
    .replace(/[^\d]/g, '')
    .slice(0, 14);

  fs.copyFileSync(AWS_CONFIG_PATH, `${AWS_CONFIG_PATH}.${backupSuffix}`);
  fs.copyFileSync(AWS_CREDENTIALS_PATH, `${AWS_CREDENTIALS_PATH}.${backupSuffix}`);

  if (fs.existsSync(AWSX_PROFILE_PATH)) {
    fs.copyFileSync(AWSX_PROFILE_PATH, `${AWSX_PROFILE_PATH}.${backupSuffix}`);
  }
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
  } catch (error) {
    return {};
  }
};

const getProfiles = (): ProfileConfiguration[] => {
  const awsxConfig = getConfig(AWSX_PROFILE_PATH);
  const awsCredentials = getConfig(AWS_CREDENTIALS_PATH);
  const awsConfig = getConfig(AWS_CONFIG_PATH);

  const profiles = [];

  for (const profile in awsCredentials) {
    if (awsxConfig[profile] && awsxConfig[profile].mfaEnabled) {
      profiles.push({
        profileName: awsxConfig[profile].profileName,
        awsAccessKeyId: awsxConfig[profile].awsAccessKeyId,
        awsSecretAccessKey: awsxConfig[profile].awsSecretAccessKey,
        awsDefaultRegion: awsConfig[profile] ? awsConfig[profile].region : null,
        awsOutputFormat: awsConfig[profile] ? awsConfig[profile].output : null,
        mfaEnabled: true,
        mfaDeviceArn: awsxConfig[profile].mfaDeviceArn,
        lastLoginTimeInSeconds: Number(awsxConfig[profile].lastLoginTimeInSeconds),
        sessionLengthInSeconds: Number(awsxConfig[profile].sessionLengthInSeconds),
        mfaSessionValid: isMfaSessionStillValid(
          Number(awsxConfig[profile].lastLoginTimeInSeconds),
          Number(awsxConfig[profile].sessionLengthInSeconds)
        )
      });
    } else {
      profiles.push({
        profileName: profile,
        awsAccessKeyId: awsCredentials[profile].aws_access_key_id,
        awsSecretAccessKey: awsCredentials[profile].aws_secret_access_key,
        awsDefaultRegion: awsConfig[profile] ? awsConfig[profile].region : null,
        awsOutputFormat: awsConfig[profile] ? awsConfig[profile].output : null,
        mfaEnabled: false
      });
    }
  }

  return profiles;
};

const getProfileNames = (): string[] => {
  return getProfiles().map(profile => profile.profileName);
};

const getProfile = (profileName: string): ProfileConfiguration | undefined => {
  return getProfiles().find(profile => profile.profileName === profileName);
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
    awsSessionToken: credentials.aws_session_token
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
      aws_session_token: credentials.awsSessionToken
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
    output: profile.awsOutputFormat
  };

  writeConfig(AWS_CONFIG_PATH, awsConfig);

  const awsCredentials = getConfig(AWS_CREDENTIALS_PATH);

  awsCredentials[profile.profileName] = {
    aws_access_key_id: profile.awsAccessKeyId,
    aws_secret_access_key: profile.awsSecretAccessKey
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

export {
  backupConfig,
  initConfig,
  getProfileNames,
  getProfile,
  getCredentials,
  writeTemporaryCredentials,
  createProfile,
  deleteProfile
};
