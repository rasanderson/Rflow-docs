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
