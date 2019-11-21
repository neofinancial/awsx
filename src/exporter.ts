import fs from 'fs';

const AWSX_HOME = `${process.env.HOME}/.awsx`;

const EXPORTS_PATH = `${AWSX_HOME}/exports.sh`;

const exportEnvironmentVariables = (
  profile: string,
  accessKey: string,
  secretKey: string,
  sessionToken?: string
): void => {
  let exportScript = `export AWS_PROFILE=${profile} AWS_ACCESS_KEY_ID=${accessKey} AWS_SECRET_ACCESS_KEY=${secretKey}`;

  if (sessionToken) {
    exportScript += ` AWS_SESSION_TOKEN=${sessionToken}`;
  }

  fs.writeFileSync(EXPORTS_PATH, exportScript);
};

export default exportEnvironmentVariables;
