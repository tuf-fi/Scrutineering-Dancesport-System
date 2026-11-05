# BIS: Bicol Oragon Scruteneering System

A dancesport competition system: registration and payments, adjudicators marking on their phones, the Skating System placings, and published results and rankings. One online server, run with Docker behind Caddy over HTTPS.

## Start here

| Read | For |
| --- | --- |
| [FLOW.md](docs/product/FLOW.md) | The whole journey of a competition, before, during and after, with the page for every step |
| [docs/product/ROLE_FEATURES.md](docs/product/ROLE_FEATURES.md) | Every role, its screens and everything it can do |
| [PRODUCT.md](PRODUCT.md) | What BIS is for and who uses it |
| [ROLES_README.md](docs/product/ROLES_README.md) | Roles, devices and result-sheet terms |
| [BUILD_README.md](docs/build/BUILD_README.md) | Tech stack, architecture, data model and build phases |
| [DESIGN.md](DESIGN.md) | The design system, including phone and tablet rules |
| [STATUS.md](docs/build/STATUS.md) | What is built, what is left, what is still unclear |
| [ROADMAP.md](docs/build/ROADMAP.md) | Phase history |

## Running it

| Read | For |
| --- | --- |
| [deploy/PRODUCTION.md](deploy/PRODUCTION.md) | Setting up, building and updating the real server |
| [deploy/STAGING.md](deploy/STAGING.md) | Setting up and using the practice server |
| [deploy/README.md](deploy/README.md) | Settings and backups reference |
| [ONLINE_SETUP.md](docs/operations/ONLINE_SETUP.md), [HARDWARE.md](docs/operations/HARDWARE.md) | What to host it on and what it costs; recommended devices |
| [ROLE_ACCOUNTS.md](docs/operations/ROLE_ACCOUNTS.md) | Making the Admin and every other account safely |
| [TEST_ACCOUNTS.md](docs/operations/TEST_ACCOUNTS.md) | Sample accounts for trying it (never on a real server) |
| [PILOT.md](docs/operations/PILOT.md), [PHASE7_README.md](docs/build/PHASE7_README.md), [rehearsal/README.md](rehearsal/README.md) | Testing and the pilot at a real event |

## Guides for each role

[Admin](docs/guides/admin.md), [Secretariat](docs/guides/secretariat.md), [Scrutineer](docs/guides/scrutineer.md), [Chairperson](docs/guides/chairperson.md), [Compere](docs/guides/compere.md), [Adjudicator](docs/guides/adjudicator.md), [Athlete](docs/guides/athlete.md), [Team and coach](docs/guides/team-coach.md).

## The client

[CLIENT_QUESTIONS.md](docs/client/CLIENT_QUESTIONS.md) and [CLIENT_DOCUMENTS.md](docs/client/CLIENT_DOCUMENTS.md): what was asked, and what the client sent back. The scoring engine is described in [PHASE2_README.md](docs/build/PHASE2_README.md).

The PDFs sent to the client are in [docs/client/](docs/client/): [questions and hardware](docs/client/BOSS_Client_Questions_and_Hardware.pdf), [online cost](docs/client/BOSS_Online_Cost.pdf) and [online setup steps](docs/client/BOSS_Online_Setup_Steps.pdf).

## Where the files are

| Folder | Holds |
| --- | --- |
| `/` | This page, `CLAUDE.md` (rules for working on the code), `PRODUCT.md` and `DESIGN.md` (the tools that read them expect them here) |
| `docs/product/` | How the system works: the competition flow and the roles |
| `docs/build/` | How it is built: architecture, roadmap, status, the scoring engine |
| `docs/operations/` | Running it: hosting cost, hardware, the pilot, accounts |
| `docs/guides/` | A short guide for each role |
| `docs/client/` | What was asked of the client, what came back, and the PDFs |
| `deploy/` | The server files, with the production and staging guides beside them |
| `rehearsal/` | The automated rehearsals and load test |
