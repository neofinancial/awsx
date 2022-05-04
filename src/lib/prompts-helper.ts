import chalk from 'chalk';

const onCancel = (text: string): void => {
  console.log(chalk.red(text));

  return process.exit(1);
};

export { onCancel };
