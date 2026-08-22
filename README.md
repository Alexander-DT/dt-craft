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
dist/dt-craft.css              all styling, tokens included
dist/dt-craft.js               every system — expects the markup below
dist/dt-craft.standalone.js    the same, plus the markup, self-injecting
index.html                     the full demo page
markup.reference.html          the DOM dt-craft.js expects
```

**Which JS file?**

- **`dt-craft.standalone.js`** — for a host page with no markup of its own (a
  blank Webflow page). It injects the whole Vault page, then runs. Nothing to
  build in Webflow. Content is *not* CMS-editable.
- **`dt-craft.js`** — once the sections are rebuilt natively in Webflow with
  the hooks listed below, so content is editable.

The standalone file no-ops if `#vp` already exists, so it is safe to leave in
place while you rebuild sections natively one at a time.

---

## Using it in Webflow

**Project Settings → Custom Code → Head:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.4.1/dist/dt-craft.css">
```

**Project Settings → Custom Code → Before `</body>`:**

```html
<!-- blank page: injects its own markup -->
<script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.4.1/dist/dt-craft.standalone.js" defer></script>

<!-- or, once the sections exist natively in Webflow -->
<!-- <script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.4.1/dist/dt-craft.js" defer></script> -->
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

Some of these are stamped for you at runtime — every `.wcard`, plus `.wfeat`,
`.qrail` and `#drow`, is turned into a scroll band automatically, and each
card gets its stagger offset. Build the cards in Webflow as normal; the
arrival choreography attaches itself.

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
- **The fluid is masked to four sections** — `#services`, `#work`,
  `#instrument`, `#clients` — and nowhere else. Inside those sections it
  bounces off the section's own edges (left, right, top, bottom) instead of
  just fading out at the crop line, the same contained feel as the ripple
  in the mega menu and footer.
- **Cards arrive, they don't just scroll past.** Work cards, the featured
  card, the testimonials and the discipline row tilt up from a shallow angle
  and settle flat, which is what gives the page chapter breaks instead of one
  continuous ribbon.
  - **Each work card is its own band**, keyed to when *it* enters — not to the
    grid around it. Driving the whole grid from one band settled the lower row
    while it was still below the fold, so that row's animation ran where
    nobody could see it. Cards sharing a row cascade left-to-right instead,
    since scroll position alone cannot separate them.
  - **The image zoom is deliberately late**, holding over-scaled until the
    card is a third of the way in so it reads as its own beat rather than
    riding the card up.
- **Scroll-driven values never carry a CSS transition.** `opacity` and
  `transform` on those cards are rewritten every frame, so the eased hover
  states ride registered `--hov` / `--dim` properties instead. Without
  `@property` support the hover lift lands instantly and the scroll arrival
  is unaffected.
- **Every loop sleeps.** Canvases stop when off-screen or when the tab hides.
- **`?perf=1`** shows a performance HUD: FPS, frame-time p50/p95/worst, long
  tasks, JS heap, plus per-layer toggles so you can attribute cost.

## Licence

Private work product for Digital Treasury.
