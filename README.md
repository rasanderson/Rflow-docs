# Rflow documentation

## Rflow documentation vs Rflow backend
Rflow documentation is now published via [GitHub Pages](https://pages.github.com/) and domain redirecting is setup to the same Rflow documentation landing page of https://rflow.co.uk or https://www.rflow.co.uk as both domains land on the same site. The Rflow backend, built with Node.js and React+ReactFlow, with the R plumber2 API is now a completely separate site, hosted on Digital Ocean. This has the advantage that minor documentation changes no longer entail redeploying the entire Rflow backend with disruption to users or potential downtime.

## Rflow documentation editing
The documentation is creating in [Quarto](https://quarto.org) which uses a flexible customisable markdown syntax to generate websites. Recommended approach is to:

* Clone this website
* Edit in VS Code, Positron or RStudio
* Preview revised documentation by rendering on localhost and displaying in browser
* Commit changes to local git repository and push to remote
* Publish new website via `quarto publish gh-pages`

## Updating Tutorial 1A screenshots

The workflow, Input CSV, and Histogram screenshots in `tutorials/figs/` can be regenerated with the Playwright workflow in this repository. It requires the Rflow app, auth server, and R API to be running locally, plus a test account that can access the Tutorial 1A project.

1. In separate terminals, start the Rflow auth server (`cd /path/to/Rflow && npm run auth`), frontend (`cd /path/to/Rflow && npm run dev`), and R API (`cd /path/to/Rflow/api && ./start-server.sh`). The frontend should be available at `http://localhost:5173`.
2. In this repository, create `.env.playwright` with `TEST_USER` and `TEST_PASSWORD` for the test account. Do not commit this file.
3. Install dependencies and the Chromium browser once with `npm install` and `npx playwright install chromium`.
4. Run `npm run screenshots`.

The test uploads `tutorials/data_workflows/chick_diet.csv` as `diet_dat` in the Tutorial 1A project, replacing any existing dataset with that name. It captures the workflow, Input CSV (`tutorial_1a_inputcsv_*_panel.png`), and Histogram (`tutorial_1a_histogram_*_panel.png`) images. The Input CSV screenshots share the height of the tallest panel. Render the Quarto page and review the resulting images before committing them.
