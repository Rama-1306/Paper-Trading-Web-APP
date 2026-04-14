# Design System Document

## 1. Overview & Creative North Star: The Precision Ledger
This design system is built to transform high-density financial data into a high-end editorial experience. Moving away from the generic "SaaS-blue" landscape, this system leverages Western Union’s heritage of bold authority and global movement. 

**Creative North Star: "The Precision Ledger"**
The system treats the UI as a series of sophisticated, stacked financial instruments. It breaks the "template" look through intentional asymmetry—utilizing wide margins for breathing room contrasted against high-density data modules. By combining the technical precision of Plus Jakarta Sans with a ruthless commitment to tonal depth over structural lines, the system feels both heritage-trusted and future-ready.

---

## 2. Colors
Our palette is anchored by "Western Union Gold," but its power comes from the high-contrast professional neutrals that surround it.

### Core Palette
- **Primary (The Signature):** `#FFCC00` (primary_container). This is used exclusively for "Moment of Truth" interactions—primary CTAs, success states, and critical highlights.
- **The Obsidian Base:** `#000000` (on_background). Used for primary headlines to create an authoritative, editorial anchor.
- **The Tonal Grays:** A range from `#fbf9f5` (surface) to `#dbdad6` (surface_dim). These are the workhorses of the system.

### The "No-Line" Rule
To maintain a premium, seamless aesthetic, **solid 1px borders are strictly prohibited** for sectioning. Boundaries must be defined through background color shifts:
*   Place a `surface-container-low` module onto a `surface` background to define its shape.
*   Use `surface-container-highest` for interactive elements like input fields to provide a "recessed" feel without a border.

### Signature Textures & Glass
*   **The Glass Principle:** For floating elements (modals, dropdowns, floating nav), use `surface-container-lowest` at 85% opacity with a `24px` backdrop-blur. This creates a "frosted glass" effect that keeps the UI feeling light and integrated.
*   **The Kinetic Gradient:** For hero backgrounds and high-level CTAs, use a subtle linear gradient from `primary` (#745b00) to `primary_container` (#ffcc00) at a 135-degree angle. This adds "soul" and movement to otherwise flat surfaces.

---

## 3. Typography
We use **Plus Jakarta Sans** to bridge the gap between technical fintech and human-centric design. Its modern, slightly curvy geometry provides a friendly counterpoint to the high-density data.

*   **Display Scale (Editorial Impact):** Use `display-lg` (3.5rem) with `-0.02em` letter spacing for hero headlines. This creates a bold, "newspaper masthead" feel.
*   **The Data/Body Balance:** Body text (`body-md`, 0.875rem) should use a generous line height (1.6) to ensure readability in high-density environments.
*   **Labels:** `label-sm` (0.6875rem) should be set in All Caps with `0.05em` letter spacing when used above data points to act as a sophisticated "metadata" layer.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are often "dirty" and cluttered. This design system achieves depth through **Tonal Layering**—treating the screen as a physical stack of fine paper and glass.

*   **Layering Principle:**
    *   **Level 0 (Canvas):** `surface` (#fbf9f5)
    *   **Level 1 (Sections):** `surface-container-low` (#f5f3ef)
    *   **Level 2 (Cards/Modules):** `surface-container-lowest` (#ffffff)
*   **Ambient Shadows:** If an element must float (e.g., a "Send Money" fab), use a shadow with a `32px` blur, 0px offset, and 6% opacity. The shadow color must be a tinted version of the surface color (e.g., a warm umber) rather than a neutral gray.
*   **The Ghost Border:** For accessibility in high-contrast modes, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary_container` (#FFCC00) with `on_primary_fixed` (#241a00) text. Corner radius: `lg` (0.5rem).
*   **Secondary:** Glass-style. `surface-container-highest` background with 40% opacity and a backdrop blur.
*   **Tertiary:** No background. Bold text in `primary` with a small `4px` yellow dot to the left of the label to signify interactivity.

### Cards & Modules
*   **Rule:** No dividers. Use `32px` or `48px` of vertical white space to separate content blocks.
*   **Header Modules:** Use a `surface-container-high` background for the top 20% of a card to anchor the title, transitioning into a `surface-container-lowest` body.

### Input Fields
*   **Style:** Minimalist boxes using `surface-container-highest`. 
*   **States:** On focus, the background remains the same, but a `2px` `primary` (#FFCC00) line appears only at the bottom, creating a "ledger" look.

### Transaction Chips
*   **High-Density Fintech:** For currency conversions or status updates, use small `md` (0.375rem) rounded chips with `surface-container-high` backgrounds and `title-sm` typography.

### Sophisticated Indicators
*   **Progress Bars:** Use a `surface-container-highest` track with a `primary` kinetic gradient fill. No rounded caps; use sharp 90-degree edges for a more technical, "ledger" feel.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts. Push content to the left and leave large "white-space lungs" on the right for an editorial feel.
*   **Do** stack `surface-container` tiers to create hierarchy.
*   **Do** use the `primary` yellow as a "laser"—it should guide the eye to the most important action on the screen.

### Don't
*   **Don't** use 1px black borders. It cheapens the fintech experience.
*   **Don't** use standard "drop shadows." If a shadow is visible enough to be identified as a "shadow," it is too heavy.
*   **Don't** use generic icons. Use thick-stroke, custom-styled icons that match the weight of Plus Jakarta Sans Bold.
*   **Don't** clutter the screen. If the density is high, increase the contrast between `on_surface` (text) and `on_surface_variant` (labels) to help the user's eye scan the data hierarchy.