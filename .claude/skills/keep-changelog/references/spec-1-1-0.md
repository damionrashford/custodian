# Keep a Changelog 1.1.0 — condensed spec

Source: <https://keepachangelog.com/en/1.1.0/> · repo <https://github.com/olivierlacan/keep-a-changelog>

> "Don't let your friends dump git logs into changelogs."

## Definitions

- **Changelog** — a file containing a curated, chronologically ordered list of notable changes for each version of a project.
- **Purpose** — so users and contributors can see precisely what notable changes were made between each release.
- **Audience** — humans, not machines. Consumers and developers who want to know why and how the software changed.

## Guiding principles (all seven, verbatim intent)

1. Changelogs are for humans, not machines.
2. There should be an entry for every single version.
3. The same types of changes should be grouped.
4. Versions and sections should be linkable.
5. The latest version comes first.
6. The release date of each version is displayed.
7. Mention whether you follow Semantic Versioning.

## The six types of changes — the complete list, no others

| Type | Spec wording |
|---|---|
| `Added` | for new features. |
| `Changed` | for changes in existing functionality. |
| `Deprecated` | for soon-to-be removed features. |
| `Removed` | for now removed features. |
| `Fixed` | for any bug fixes. |
| `Security` | in case of vulnerabilities. |

Spelled exactly as above, as `### ` headings, grouped under their version. There is no `Improvements`, `Performance`, `Docs`, `Chore`, `Breaking`, or `Misc`.

## Unreleased

Keep an `## [Unreleased]` section at the top. It serves two purposes:

1. People can see what changes they might expect in upcoming releases.
2. At release time you move the Unreleased section's changes into a new release version section.

`[Unreleased]` carries no date.

## Version headings

```
## [1.1.2] - 2024-09-27
```

- Version wrapped in `[brackets]` so it resolves against a link reference at the bottom of the file.
- Separator is a plain hyphen surrounded by spaces.
- Date is ISO 8601 `YYYY-MM-DD` — the release date.
- Latest version first, descending.

## Yanked releases

Versions pulled because of a serious bug or security issue. They *should* appear in the changelog:

```
## [0.0.5] - 2014-12-13 [YANKED]
```

The `[YANKED]` tag is loud on purpose, and bracketed so it parses programmatically.

## Link references

Versions and sections should be linkable. Convention is footnote-style reference definitions at the bottom of the file:

```
[unreleased]: https://github.com/OWNER/REPO/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/OWNER/REPO/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/OWNER/REPO/compare/v1.1.0...v1.1.1
[0.0.1]: https://github.com/OWNER/REPO/releases/tag/v0.0.1
```

The oldest version has no predecessor to compare against, so it links to its release tag. `[unreleased]` always compares the newest release tag to `HEAD`.

## What not to do — the spec's own antipatterns

### Commit log diffs

Using commit log diffs as changelogs is a bad idea: they're full of noise — merge commits, obscure titles, documentation changes. A commit documents a step in the evolution of the source code; a changelog entry documents the *noteworthy difference*, often across multiple commits, communicated clearly to end users.

### Ignoring deprecations

When people upgrade it should be painfully clear when something will break. It must be possible to upgrade to a version that *lists* deprecations, remove what's deprecated, then upgrade to the version where the deprecations become removals. If you do nothing else: list deprecations, removals, and any breaking changes.

### Confusing dates

Regional date formats vary and overlap ambiguously. `2017-07-17` orders largest unit to smallest (year, month, day), doesn't collide with other formats, and is an ISO standard. That is why it is the recommended format.

### Inconsistent changes

A changelog that mentions only some of the changes can be as dangerous as no changelog. Removing a single whitespace need not be recorded; any *important* change must be. Inconsistent application makes users mistakenly believe the changelog is the single source of truth — it ought to be.

### Empty sections

From the project's own changelog at 0.0.4: "Remove empty sections from CHANGELOG, they occupy too much space and create too much noise in the file. People will have to assume that the missing sections were intentionally left out because they contained no notable changes."

## FAQ points that settle arguments

- **Standard format?** Not really. GNU's changelog style guide and NEWS guideline are both inadequate. This project is a convention derived from observed good practice.
- **File name?** `CHANGELOG.md`. Some projects use HISTORY, NEWS or RELEASES — don't make users hunt.
- **GitHub Releases?** A good initiative, but non-portable: only displayable inside GitHub, less discoverable than an uppercase repo file, and the interface offers no commit-log links between releases. Keep the file.
- **Automatically parsed?** Difficult, because people follow wildly different formats and file names.
- **Ever rewrite a changelog?** Yes. Adding missing releases or a forgotten breaking change is a legitimate improvement.

## Canonical example

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.2] - 2024-09-27

### Added

- v1.1 German translation.

### Fixed

- Improve French translation.

## [1.1.1] - 2023-03-05

### Added

- Centralize all links into `/data/links.json` so they can be updated easily.

### Changed

- Upgrade dependencies: Ruby 3.2.1, Middleman, etc.

### Removed

- Unused normalize.css file.

[unreleased]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.1.0...v1.1.1
```
