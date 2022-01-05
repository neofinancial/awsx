import { promisify } from 'util';

const timeout = promisify(setTimeout);

const getKeyAgeInDays = (createdDate: number): number => {
  return Math.floor((new Date().getTime() - createdDate) / (1000 * 24 * 60 * 60));
};

export { timeout, getKeyAgeInDays };
