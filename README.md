# ByteStash (personal fork)

> **This is a personal fork of [jordan-dalby/ByteStash](https://github.com/jordan-dalby/ByteStash).**  
> See [About this fork](#about-this-fork) below before using it.

<p align="center">
  <img src="https://raw.githubusercontent.com/jordan-dalby/ByteStash/refs/heads/main/client/public/logo192.png" />
</p>

ByteStash is a self-hosted web application designed to store, organise, and manage your code snippets efficiently. With support for creating, editing, and filtering snippets, ByteStash helps you keep track of your code in one secure place.

![ByteStash App](https://raw.githubusercontent.com/jordan-dalby/ByteStash/refs/heads/main/media/app-image.png)

## Demo
Check out the [ByteStash demo](https://bytestash-demo.pikapod.net/) powered by PikaPods!  
Username: demo  
Password: demodemo

## Features
- Create and Edit Snippets: Easily add new code snippets or update existing ones with an intuitive interface.
- Filter by Language and Content: Quickly find the right snippet by filtering based on programming language or keywords in the content.
- Secure Storage: All snippets are securely stored in a sqlite database, ensuring your code remains safe and accessible only to you.

## Howto
### Unraid
ByteStash is now on the Unraid App Store! Install it from [there](https://unraid.net/community/apps).

### PikaPods
Also available on [PikaPods](https://www.pikapods.com/) for [1-click install](https://www.pikapods.com/pods?run=bytestash) from $1/month.

### Docker
ByteStash can also be hosted manually via the docker-compose file:
```yaml
services:
  bytestash:
    image: "ghcr.io/jordan-dalby/bytestash:latest"
    restart: always
    volumes:
      - /your/snippet/path:/data/snippets
    ports:
      - "5000:5000"
    environment:
      # See https://github.com/jordan-dalby/ByteStash/wiki/FAQ#environment-variables
      #ALLOWED_HOSTS: localhost,my.domain.com,my.domain.net
      BASE_PATH: ""
      JWT_SECRET: your-secret
      TOKEN_EXPIRY: 24h
      ALLOW_NEW_ACCOUNTS: "true"
      DEBUG: "true"
      DISABLE_ACCOUNTS: "false"
      DISABLE_INTERNAL_ACCOUNTS: "false"

      # See https://github.com/jordan-dalby/ByteStash/wiki/Single-Sign%E2%80%90on-Setup for more info
      OIDC_ENABLED: "false"
      OIDC_DISPLAY_NAME: ""
      OIDC_ISSUER_URL: ""
      OIDC_CLIENT_ID: ""
      OIDC_CLIENT_SECRET: ""
      OIDC_SCOPES: ""
```

## Tech Stack
- Frontend: React, Tailwind CSS
- Backend: Node.js, Express
- Containerisation: Docker

## API Documentation
Once the server is running you can explore the API via Swagger UI. Open
`/api-docs` in your browser to view the documentation for all endpoints.

---

## About this fork

This is a personal fork maintained by [@arkadym](https://github.com/arkadym) for personal use. A few things to know upfront:

**This is not a maintained open source project.**  
I forked this to add features I personally need. I don't have the time to maintain it as a proper open source project — triaging issues, reviewing PRs, keeping documentation complete, ensuring backwards compatibility, etc. If you use this fork, you do so at your own risk.

**Development is AI-assisted.**  
I'm a developer, but Node.js/React/SQLite are not my primary stack. I use GitHub Copilot and other AI tools heavily for development work on this repo. The code should be correct and reasoned through, but it may not always follow idiomatic patterns for this stack.

**No plans to contribute back upstream.**  
Contributing back to [jordan-dalby/ByteStash](https://github.com/jordan-dalby/ByteStash) would require properly preparing pull requests, coordinating on design, and maintaining compatibility with upstream direction — more ongoing effort than I can commit to. I may change my mind one day.

**What's different in this fork:**

| Feature | Status | Doc |
|---------|--------|-----|
| File attachments (attach any file to a snippet) | Planned | [docs/feature-file-attachments.md](docs/feature-file-attachments.md) |
| Improved expiry & recycle bin (background scheduler, split columns) | Planned | [docs/feature-expiry-recyclebin.md](docs/feature-expiry-recyclebin.md) |
| PostgreSQL support | **Rejected** — see reasoning | [docs/decision-no-postgresql.md](docs/decision-no-postgresql.md) |

To sync with upstream: `git fetch github && git merge github/main`

---

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any improvements or bug fixes.

### I18n
To add phrases for a new language, follow these steps. Example for `fr` locale:
- Add the locale name to the `Locale` enum in the `client/src/i18n/types.ts` file
- Add the locale name to the `locales` array in the `client/i18next.config.ts` file
- Run translation synchronization: `cd client && npm run i18n:extract`
- Replace all `__TRANSLATE_ME__` lines with the desired phrases
- Create new resources file as `client/src/i18n/resources/fr.ts`
- Update export resources in file `client/src/i18n/resources/index.ts`
- Run the server in development mode: `npm run dev`
- Run the client in development mode: `cd client && npm run start`
