# awsx changelog

## 1.4.2 (May 10, 2022)

- Fixing `mfaArn` validation
- Fixing `whoami` command
- Fixing trailing spaces and verify user credentials
- Add `onCancel` callback on user cancels/exit

## 1.4.1 (April 4, 2022)

- Fixing the value of the `root profile` option to correspond with the name of the profile.

## 1.4.0 (January 4, 2022)

- Warn users when secret key X days old

## 1.3.0 (December 4, 2021)

- Build with Rollup instead of ncc
- Upgrade from v2 to v3 of the AWS JavaScript SDK

## 1.2.0 (October 16, 2021)

- Add `whoami` command
- Deprecate existing `status` command (made alias for `whoami`)

## 1.1.3 (October 16, 2021)

- Switch to npm
- Update dependencies

## 1.1.2 (May 19, 2021)

Added error handling for missing configuration files

## 1.1.1 (April 14, 2020)

Move `update-notifier` to dependencies and exclude from ncc build

## 1.1.0 (April 2, 2020)

Adding and augmenting commands to enable assumed role adoption

## 1.0.1 (January 26, 2020)

Move all dependencies to devDependencies

## 1.0.0 (January 26, 2020)

Initial release! :tada:
