import fs from 'fs';

const AWSX_HOME = `${process.env.HOME}/.awsx`;

const PROFILE_PATH = `${AWSX_HOME}/export-profile`;
const ACCESS_KEY_PATH = `${AWSX_HOME}/export-access-key`;
const SECRET_KEY_PATH = `${AWSX_HOME}/export-secret-key`;
const SESSION_TOKEN_PATH = `${AWSX_HOME}/export-session-token`;

const exportEnvironmentVariables = (
  profile: string,
  accessKey: string,
  secretKey: string,
  sessionToken?: string
): void => {
  fs.writeFileSync(PROFILE_PATH, profile);
  fs.writeFileSync(ACCESS_KEY_PATH, accessKey);
  fs.writeFileSync(SECRET_KEY_PATH, secretKey);
  if (sessionToken) {
    fs.writeFileSync(SESSION_TOKEN_PATH, sessionToken);
  }
};

export default exportEnvironmentVariables;
