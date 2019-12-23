import fs from 'fs';

import { AWSX_HOME } from './config';

const EXPORTS_PATH = `${AWSX_HOME}/exports.sh`;

const exportEnvironmentVariables = (
  profile: string,
  accessKey: string,
  secretKey: string,
  defaultRegion?: string,
  outputFormat?: string,
  sessionToken?: string
): void => {
  let exportScript = `export AWS_PROFILE=${profile} AWS_ACCESS_KEY_ID=${accessKey} AWS_SECRET_ACCESS_KEY=${secretKey}`;

  if (defaultRegion) {
    exportScript += ` AWS_DEFAULT_REGION=${defaultRegion}`;
  }

  if (sessionToken) {
    exportScript += ` AWS_SESSION_TOKEN=${sessionToken}`;
  } else {
    exportScript += ` AWS_SESSION_TOKEN=""`;
  }

  if (outputFormat) {
    exportScript += ` AWS_DEFAULT_OUTPUT=${outputFormat}`;
  }

  fs.writeFileSync(EXPORTS_PATH, exportScript);
};

export default exportEnvironmentVariables;
