# TechTalk design system

> For people **and AI assistants**. Everything here is also available as data and as a live page:
> - Live style guide: `/design` (public, rendered from the real CSS variables, follows the theme switch)
> - Tokens as JSON: `/design-tokens.json` (generated from `apps/frontend/src/styles/theme.css`, kept in sync by a test; regenerate with `npm run design:tokens --workspace=apps/frontend`)
> - Screenshots of every main screen: [`docs/screens/`](screens) (regenerate with `npm run design:screens --workspace=apps/frontend`)
> - Summary for crawlers: `/llms.txt`

## Character
Clean, calm and focused. Flat surfaces, rounded cards with a clearly visible 1px border, **one** warm orange accent, generous spacing, no gradients except on the Kairos button. It should feel like a good reading app, not a dashboard. Light and dark themes are equals.

## Colour
Never hard-code a colour: use the CSS variables (Tailwind names such as `bg-card`, `text-muted-foreground`, `border-border`, `text-primary`). Values:

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#ffffff` | `#09090c` | page |
| `card` | `#ffffff` | `#141419` | cards, dialogs, panels |
| `secondary` | `#f1f1f4` | `#1e1e25` | inputs, chips, soft panels |
| `muted` | `#e9e9ee` | `#26262e` | hover fills, skeletons |
| `foreground` | `#0c0c10` | `#f4f4f6` | text |
| `muted-foreground` | `#55555f` | `#a3a3b0` | secondary text (>= 4.5:1) |
| `primary` | `#e8430f` | `#f04f23` | actions, progress, focus ring, links |
| `destructive` | `#d4183d` | `#e5484d` | delete, errors |
| `border` | 20% ink | 18% white | ~3:1 against its surface |

Calendar kinds: study = primary, school = amber, deadline = red, event = emerald (a dot or a 15% tinted chip, never a solid block).

## Type
Inter for text, JetBrains Mono for small uppercase labels ("eyebrows", sources, metadata).
- Page title: 24-30px bold, tight tracking. Section title: 15-17px semibold. Body: 14px, relaxed leading. Caption: 12-13px, muted.
- Eyebrow: mono 11px, uppercase, tracking 0.15em, in `primary` or `muted-foreground`.

## Shape and spacing
- Radius: cards `rounded-2xl` (16px), controls `rounded-xl` (12px), chips `rounded-lg` or full.
- Spacing on a 4px grid; page gutter 16px on phones, 24-32px on computers; content is centred, reading pages max ~896px, tools (calendar, admin lists) use the full width up to 1600px.
- Shadows only on the primary button (`shadow-md shadow-primary/25`) and dialogs.

## Components
- **Primary button**: `bg-primary text-white`, height 40px, `rounded-xl`, semibold. **Outline**: 1px border, same size. **Accent outline**: `border-primary/40 text-primary`. **Destructive**: outlined, `text-destructive`. Icon buttons are 32-40px with a hover fill.
- **Input**: `bg-secondary`, 1px border, `rounded-xl`, 40px; focus changes the border to `primary`. Labels sit above, 12px, muted, and are always tied to the field.
- **Chip**: filter = `bg-secondary` or `bg-foreground text-background` when selected; topic = `bg-primary/10 text-primary`, full radius.
- **Card**: `bg-card border border-border rounded-2xl p-4-6`. Highlight card: `bg-primary/10 border-primary/30`.
- **Dialog**: centred on computers, a bottom sheet on phones, dimmed blurred backdrop, close button top right.
- **Progress**: 10px track in `secondary`, fill in `primary`.
- **Toasts**: Sonner, top centre.
- **Kairos**: a round illustration (`public/kairos.svg`): a serene bald head with one lock of hair in the wind. It replaces generic "AI sparkle" icons. A round floating button sits bottom right on every page; the chat opens as a large panel (full screen on phones).

## Layout
- Computers: top bar (menu toggle, title, search on Home, theme, settings, avatar) + left menu (Home, Learn, My path, Practice, Calendar, Kairos, People; You: Saved, Profile, Settings, About; Admin for administrators), collapsible to an icon rail.
- Phones: top bar + bottom bar (Home, Learn, My path, Practice, Calendar, Profile); everything must work from 360px.
- **Calendar**: one centred toolbar above the grid (month arrows with the month name, then Today, Add event, Plan my sessions, Export), a legend, a full-width 6x7 month grid, and the selected day's agenda below it. Nothing sits beside the grid.
- **My path**: a row of path tabs on top (school, personal, your own; the main one starred; a ⋯ menu to rename, make main, rebuild or delete; "New path" at the end), then a summary card with the progress bar, a school card, then the roadmap **map** in its own bordered section (the map and a list can be switched). On the map each stage is a trunk of step nodes (filled = done, ringed = in progress, empty = to do) with a card hanging off each node; stages are joined by curved links (solid orange once complete, dashed before), and stages that ask you to practise or build end with a **checkpoint** (a diamond: "Ready to move on?" yes / not yet). The section scrolls sideways, with fading edges and arrow buttons, and has a height cap so the page never stretches.
- **Campus**: a centred header (school name), four tabs (Programme, Revisions, Past exams, People). Programme: year pills, the year's title, summary and skills as chips, then a grid of project cards with topics, hours and a progress bar once you follow that year as a path. The other tabs:, cards for sessions, a bordered list for past exams with a vote button on the left, and person cards. Everything is for the learner's own school only.
- **Home (signed in, `/`)**: a full-screen vertical feed, one item per screen with scroll-snap. It is always dark (immersive). Short videos play by themselves (muted, tap to pause, `m` for sound), articles, projects and lessons are full-screen cards, a rail of round buttons sits at the side (save, ask Kairos, open, share, sound). Keys: arrows or j/k, `m`, `s`. The former home with filters and search is **Explore** (`/explore`).
- **Landing (visitors, `/`)**: a long SaaS page: hero with a CSS-3D scene (your path, Kairos and the calendar stacked in depth and turning with the pointer), two drifting rows of logos (sources, then the stack; grey, coloured on hover), a bento grid, three steps, the roadmap map tilted in 3D, a detailed Kairos section (six capabilities, a scripted live conversation with three examples, the four steps of an answer), schools, a 3D ring of the stack, trust, FAQ and a final call. All motion stops under `prefers-reduced-motion`.
- **Explore**: filter chips, then shelves that alternate format (video bands, project cards, article rows, opportunity bands).

## Motion and accessibility
- Motion is decorative and removed under `prefers-reduced-motion`.
- Targets >= 32px; visible focus; colour is never the only signal (kind chips carry text, done steps carry a check); text contrast >= 4.5:1; dialogs use `role="dialog"` and `aria-modal`; live regions for results.
- Languages: English and French, every string in `src/locales`.

## Screenshots
Generated by `apps/frontend/scripts/screenshots.mjs` from a running app (light and dark, desktop and phone):

| Screen | Light | Dark |
| --- | --- | --- |
| Design system | [desktop](screens/design-light.png) | [desktop](screens/design-dark.png) |
| Home | [desktop](screens/home-light.png) | [desktop](screens/home-dark.png) |
| My path | [desktop](screens/path-light.png) | [desktop](screens/path-dark.png) |
| Campus | [desktop](screens/campus-light.png) | [desktop](screens/campus-dark.png) |
| Calendar | [desktop](screens/calendar-light.png), [phone](screens/calendar-phone.png) | [desktop](screens/calendar-dark.png) |
| Kairos | [desktop](screens/kairos-light.png) | [desktop](screens/kairos-dark.png) |
| Admin | [desktop](screens/admin-light.png) | |
| Login | [desktop](screens/login-light.png) | |
