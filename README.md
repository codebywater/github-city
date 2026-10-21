# 🏙 GitHub City

**English** · [Русский](README.ru.md)

[![tests](https://github.com/codebywater/github-city/actions/workflows/tests.yml/badge.svg)](https://github.com/codebywater/github-city/actions/workflows/tests.yml)
![license](https://img.shields.io/badge/license-MIT-blue)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

**Your repositories as an isometric city, right in your GitHub profile README.** Every repository is a building: the more commits, the taller it is; the colour comes from its main language. In daylight the sun is out; at night the windows light up and the stars twinkle — the picture follows GitHub's light or dark theme on its own.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/city-dark.svg">
  <img alt="An isometric city of codebywater's repositories" src="assets/city-light.svg">
</picture>

A GitHub Action redraws the city every day: new repositories become new buildings, and buildings grow with your commits. No dependencies, no external services — just the GitHub API and an SVG file in your repo.

## Add it to your profile

1. In your profile repository (`your-name/your-name`) create `.github/workflows/city.yml`:

   ```yaml
   name: GitHub City
   on:
     schedule:
       - cron: "0 3 * * *"   # every day at 03:00 UTC
     workflow_dispatch:
   permissions:
     contents: write
   concurrency:              # a manual run and a scheduled run never push over each other
     group: github-city
     cancel-in-progress: false
   jobs:
     city:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v5
         - uses: codebywater/github-city@v1
   ```

2. Run it once by hand: **Actions → GitHub City → Run workflow**. `assets/city-light.svg` and `assets/city-dark.svg` appear in the repository.

3. Add this to your profile README:

   ```html
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="assets/city-dark.svg">
     <img alt="My repository city" src="assets/city-light.svg">
   </picture>
   ```

That's it — the city rebuilds itself every day.

> **Schedules and 60 quiet days.** GitHub [disables](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule) scheduled workflows in public repositories after 60 days without activity. The action only commits when the picture changes, so a quiet profile can hit that limit.
>
> - Any commit to the profile repository (for example, editing the README) resets the counter.
> - From day 50 without commits the action writes a warning to the run log.
> - If the schedule is already disabled, re-enable it: **Actions → GitHub City → Enable workflow**, then **Run workflow**.

## Options

| Input | Default | What it does |
|---|---|---|
| `user` | repository owner | Whose city to draw |
| `out` | `assets` | Folder for the images |
| `exclude` | — | Repositories to hide: `dotfiles,test-repo` |
| `forks` | `false` | Include forks |
| `max-repos` | `36` | How many buildings to draw (the largest by commits); `0` draws all |
| `commit` | `true` | Commit the images when they change |
| `token` | `${{ github.token }}` | Token for the GitHub API |
| `lang` | `en` | Language of the labels on the picture: `en` or `ru` |

```yaml
- uses: codebywater/github-city@v1
  with:
    exclude: dotfiles,playground
    max-repos: 20
```

## How it works

- It takes your public repositories, except forks, empty ones, your profile repository and the repository the action runs in (so its own daily commits never grow a building).
- Commits are counted on the default branch through the GitHub API, without cloning anything.
- Building height grows with the square root of commits, scaled to your largest repository, so one huge project doesn't flatten the rest.
- Tall buildings stand at the back and short ones in front, so nothing hides anything. Empty lots get trees.
- More than 36 buildings stop being readable in a README column, so the 36 largest are drawn and the subtitle says so.
- The same data always produces the same picture, byte for byte — no empty "Update GitHub City" commits.
- If something was pushed while the action was drawing, it pulls the changes and retries the push (up to three times).

## Run it locally

Node.js 18+, no dependencies.

```bash
git clone https://github.com/codebywater/github-city
cd github-city
node src/cli.js your-name --out preview   # set GITHUB_TOKEN for a higher API limit
npm run example                           # city from examples/data.json, no network needed
npm test
```

## License

MIT
