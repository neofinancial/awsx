import { promisify } from 'util';

const timeout = promisify(setTimeout);

const getExpiryDateInSeconds = (days = 90): number => {
  return Math.floor(new Date().getTime() / 1000) + days * 24 * 60 * 60;
};

const getDaysBeforeExpiry = (expiryDateInSeconds: number): number => {
  return Math.floor(
    (expiryDateInSeconds - Math.floor(new Date().getTime() / 1000)) / (24 * 60 * 60)
  );
};

export { timeout, getExpiryDateInSeconds, getDaysBeforeExpiry };
