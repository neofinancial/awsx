import { promisify } from 'util';

const timeout = promisify(setTimeout);

const getExpiryDateInSeconds = (days = 90): number => {
  return Math.floor(new Date().getTime() / 1000) + days * 24 * 60 * 60;
};

const getDaysAfterCreated = (createdDate: number): number => {
  return Math.floor((new Date().getTime() - createdDate) / (1000 * 24 * 60 * 60));
};

const DEFAULT_SECRET_KEY_EXPIRY_DAYS = 90;

export { timeout, getExpiryDateInSeconds, getDaysAfterCreated, DEFAULT_SECRET_KEY_EXPIRY_DAYS };
