# 🏙 GitHub City

[![tests](https://github.com/codebywater/github-city/actions/workflows/tests.yml/badge.svg)](https://github.com/codebywater/github-city/actions/workflows/tests.yml)
![license](https://img.shields.io/badge/license-MIT-blue)

**Изометрический город из ваших репозиториев для README профиля.** Каждый репозиторий — дом: высота зависит от числа коммитов, цвет — от языка. Днём светит солнце, ночью горят окна и мерцают звёзды: картинка сама подстраивается под светлую или тёмную тему GitHub.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/city-dark.svg">
  <img alt="Город репозиториев codebywater" src="assets/city-light.svg">
</picture>

> **English summary.** Turns your public repositories into an isometric SVG city for your GitHub profile README: building height = number of commits, color = main language, light and dark versions. A GitHub Action redraws it daily. Zero dependencies.

## Как добавить в профиль

1. В репозитории профиля (`ваш-ник/ваш-ник`) создайте файл `.github/workflows/city.yml`:

   ```yaml
   name: GitHub City
   on:
     schedule:
       - cron: "0 3 * * *"   # каждый день в 03:00 UTC
     workflow_dispatch:
   permissions:
     contents: write
   jobs:
     city:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: codebywater/github-city@v1
   ```

2. Запустите его вручную: **Actions → GitHub City → Run workflow**. В репозитории появятся `assets/city-light.svg` и `assets/city-dark.svg`.

3. Добавьте в README профиля:

   ```html
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="assets/city-dark.svg">
     <img alt="Мой город репозиториев" src="assets/city-light.svg">
   </picture>
   ```

Дальше город будет перестраиваться каждый день: новые репозитории — новые дома, новые коммиты — новые этажи.

## Настройки

| Параметр | По умолчанию | Что делает |
|---|---|---|
| `user` | владелец репозитория | Чей город рисовать |
| `out` | `assets` | Папка для картинок |
| `exclude` | — | Скрыть репозитории: `dotfiles,test-repo` |
| `forks` | `false` | Показывать форки |
| `commit` | `true` | Коммитить картинки, если изменились |

```yaml
- uses: codebywater/github-city@v1
  with:
    exclude: dotfiles,playground
```

## Как это устроено

- Берутся ваши публичные репозитории, кроме форков, пустых и репозитория профиля.
- Число коммитов считается по основной ветке через GitHub API, без клонирования.
- Высота дома растёт как корень из числа коммитов: самый большой проект не задавит остальные.
- Высокие дома ставятся в глубину, низкие — вперёд, чтобы ничего не загораживало. На свободных участках растут деревья.
- Одинаковые данные дают одинаковую картинку, поэтому лишних коммитов «Update GitHub City» не будет.

## Запуск на своём компьютере

Нужен Node.js 18+, зависимостей нет.

```bash
git clone https://github.com/codebywater/github-city
cd github-city
node src/cli.js ваш-ник --out preview      # с GITHUB_TOKEN лимит API выше
npm run example                            # город из examples/data.json, без интернета
npm test
```

## Лицензия

MIT
