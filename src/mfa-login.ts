import AWS, { STS, AWSError } from 'aws-sdk';
import { GetSessionTokenRequest } from 'aws-sdk/clients/sts';

export interface ProfileConfiguration {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsDefaultRegion: string;
  mfaEnabled: boolean;
  mfaDeviceArn?: string;
  lastLoginTimeInSeconds?: number;
  sessionLengthInSeconds?: number;
  mfaSessionValid?: boolean;
}

export interface AWSCredentials {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken: string;
}

const createStsClient = (configuration: ProfileConfiguration): AWS.STS => {
  AWS.config.credentials = new AWS.Credentials(
    configuration.awsAccessKeyId,
    configuration.awsSecretAccessKey
  );

  return new AWS.STS();
};

const createStsParameters = (
  configuration: ProfileConfiguration,
  mfaToken: string
): GetSessionTokenRequest => {
  return {
    DurationSeconds: configuration.sessionLengthInSeconds,
    SerialNumber: configuration.mfaDeviceArn,
    TokenCode: mfaToken
  };
};

const createTemporaryCredentials = (
  profileName: string,
  credentials: STS.Credentials
): AWSCredentials => {
  return {
    profileName: profileName,
    awsAccessKeyId: credentials.AccessKeyId,
    awsSecretAccessKey: credentials.SecretAccessKey,
    awsSessionToken: credentials.SessionToken,
  };
};

const getTemporaryCredentials = (
  configuration: ProfileConfiguration,
  mfaToken: string,
  onLogin: (credentials: AWSCredentials) => void
): void => {
  const stsParameters = createStsParameters(configuration, mfaToken);

  createStsClient(configuration).getSessionToken(
    stsParameters,
    (err: AWSError, data: STS.Types.GetSessionTokenResponse): void => {
      if (err) {
        throw err;
      }

      if (data && data.Credentials) {
        onLogin(createTemporaryCredentials(configuration.profileName, data.Credentials));
      }
    }
  );
};

export default getTemporaryCredentials;
