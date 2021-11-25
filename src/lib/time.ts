import { promisify } from 'util';

const timeout = promisify(setTimeout);

export { timeout };
