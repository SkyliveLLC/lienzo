# Releasing Lienzo

The three packages share one version: `skylive/lienzo` on Packagist, and `@skylive/lienzo-core` and `@skylive/lienzo-editor` on npm. A release is one commit and one `vX.Y.Z` tag. Pushing the tag publishes the npm packages from GitHub Actions, and Packagist reads the same tag.

## Before the first release

Do these once:

1. Make the GitHub repository public. Packagist and npm provenance both need a public source.
2. On npmjs.com, create the `@skylive` organization if it does not exist. Add an automation token as the `NPM_TOKEN` secret of the repository, or set up trusted publishing for `.github/workflows/release.yml` on both packages.
3. Submit `https://github.com/SkyliveLLC/lienzo` at <https://packagist.org/packages/submit>. Then connect the Packagist GitHub app, or add the Packagist webhook, so new tags update the package without a manual step.

## Prepare the release

Run every step from a clean checkout of `main`.

1. Install dependencies.

    ```sh
    pnpm install --frozen-lockfile
    composer update
    pnpm exec playwright install chromium
    ```

2. Build, then check that the generated files in git match a fresh build. Both `git diff` commands must print nothing.

    ```sh
    pnpm typecheck && pnpm test && pnpm build
    pnpm sync:php
    pnpm golden
    git diff --exit-code packages/laravel/dist fixtures
    ```

    If `packages/laravel/dist` changed, a change to core or the editor was committed without `pnpm sync:php`. If `fixtures` changed, the renderer output changed without new goldens. Commit the fix on its own before you go on.

3. Run the full suites, including both examples.

    ```sh
    pnpm e2e
    composer test
    ```

4. Set the new version in `packages/core/package.json`, `packages/editor/package.json` and the path repository's `versions` entry in `examples/laravel/composer.json`. Composer reads the version of `skylive/lienzo` from the tag, so the root `composer.json` has no version field.

5. In `CHANGELOG.md`, replace `(unreleased)` with the date, for example `## 0.1.0 (2026-10-20)`.

6. Commit, and wait for CI to pass on `main`.

    ```sh
    git commit -am "chore: release vX.Y.Z"
    git push origin main
    ```

## Publish

1. Tag the release commit and push the tag.

    ```sh
    git tag -a vX.Y.Z -m "vX.Y.Z"
    git push origin vX.Y.Z
    ```

2. Watch the **Release** workflow. It stops before publishing if the tag does not match the versions in `package.json`. It then publishes both npm packages with provenance. `pnpm publish` replaces the editor's `workspace:*` dependency on core with the released version, and the `prepack` step copies `LICENSE` and `THIRD_PARTY_NOTICES.md` into each package.

3. Check the results:

    - <https://www.npmjs.com/package/@skylive/lienzo-core> and <https://www.npmjs.com/package/@skylive/lienzo-editor> show the new version with a provenance badge.
    - <https://packagist.org/packages/skylive/lienzo> lists `vX.Y.Z`.
    - In a new Laravel app, `composer require skylive/lienzo` installs it.

4. Create a GitHub release for the tag, with the version's `CHANGELOG.md` section as its notes.

To see what a package will contain without publishing it, run `pnpm --filter @skylive/lienzo-core pack` and list the tarball with `tar tzf`.
