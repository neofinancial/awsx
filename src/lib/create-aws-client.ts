import { IAMClient } from '@aws-sdk/client-iam';
import { STS } from '@aws-sdk/client-sts';

import { AWSCredentials, ProfileConfiguration } from '../mfa-login';

const createIAMClient = (credentials: AWSCredentials, region: string): IAMClient => {
  return new IAMClient({
    credentials: {
      accessKeyId: credentials.awsAccessKeyId,
      secretAccessKey: credentials.awsSecretAccessKey,
      sessionToken: credentials.awsSessionToken,
    },
    region,
  });
};

const createStsClient = (configuration: ProfileConfiguration): STS => {
  return new STS({
    credentials: {
      accessKeyId: configuration.awsAccessKeyId,
      secretAccessKey: configuration.awsSecretAccessKey,
    },
    region: configuration.awsDefaultRegion,
  });
};

export { createStsClient, createIAMClient };
