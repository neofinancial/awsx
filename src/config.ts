/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/camelcase */
import fs from 'fs';
import ini from 'ini';

import { ProfileConfiguration, AWSCredentials } from './mfa-login';

export const AWSX_HOME = `${process.env.HOME}/.awsx`;

const AWS_HOME = `${process.env.HOME}/.aws`;
const AWSX_PROFILE_PATH = `${AWSX_HOME}/profiles`;
const AWSX_BACKUP_PATH = `${AWSX_HOME}/backup`;
const AWS_CREDENTIALS_PATH = `${AWS_HOME}/credentials`;
const AWS_CONFIG_PATH = `${AWS_HOME}/config`;
const AWSX_CREDENTIALS_BACKUP_PATH = `${AWSX_BACKUP_PATH}/credentials`;
const AWSX_CONFIG_BACKUP_PATH = `${AWSX_BACKUP_PATH}/config`;

const initConfig = (): void => {
  if (!fs.existsSync(AWS_HOME)) {
    fs.mkdirSync(AWS_HOME);
  }

  if (!fs.existsSync(AWSX_HOME)) {
    fs.mkdirSync(AWSX_HOME);
    fs.mkdirSync(AWSX_BACKUP_PATH);

    //first time run, back up their aws credentials and config
    if (fs.existsSync(AWS_CREDENTIALS_PATH)) {
      fs.copyFileSync(AWS_CREDENTIALS_PATH, AWSX_CREDENTIALS_BACKUP_PATH);
    }

    if (fs.existsSync(AWS_CONFIG_PATH)) {
      fs.copyFileSync(AWS_CONFIG_PATH, AWSX_CONFIG_BACKUP_PATH);
    }
  }
};

const getConfig = (filePath: string): any => {
  try {
    return ini.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return {};
  }
};

const writeConfig = (filePath: string, object: any): void => {
  fs.writeFileSync(filePath, ini.stringify(object));
};

const addNewProfile = (profile: ProfileConfiguration): void => {
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

const isMfaSessionStillValid = (
  lastLoginTimeInSeconds: number,
  sessionLengthInSeconds: number
): boolean => {
  return (
    lastLoginTimeInSeconds + (sessionLengthInSeconds - 30) > Math.floor(new Date().getTime() / 1000)
  );
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

export {
  writeTemporaryCredentials,
  addNewProfile,
  deleteProfile,
  initConfig,
  getProfile,
  getProfileNames,
  getCredentials
};
