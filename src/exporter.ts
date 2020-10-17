import fs from 'fs';
import path from 'path';

import { AWSX_HOME } from './config';

const EXPORTS_PATH = path.join(AWSX_HOME, 'exports.sh');

const exportEnvironmentVariables = (profile: string): void => {
  fs.writeFileSync(EXPORTS_PATH, `export AWS_PROFILE="${profile}" AWS_SDK_LOAD_CONFIG="true"`);
};

export default exportEnvironmentVariables;
