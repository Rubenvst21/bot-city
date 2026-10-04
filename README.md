# Bot City

A live 3D city where every tower is one of my bots. Open it at **https://rubenvst21.github.io/bot-city/**

- Each bot is a tower that grows as it runs more.
- The beam on top shows how it's doing: green = working well, red = last run failed, pulsing amber = running now.
- Tap a tower to see what it did last, its totals and recent runs.
- Wireframe towers are bots that are planned but not built yet.

The bots (in a separate, private repo) update `data/status.json` after every run, and the page reloads it every two minutes.

## Changing the city

The page is `index.html` plus `city.js`, which is built from `src/city.js`:

```bash
npm install
npm run build
```
