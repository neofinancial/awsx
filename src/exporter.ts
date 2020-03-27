import fs from 'fs';

import { AWSX_HOME } from './config';

const EXPORTS_PATH = `${AWSX_HOME}/exports.sh`;

const exportEnvironmentVariables = (profile: string): void => {
  fs.writeFileSync(EXPORTS_PATH, `export AWS_PROFILE=${profile}`);
};

export default exportEnvironmentVariables;
