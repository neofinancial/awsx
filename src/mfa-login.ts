import chalk from 'chalk';
import { STS, GetSessionTokenRequest, Credentials } from '@aws-sdk/client-sts';

export interface ProfileConfiguration {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSecretAccessKeyExpiry?: number;
  awsDefaultRegion: string;
  awsOutputFormat: string;
  mfaEnabled: boolean;
  mfaDeviceArn?: string;
  lastLoginTimeInSeconds?: number;
  sessionLengthInSeconds?: number;
  mfaSessionValid?: boolean;
}

export interface AssumeRoleProfileConfiguration {
  profileName: string;
  parentProfileName: string;
  awsRoleArn: string;
  awsDefaultRegion: string;
  awsOutputFormat: string;
}

export interface AWSCredentials {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken: string;
}

const createStsClient = (configuration: ProfileConfiguration): STS => {
  return new STS({
    credentials: {
      accessKeyId: configuration.awsAccessKeyId,
      secretAccessKey: configuration.awsSecretAccessKey,
    },
    region: configuration.awsDefaultRegion,
  });
};

const createStsParameters = (
  configuration: ProfileConfiguration,
  mfaToken: string
): GetSessionTokenRequest => {
  return {
    DurationSeconds: configuration.sessionLengthInSeconds,
    SerialNumber: configuration.mfaDeviceArn,
    TokenCode: mfaToken,
  };
};

const createTemporaryCredentials = (
  profileName: string,
  credentials: Credentials
): AWSCredentials => {
  if (!credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
    console.error(chalk.red(`${profileName} temporary credentials are invalid`));

    process.exit(1);
  }

  return {
    profileName: profileName,
    awsAccessKeyId: credentials.AccessKeyId,
    awsSecretAccessKey: credentials.SecretAccessKey,
    awsSessionToken: credentials.SessionToken,
  };
};

const getTemporaryCredentials = async (
  configuration: ProfileConfiguration,
  mfaToken: string,
  onLogin: (credentials: AWSCredentials) => Promise<void>
): Promise<void> => {
  const stsParameters = createStsParameters(configuration, mfaToken);

  const response = await createStsClient(configuration).getSessionToken(stsParameters);
  const identity = await createStsClient(configuration).getCallerIdentity({});

  console.log(chalk.green(`${identity.Account} - ${identity.UserId} - ${identity.Arn}`));

  if (
    response.Credentials?.AccessKeyId &&
    response.Credentials?.SecretAccessKey &&
    response.Credentials?.SessionToken
  ) {
    onLogin(createTemporaryCredentials(configuration.profileName, response.Credentials));
  }
};

export default getTemporaryCredentials;
