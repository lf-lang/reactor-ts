# Instructions for publishing releases

## 1. Publish on NPM
Once CI on the `master` branch has successfully run, change directory to a local clone of the repo and run the following commands:

```sh
git checkout master
git pull
git clean -fdx
npm install
npm version <increment>
npm publish
git push && git push origin <tag>
```

These steps ensure that you:
1. are using the latest from `master`;
2. are not using any cached artifacts;
3. are updating the `package.json` with the appropriate version number; and
4. are creating and pushing a tag with the appropriate version number.

> [!NOTE]
> Note that `<increment>` denotes the size of the version increment (typically `patch`, `minor`, or `major`). See [NPM docs](https://docs.npmjs.com/cli/v8/commands/npm-version) for more info.

> [!NOTE]
> `npm version` bumps the version number in `package.json`, commits the change, and then creates (and prints) the corresponding tag.

> [!NOTE]
> `npm publish` will require 2-factor authentication.

## 2. Create a release on GitHub

[Draft a new Release](https://github.com/lf-lang/reactor-ts/releases/new) and hit the `Generate release notes` button. If it looks good, hit the green `Publish release` button.
