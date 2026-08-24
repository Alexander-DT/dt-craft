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

dist/dt-lab.css                the component lab's styling
dist/dt-lab.js                 the component lab's behaviour
dist/dt-lab-chrome.js          nav + palette + atmosphere + footer (generated)
dist/dt-lab-<page>.js          one per lab page: chrome + markup   (generated)
media|cards|…|backgrounds|scroll.html      the seven lab pages

build.js                       regenerates everything marked (generated)
```

Hand-edited: `index.html`, the five lab pages, `dist/dt-craft.{css,js}` and
`dist/dt-lab.{css,js}`. Everything else is derived — after changing any of
them, run:

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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-craft.css">

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
<script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-craft.standalone.js" defer></script>

<!-- or, once the sections exist natively in Webflow -->
<!-- <script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-craft.js" defer></script> -->
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

## The component lab

Seven pages of alternatives, so a direction can be chosen from something
scrollable rather than from a description. Nineteen components and seventeen
procedural grounds in all:

| Page | Components |
|---|---|
| `media.html` | orbital sphere carousel · cylinder carousel · MotionFlow rail · slice slider · scrubbed scroll gallery |
| `cards.html` | highlight accordion · throw deck · bento morph · scroll stack · tilt grid |
| `testimonials.html` | orbit · leaning marquee wall · spotlight rail · coverflow · ledger |
| `cta.html` | honeycomb hive · vault door · aurora · drawn seal · marquee stamp |
| `team.html` | orbit · roster with pointer-carried portrait · discipline helix |
| `backgrounds.html` | six full-bleed scenes and the transitions between them, a parallax band, and every ground at thumbnail size |
| `scroll.html` | six scroll set-pieces: gradient text, split screen, word cascade, horizontal pan, cinematic counter, depth flight |

Everything resolves through the same tokens as the homepage, so both axes
repaint the lab as well. Nothing here introduces a hue.

### Grounds

Each component sits on its own field, drawn by one engine in `dt-lab.js`.
A canvas declares which field it is and how to run it:

```html
<canvas class="stage-bg" data-bg="hex" data-size="26" data-alpha="1.6"
        data-speed="1" data-density="1" data-seed="7" aria-hidden="true"></canvas>
```

`data-bg` is one of `starfield`, `rings`, `streaks`, `scan`, `grid3d`, `hex`,
`mesh`, `contour`, `dust`, `moire`, `ledger`, `aurora`, `terrain`, `plasma`,
`caustics`, `circuit`, `orbits` — seventeen in all, and `backgrounds.html`
shows every one of them at thumbnail size.

Each reads `--fx-rgb` **from its own host element**, so a field inside an
inverted island keeps the bright accent while the page flips, and `--fx-blend`
to know which way to composite: lightening onto the dark ground, darkening
onto paper. Every one sleeps off-screen and when the tab hides, and paints a
single static frame under `prefers-reduced-motion`.

`plasma` and `caustics` share one engine that computes at a seventh to a ninth
of the frame and scales back up — a shader's look without a shader's budget.
`aurora` renders at 0.55× and leans on `ctx.filter` blur, because an aurora has
no detail to lose.

### The scene rig

`backgrounds.html` carries a rig of full-bleed scenes where each arrives over
the last a different way. One scrubbed value drives all of it: scene *i* is
fully present at `t = i`, so its arrival occupies `t = i-1 → i` and its
departure `t = i → i+1`, both clamped — which is why the first scene never
arrives and the last never leaves.

```html
<section class="scene" data-enter="curtain" data-exit="hold">
```

`data-enter` is `cover`, `push`, `slide`, `curtain`, `iris` or `fold`;
`data-exit` is `recede` (the default), `rise`, `slide` or `hold`. Both are
pure CSS keyed off `--a` and `--o`, so a seventh way in is one selector rather
than another branch in the module.

Only the two scenes actually in play are drawn — the rest hold their last frame
behind `visibility: hidden`, gated by `data-on` on the scene itself. The rig's
height is set from the scene count, and under `prefers-reduced-motion` it
collapses to six ordinary full-height sections.

### The specimen plate

`.gplate` is a guilloché rosette cut from four gradient passes — no raster and
no request, and it re-inks on both axes because every stop is an accent token.
`--pa` sets the engraving angle and `--pb` the radial pitch; unset, they are
stamped from the element's index so no two on a page are cut the same way.

### Scroll set-pieces

`scroll.html` is the same rig again, aimed at sections rather than whole
pages. A tall section carries `data-pin` and holds a `.pin-stage`; the module
drives the stage's pin offset and writes `--k` across the section, and every
treatment below that is CSS reading the one value:

```html
<div class="pin" data-pin>
  <div class="pin-stage"> … </div>
</div>
```

Six treatments ship: **gradient text** (a dim copy plus a lit copy uncovered a
line at a time, its gradient travelling as it goes), **split screen** (one word
drawn twice, each half of the screen clipping its own half of it), **word
cascade** (per-word offsets mixed in oklab from dim ink to accent), **horizontal
pan** (`translateX(calc(var(--k) * (100vw - 100%)))` — the overshoot is exact,
so nothing is measured and nothing goes stale on resize), **cinematic counter**
and **depth flight**.

`data-k-out` on any element inside a pinned section turns it into a read-out of
the scrub — `data-k-max` and `data-k-pad` set the range and the zero padding.
`data-words` splits a paragraph for the cascade while leaving the real sentence
in the accessibility tree.

All six are reversible, all six settle to their finished frame under
`prefers-reduced-motion`, and none of them uses a scroll library.

### Using a lab page in Webflow

Head:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-craft.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-lab.css">
```

plus the same theme snippet the homepage uses. Before `</body>`, three tags —
**in this order**:

```html
<script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-lab-media.js" defer></script>
<script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-lab.js" defer></script>
<script src="https://cdn.jsdelivr.net/gh/Alexander-DT/dt-craft@v1.8.0/dist/dt-craft.js" defer></script>
```

Swap `dt-lab-media.js` for `dt-lab-cards.js`, `-testimonials`, `-cta`,
`-team`, `-backgrounds` or `-scroll`. Deferred scripts run in document order, so the markup exists before
`dt-lab.js` looks for its components and before `dt-craft.js` looks for
`#themeSw`. Reverse any two and the theme switch is dead.

The bundles rewrite `media.html` to `/media` on the way through, so the `.html`
files stay openable off disk while the hosted pages use real routes. The nav's
lab links follow whichever shape the current URL has.

### Two things worth knowing

- **No `position: sticky` anywhere.** The smooth scroll is transform-based, so
  `#vp` is a scrollport that never scrolls and a sticky child would simply ride
  the transform. The scroll gallery and the card stack scrub their pin offset
  instead, which behaves the same with the rig on or off.
- **The vault door and the seal are authored open.** They only close behind the
  `dt-lab` class, which `dt-lab.js` puts on `<html>` at boot — so if the craft
  layer ever fails to load, the call to action is visible rather than shut
  behind a door that will never open.

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
