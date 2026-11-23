# Ship Commander

## GitHub Pages

This repository includes `.github/workflows/deploy-pages.yml` to build and deploy
`dist` to GitHub Pages on pushes to `main` (and via manual workflow dispatch).
The build uses `VITE_BASE_PATH=/ship-commander/` so assets resolve correctly for
project-site hosting in this same repository.


