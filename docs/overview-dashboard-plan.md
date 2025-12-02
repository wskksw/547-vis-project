# Overview Page Layout Plan

- Goals: cut vertical scrolling, keep context visible via linked highlighting instead of hard filtering, and foreground the weighted severity signal (S = flags × 10 + poor LLM &lt; 0.4).
- Space strategy: collapse chrome (smaller paddings, inline legends), enlarge typography on labels so charts can be physically smaller without losing readability, and avoid nested scroll areas.

## Layout sketch
- Header bar: left shows run counts + active chips; right has mode toggle (`Highlight` vs `Filter`) so brushing/chunk clicks can layer context by default but still allow isolation.
- Main grid (desktop ≥1280px): two columns.
  - Left (≈65% width, balanced heights):
    - Quality scatter (height ~420) with inline legend badges and compact axes; clicking a point opens question, brushing highlights other views.
    - Directly below, two mini distribution charts side-by-side (LLM vs similarity) with reduced margins; stacked on narrow screens.
  - Right (≈35% width, sticky): Document Fingerprint list with tighter row height and wider label typography. Include compact legend (“Safe ↔ Hotspot” pills) and action chips at top.
- Detail tray: when a chunk or doc is active, show a small card under the fingerprint header (not pushing the whole page) so the main charts stay stationary.
- Instructions: replace the big panel with a collapsible “?” popover and inline helper text near controls.

## Document Fingerprint controls
- Sort + filter pills: `Severity (S)`, `Flags`, `Poor LLM`, `Retrieved`. Default to Severity; clicking a pill filters the list to the top N (slider/input) or highlights matching chunks while dimming others.
- Metric thresholds: quick filters for `Flags > 0`, `Poor LLM >= 1`, `Retrievals >= N`; expose a small numeric input for N to avoid wasting room.
- Chunk preview: keep hover preview; click locks selection and highlights related runs in scatter/histograms (without removing the rest unless the user switches to Filter mode).

## Interaction refinements
- Linked highlighting: brushing scatter or clicking histogram bars dims non-matching points/bars/fingerprint rows instead of removing them; “Filter” mode can still hard-filter when needed.
- Tooltip stacking: ensure overlays stay fixed and non-scrolling; document the color ramp inline so the legend can shrink.
- Keyboard: add `Esc` to clear selections and `Enter` on focused chunk to open details (accessibility without extra UI space).

## Stretch ideas (scented widgets)
- Mini sparklines beside each filter pill showing count share.
- “Top offenders” micro-list (3 rows) inline under the fingerprint header to reduce scrolling when there are many docs.
- Optional “show chunk text on hover” toggle to reduce accidental popups.

## Delivery steps
1) Re-layout OverviewDashboard grid and header controls; shrink paddings and move instructions to a popover.  
2) Implement highlight-vs-filter mode and keep other views visible when linked selections change.  
3) Add fingerprint sort/filter pills + threshold inputs (Flags/Poor/Retrieved/Severity).  
4) Tighten typography/sizing in DocumentUsageChart and distribution charts; keep mobile stacking clean.  
5) QA for cross-highlighting correctness, accessibility keys, and tooltip positioning.
