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
