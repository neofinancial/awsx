# awsx

[![Build status](https://github.com/neofinancial/awsx/workflows/CI/badge.svg)](https://github.com/neofinancial/awsx/actions)
![TypeScript 3.7.2](https://img.shields.io/badge/TypeScript-3.7.4-brightgreen.svg)

AWS CLI profile switcher with MFA support.

## Usage

### Installation

```sh
// npm
npm install -g awsx

// yarn
yarn global add awsx
```

Add the following to your `.bash_profile` or `.bashrc`:

```sh
alias awsx="source _awsx"
```

Reload your profile by launching a new shell or running `source ~/.bash_profile`.

### Switching profiles

#### `awsx`

### Adding a new profile

#### `awsx add-profile [profile] [access-key] [secret-key] [default-region] [output-format] [mfa-arn] [mfa-expiry]`

> NOTE: If you don't provide inputs you will be prompted for them.

### Adding MFA support to an existing profile

#### `awsx enable-mfa [profile]`

### Removing MFA support from an existing profile

#### `awsx disable-mfa [profile]`

### Removing a profile

#### `awsx remove-profile [profile]`

## Contributing

1. Fork this repo
1. Clone the forked repo
1. Install dependencies: `yarn`

### Development

#### `yarn start`

### Building

#### `yarn build`

To clean the build directory run `yarn clean`

### Testing

#### `yarn test`

## Publishing

1. Update the version in `package.json`
1. Add a `CHANGELOG` entry
1. Commit your changes
1. Run `npm pack --dry-run` to see what will be published
1. Run `npm publish`
1. Create a release on GitHub. Use the version as the tag and release name. For example for version `1.0.0` the tag and release name would be `v1.0.0`.

## Credits

This project was inspired by [awsp](https://github.com/johnnyopao/awsp)
