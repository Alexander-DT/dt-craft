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
index.html                     the full demo page — the source of markup truth
markup.reference.html          the DOM dt-craft.js expects        (generated)
build.js                       regenerates the two generated files
```

`index.html` and `dist/dt-craft.js` are edited by hand. `markup.reference.html`
and `dist/dt-craft.standalone.js` are derived from them — after changing either,
run:

```
node build.js
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

<!-- Theme, set before first paint. Must be inline and blocking: a reader who
     chose light otherwise gets a frame of dark on every navigation. -->
<script>
(function(){try{
  var r=document.documentElement,t=localStorage.getItem('dt-theme'),a=localStorage.getItem('dt-accent');
  if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  r.setAttribute('data-theme',t);
  r.setAttribute('data-accent',/^(gold|amber|azure|verdant|crimson|violet)$/.test(a)?a:'gold');
}catch(e){}})();
</script>
```

> Webflow caps a *registered* inline script at 2,000 characters; this one is
> well under, so it pastes into Head custom code as-is.

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

## Theme and accent

Two independent axes, both attributes on `<html>`:

| Attribute | Values | Default |
|---|---|---|
| `data-theme` | `dark`, `light` | the OS preference, then `dark` |
| `data-accent` | `gold`, `amber`, `azure`, `verdant`, `crimson`, `violet` | `gold` |

Both are driven by the controls in the nav (`#themeSw`, `#accBtn`), remembered
in `localStorage` under `dt-theme` / `dt-accent`, and applied before first
paint by the head snippet above. Until a reader picks a theme the page follows
the OS and keeps following it; once they choose, their choice wins for good.

### How it works

Everything resolves through tokens, so neither axis needs a single rule of its
own downstream. The accent is a five-stop ramp — `--a-1` deepest through `--a-5`
lightest — which each theme maps onto the three names the page uses:

|  | `--gold-lo` | `--gold` | `--gold-hi` |
|---|---|---|---|
| dark | `--a-2` | `--a-3` | `--a-5` |
| light | `--a-3` | `--a-2` | `--a-1` |

Dark climbs the ramp for emphasis; light descends it, because on paper
*brighter* means deeper, not paler.

Adding a seventh accent means adding one `[data-accent="…"]` block next to the
others in `dt-craft.css` and one `.acc-sw` button — nothing else.

### Two things deliberately do not flip

- **Type over photography.** `.wcard` / `.wfeat` copy sits on a dark veil in
  both themes, so it uses `--on-media` and `--on-acc`, which stay at the light
  end regardless.
- **The footer.** A wordmark cut out of a fade needs a dark ground to be cut
  out *of*, so in light mode the footer stays deep slate and re-declares the
  on-dark tokens locally — an inverted island, the way a masthead sits at the
  foot of a printed page whatever the stock.

### The canvases

Canvas and WebGL cannot read CSS, so the four surfaces subscribe to
`THEME.on(...)` and re-read their palette from custom properties on every
change: the hero and atmosphere shaders take their ramps as uniforms
(`--sh-*`, `--atmo-*`), the dot grid and ASCII ripples take a tint (`--fx-rgb`)
from **their own host element** — which is how the footer keeps the bright
accent while the mega menu flips — and the fluid takes dye, tint and blend
mode (`--fluid-*`). A `dt:theme` event fires on `window` alongside, if anything
else ever needs to listen.

The fluid also switches blend mode: it screens onto the dark ground and
multiplies onto paper, since a screen blend over ivory is invisible.

### Cost

The swap is attribute-only. The large surfaces that had no reason to
transition before carry a 0.42s colour transition; everything else already
crossfades through its own hover transitions. There is deliberately no
blanket `* { transition: … }` — that starts a transition on ~1,300 nodes at
once, which is exactly the kind of thing the rest of this build avoids.

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
| `themeSw`, `accBtn`, `accPop` + `.acc-sw[data-accent]` | theme switch and accent tray |
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
  layering and shadows stay. The theme and accent controls keep working — they
  are not motion.
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
