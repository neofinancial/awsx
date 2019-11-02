import AWS, { STS, AWSError } from 'aws-sdk';
import { GetSessionTokenRequest } from 'aws-sdk/clients/sts';

import { ProfileConfiguration, AWSCredentials } from './types';

function createStsClient(configuration: ProfileConfiguration): AWS.STS {
  AWS.config.credentials = new AWS.Credentials(
    configuration.awsAccessKeyId,
    configuration.awsSecretAccessKey
  );

  return new AWS.STS();
}

function createStsParameters(
  configuration: ProfileConfiguration,
  mfaToken: string
): GetSessionTokenRequest {
  return {
    DurationSeconds: configuration.sessionLengthInSeconds,
    SerialNumber: configuration.mfaDeviceArn,
    TokenCode: mfaToken
  };
}

function createTemporaryCredentials(
  profileName: string,
  credentials: STS.Credentials
): AWSCredentials {
  return {
    profileName: profileName,
    awsAccessKeyId: credentials.AccessKeyId,
    awsSecretAccessKey: credentials.SecretAccessKey,
    awsSessionToken: credentials.SessionToken,
    toAwsFormat: (): string => {
      return `[${profileName}]\r\naws_access_key_id = ${credentials.AccessKeyId}\r\naws_secret_access_key = ${credentials.SecretAccessKey}\r\naws_session_token = ${credentials.SessionToken}`;
    }
  };
}

export default function getTemporaryCredentials(
  configuration: ProfileConfiguration,
  mfaToken: string
): AWSCredentials {
  let temporaryCredentials = {};

  const stsParameters = createStsParameters(configuration, mfaToken);
  createStsClient(configuration).getSessionToken(
    stsParameters,
    (err: AWSError, data: STS.Types.GetSessionTokenResponse): void => {
      if (err) {
        throw err;
      }

      if (data && data.Credentials) {
        temporaryCredentials = createTemporaryCredentials(
          configuration.profileName,
          data.Credentials
        );
      }
    }
  );

  return temporaryCredentials as AWSCredentials;
}
