import { promisify } from 'util';

const getCurrentProfile = (): string => {
  return process.env.AWS_PROFILE || '';
};

const timeout = async (): Promise<void> => {
  const delay = promisify(setTimeout);

  await delay(1500);
};

export { getCurrentProfile, timeout };
