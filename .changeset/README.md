# Changesets

This repository uses Changesets to manage package versions and changelogs.

For a package change:

1. Run `npm run changeset`
2. Pick the bump type
3. Write a short summary of the user-facing change
4. Commit the generated `.changeset/*.md` file with your code

On pushes to `main`, GitHub Actions will:

1. Open or update a version PR when unreleased changesets exist
2. Publish `@neuronsearchlab/sdk` to npm after that version PR is merged
