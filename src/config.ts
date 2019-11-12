import fs from 'fs';
import ini from 'ini';

import { ProfileConfiguration } from './mfa-login';

const AWSX_HOME = `${process.env.HOME}/.awsx`;
const AWS_HOME = `${process.env.HOME}/.aws`;

const AWSX_PROFILE_PATH = `${AWSX_HOME}/profiles`;
const AWS_CREDENTIALS_PATH = `${AWS_HOME}/credentials`;

const initConfig = (): void => {
  const awsxHomeExists = fs.existsSync(AWSX_HOME);
  if (!awsxHomeExists) {
    fs.mkdirSync(AWSX_HOME);
  }
};

const printConfig = (): void => {
  console.log('awsx profiles', ini.parse(fs.readFileSync(AWSX_PROFILE_PATH, 'utf-8')));
  console.log('aws credentials', ini.parse(fs.readFileSync(AWS_CREDENTIALS_PATH, 'utf-8')));
};

const addNewProfile = (profile: ProfileConfiguration): void => {
  initConfig();

  let existingProfiles;
  try {
    existingProfiles = ini.parse(fs.readFileSync(AWSX_PROFILE_PATH, 'utf-8'));
  } catch (err) {
    existingProfiles = {};
  }

  existingProfiles[profile.profileName] = profile;

  fs.writeFileSync(AWSX_PROFILE_PATH, ini.stringify(existingProfiles));
};

const getProfiles = (): ProfileConfiguration[] => {
  let config;
  try {
    config = ini.parse(fs.readFileSync(AWSX_PROFILE_PATH, 'utf-8'));
  } catch (err) {
    config = {};
  }

  const profiles: ProfileConfiguration[] = [];
  for (const profileName in config) {
    profiles.push(config[profileName]);
  }

  return profiles;
};

const getProfileNames = (): string[] => {
  return getProfiles().map(profile => profile.profileName);
};

const getProfile = (profileName: string): ProfileConfiguration | undefined => {
  return getProfiles().find(profile => profile.profileName === profileName);
};

export { printConfig, addNewProfile, initConfig, getProfile, getProfileNames };
