import chalk from 'chalk';

const onCancel = (text?: string): void => {

  if (text) {
    console.log(chalk.yellow(`⚠ ${text}`));
  }

  return process.exit(1);
};

export { onCancel };
