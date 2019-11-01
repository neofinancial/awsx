export interface ProfileConfiguration {
  profileName: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  mfaEnabled: boolean;
  mfaDeviceArn: string;
  lastLoginTimeInSeconds: number;
}

export interface AWSCredentials {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken: string;
  toAwsFormat(): string
}
