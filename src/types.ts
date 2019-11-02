export interface ProfileConfiguration {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  mfaEnabled: boolean;
  mfaDeviceArn: string;
  lastLoginTimeInSeconds: number;
  sessionLengthInSeconds: number;
}

export interface AWSCredentials {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken: string;
  toAwsFormat(): string
}
