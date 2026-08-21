# dt-craft

The craft layer for Digital Treasury's "Vault" build — motion, shaders and
interaction, split out so it can be hosted once and referenced from Webflow.

**Live demo:** https://alexander-dt.github.io/dt-craft/

---

## Why it is split

Webflow caps a registered inline script at **2,000 characters**. This layer is
~81 KB of JS and ~65 KB of CSS, so it has to be hosted externally and pulled in
— the same pattern the reference sites use (landonorris.com serves its bundle
from `assets.itsoffbrand.io`, not from Webflow).

```
dist/dt-craft.css     65 KB   all styling, tokens included
dist/dt-craft.js      81 KB   every system, self-starting
index.html                    the full demo page
markup.reference.html         the DOM the JS expects
```

---

## Using it in Webflow

**Project Settings → Custom Code → Head:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.0.1/dist/dt-craft.css">
```

**Project Settings → Custom Code → Before `</body>`:**

```html
<script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.0.1/dist/dt-craft.js" defer></script>
```

> Pin the version tag. Never point at `@main` — a commit would silently change
> the live site.

---

## The markup it expects

`dt-craft.js` finds its own work. Build these in Webflow with matching IDs and
classes; `markup.reference.html` is the authoritative copy.

### Elements it needs by ID

| ID | What it is |
|---|---|
| `atmo` | canvas — the molten atmosphere behind the page |
| `fluid` | canvas — the Navier-Stokes hover fluid |
| `gl` | canvas — the hero shader |
| `dots` | canvas — the calculator's dot grid |
| `megaFx`, `footFx` | canvases — the ASCII ripple surfaces |
| `citrail` | div — layer the project image trail spawns into |
| `vp`, `scroller`, `spacer` | the smooth-scroll rig |
| `nav`, `mega`, `svcTrigger`, `megaInd`, `scrim` | nav and mega menu |
| `pal`, `palInput`, `palList`, `palEmpty`, `palScrim`, `kbdChip`, `kbdLabel` | command palette |
| `drow` | the discipline row |
| `qtrack`, `qprev`, `qnext`, `qprogbar` | testimonial rail |
| `d1`–`d5`, `v1`–`v5`, `o1`–`o6`, `stamp` | ROI calculator dials and readouts |
| `work`, `h1`, `cur` | work section, hero headline, custom cursor |

### Attributes it reads

| Attribute | Effect |
|---|---|
| `data-band` + `data-ramp` | element becomes a scroll-scrub band exposing `--k` |
| `data-split="grid\|punch\|rise"` | headline split into a per-character entrance |
| `data-em="word"` | emphasises one word in a `punch` split |
| `data-spread` | character stagger width for `grid` |
| `data-mag` | magnetic hover |
| `data-depth` | parallax rate |
| `data-dwell` | auto-advance interval on `#drow` |
| `class="btn-l"` | label gets the re-type hover |

---

## Behaviour worth knowing

- **Nothing runs on touch or under `prefers-reduced-motion`.** Smooth scroll,
  custom cursor, magnetic buttons, fluid, image trail and ripples all bail out;
  layering and shadows stay.
- **The fluid is masked to four sections** — `#services`, `#work`, `#clients`,
  `#contact` — and explicitly subtracts `#instrument`.
- **Every loop sleeps.** Canvases stop when off-screen or when the tab hides.
- **`?perf=1`** shows a performance HUD: FPS, frame-time p50/p95/worst, long
  tasks, JS heap, plus per-layer toggles so you can attribute cost.

## Licence

Private work product for Digital Treasury.
