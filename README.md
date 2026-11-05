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


## Control Room — business structure (proposed)

The live 3D view is preserved. The Control Room overlay in `index.html` reads the same
`data/status.json` file independently, categorises existing bots and displays their
**reported** status (not a live connection to Shopify or YouTube metrics). It refreshes
every two minutes and uses no new API keys or subscriptions.

| Level | Role | Responsibility | Implementation |
| --- | --- | --- | --- |
| Owner | Director | Approves product publishing, spending and major decisions | Human |
| Operations | Manager | Assigns work and escalates failures | Planned |
| Quality | Supervisor | Verifies work before release and requests corrections | Planned |
| Creative Studio | Shorts Studio | Writes, renders and privately uploads video | Existing bot |
| Commerce | Product Scout, Store Builder, Order Desk | Product research, store operations and order flow | Existing or planned bots |
| Finance & Research | Trading Desk | Paper-trading research only | Planned |

**Operating rule:** Workers may prepare drafts and previews; managers and supervisors
may recommend corrections, but only the owner may approve public product publishing,
unbudgeted spending or other consequential external actions. These roles are not
active automations until separately implemented, connected and tested.

### Next design milestones

1. Add a distinct 3D block for each department, with HQ at the centre and agents as
   nearby buildings; keep actual job state separate from organisational roles.
2. Add a review queue backed by real approval records rather than fake action buttons.
3. Add an activity/error dashboard, including accurate last-run timing and links to logs.
4. Add responsive controls, keyboard navigation and performance testing for the 3D scene.
5. Connect truthful KPIs from authorised Shopify/YouTube sources only when available.

The control room displays its own status fetch error message if data cannot load.
The original tower selection and GitHub run links remain in place.

## Animated Mini-Bot Operations Floor (Nov 2026)

The site now opens on a **responsive operations floor** showing small animated workers in five departments: Creative Studio, Commerce & Stores, Operations & Quality, Finance & Research, and Engineering & DIY. It is built with lightweight CSS+JavaScript in `workfloor.css` and `workfloor.js`, and leaves the existing 3D city bundle untouched.

### Navigation

- **Mission:** Mini-bot operations floor, grouped by department.
- **Show dashboard / Hide dashboard:** Opens/closes the existing detailed Mission Control control room.
- **Explore 3D City:** Hides the floor and dashboard and reveals the original interactive 3D buildings.
- **Reports:** Opens the detailed dashboard. **Content**, **Stores**, and **Projects** are direct links to the user's existing services, not simulated controls.
- **See bots:** Expands each department's exact bot list and reported state; links to verified GitHub Actions runs.

### Activity accuracy

The mini-bots are **illustrations of work**, not evidence that automation is running. A department is marked **RUNNING NOW** only when a bot reports `running` with a `started` time less than 3 hours old; **RECENT RUN** only when a bot reports `ok` within 48 hours; otherwise **REPORT STALE** or **PLANNED**. A recent failed run is marked **NEEDS REVIEW**. The source is the same public `data/status.json`, which may itself be old or unavailable. Display errors explicitly instead of fabricating activity or sales.

Nothing on the floor can publish videos, change Shopify products, spend credits or create orders. Motion is disabled for users who prefer reduced motion.

### Source changes

- `index.html`: adds the new floor and navigation while preserving the old dashboard and 3D scene.
- `workfloor.js`: builds scenes, binds status and details, refreshes every two minutes.
- `workfloor.css`: draws responsive mini-bots, simple workstations, states, and safe mobile navigation.
- `city.js` and `src/city.js`: unchanged. The 3D view remains separately available.

## Mini-bot operations floor (5 November 2026)

The default mobile-first page now displays five small illustrated department workstations: Creative Studio, Commerce & Stores, Operations & Quality, Finance & Research, and Engineering & DIY. CSS-based robots use lightweight loops to illustrate department tasks. **They are NOT independent bots and animation alone never confirms that a bot is operating.**

Current department badges are derived from data/status.json. A recently started run (under three hours) is displayed as running only if reported; last-success/failure is shown as recent only within 48 hours. Otherwise the department shows REPORT STALE or PLANNED. Tap **See bots** to inspect individual roles and GitHub Actions. **Show dashboard** opens the existing reports panel; **Explore 3D City** switches to the original tower city; both views can return to the workfloor.

Files: workfloor.css and workfloor.js, wired through index.html. No store credentials, paid services, analytics assumptions, or automated publishing were added. The source was inspected and checked, but mobile Safari and live GitHub Pages deployment should be tested separately.
