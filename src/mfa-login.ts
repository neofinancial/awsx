import AWS, { STS } from 'aws-sdk';
import { GetSessionTokenRequest } from 'aws-sdk/clients/sts';

import { ProfileConfiguration, AWSCredentials } from './types';

export class MFALogin {
  private stsClient: STS;
  private mfaDeviceArn: string;
  private mfaToken: string;
  private profileName: string;

  public constructor(configuration: ProfileConfiguration, mfaToken: string) {
    if (!configuration.mfaEnabled) {
      throw new Error(`MFA is disabled for profile ${configuration.profileName}`);
    }

    AWS.config.credentials = new AWS.Credentials(
      configuration.awsAccessKeyId,
      configuration.awsSecretAccessKey
    );

    this.stsClient = new AWS.STS();
    this.mfaDeviceArn = configuration.mfaDeviceArn;
    this.mfaToken = mfaToken;
    this.profileName = configuration.profileName;
  }

  public getTemporaryCredentials(): AWSCredentials {
    const self = this;
    let temporaryCredentials = {};

    this.stsClient.getSessionToken(this.createStsParameters(), (err, data): void => {
      if (err) {
        throw err;
      }

      if (data && data.Credentials) {
        const credentials = data.Credentials;

        temporaryCredentials = {
          awsAccessKeyId: credentials.AccessKeyId,
          awsSecretAccessKey: credentials.SecretAccessKey,
          awsSessionToken: credentials.SessionToken,
          toAwsFormat: (): string => {
            return `[${self.profileName}]\r\naws_access_key_id = ${credentials.AccessKeyId}\r\naws_secret_access_key = ${credentials.SecretAccessKey}\r\naws_session_token = ${credentials.SessionToken}`;
          }
        };
      }
    });

    return temporaryCredentials as AWSCredentials;
  }

  private createStsParameters(): GetSessionTokenRequest {
    return {
      DurationSeconds: 3600, //TODO: get this from config
      SerialNumber: this.mfaDeviceArn,
      TokenCode: this.mfaToken
    };
  }
}
