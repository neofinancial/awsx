import chalk from 'chalk';
import yargs, { Argv } from 'yargs';

const sayHello = (name: string = 'World'): void => {
  console.log(chalk.blue(`Hello ${name}!`));
};

yargs
  .scriptName('awsx')
  .usage('$0 [name]')
  .command({
    command: '$0 [name]',
    describe: 'Say hello',
    builder: (yargs): Argv<{ name: string }> =>
      yargs.positional('name', {
        default: 'World',
        describe: 'Who to say hello to',
        type: 'string'
      }),
    handler: (args: { name: string }): void => {
      sayHello(args.name);
    }
  })
  .demandCommand(1)
  .help().argv;
