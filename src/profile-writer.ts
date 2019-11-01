import * as fs from 'fs';

import { AWSCredentials } from './types';

export class ProfileWriter {
  private awsCredentialsFilePath: string;
  private temporaryCredentials: AWSCredentials;
  private profileRegex: RegExp;

  public constructor(
    awsCredentialsFilePath: string,
    profile: string,
    temporaryCredentials: AWSCredentials
  ) {
    this.awsCredentialsFilePath = awsCredentialsFilePath;
    this.temporaryCredentials = temporaryCredentials;
    this.profileRegex = new RegExp('^.*' + profile + '((.|\\s)*?(?=\\[)|(.|\\s)*)', 'gm');
  }

  public overwriteProfile(): void {
    const self = this;

    fs.readFile(self.awsCredentialsFilePath, 'utf-8', (err, data): void => {
      if (err) {
        console.log('No existing AWS credentials file found, writing file...');
        fs.writeFileSync(self.awsCredentialsFilePath, self.temporaryCredentials.toAwsFormat());

        return;
      }

      if (data.match(self.profileRegex)) {
        self.replaceExistingProfile(data);
      } else {
        self.appendNewProfile();
      }
    });
  }

  private replaceExistingProfile(credentialsFileContents: string): void {
    fs.writeFileSync(
      this.awsCredentialsFilePath,
      credentialsFileContents.replace(
        this.profileRegex,
        `${this.temporaryCredentials.toAwsFormat()}\r\n`
      )
    );
  }

  private appendNewProfile(): void {
    fs.appendFile(
      this.awsCredentialsFilePath,
      `\r\n${this.temporaryCredentials.toAwsFormat()}\r\n`,
      'utf-8',
      (err): void => {
        if (err) {
          throw new Error('Failed to append profile to AWS credentials file...');
        }
      }
    );
  }
}
