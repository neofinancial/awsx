import * as fs from 'fs';

import { AWSCredentials } from './types';

const awsCredentialsFilePath = '/path/to/aws/credentials';

const createProfileRegex = (profile: string): RegExp => {
  return new RegExp('^.*' + profile + '((.|\\s)*?(?=\\[)|(.|\\s)*)', 'gm');
};

function replaceExistingProfile(
  credentialsFileContents: string,
  temporaryCredentials: AWSCredentials
): void {
  fs.writeFileSync(
    awsCredentialsFilePath,
    credentialsFileContents.replace(
      createProfileRegex(temporaryCredentials.profileName),
      `${temporaryCredentials.toAwsFormat()}\r\n`
    )
  );
}

function appendNewProfile(temporaryCredentials: AWSCredentials): void {
  fs.appendFile(
    awsCredentialsFilePath,
    `\r\n${temporaryCredentials.toAwsFormat()}\r\n`,
    'utf-8',
    (err): void => {
      if (err) {
        throw new Error('Failed to append profile to AWS credentials file...');
      }
    }
  );
}

export default function overwriteProfile(temporaryCredentials: AWSCredentials): void {
  fs.readFile(awsCredentialsFilePath, 'utf-8', (err, data): void => {
    if (err) {
      console.log('No existing AWS credentials file found, writing file...');
      fs.writeFileSync(awsCredentialsFilePath, temporaryCredentials.toAwsFormat());

      return;
    }

    if (data.match(createProfileRegex(temporaryCredentials.profileName))) {
      replaceExistingProfile(data, temporaryCredentials);
    } else {
      appendNewProfile(temporaryCredentials);
    }
  });
}
