---
name: Kinetic Logic
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#434654'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#4c5e83'
  on-secondary: '#ffffff'
  secondary-container: '#bfd2fd'
  on-secondary-container: '#475a7e'
  tertiary: '#414446'
  on-tertiary: '#ffffff'
  tertiary-container: '#595b5d'
  on-tertiary-container: '#d2d3d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#b4c7f1'
  on-secondary-fixed: '#041b3c'
  on-secondary-fixed-variant: '#34476a'
  tertiary-fixed: '#e1e2e4'
  tertiary-fixed-dim: '#c5c6c8'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  container-padding: 24px
  element-gap: 12px
  sidebar-width: 240px
  sidebar-collapsed: 64px
  header-height: 56px
---

## Brand & Style

The design system is engineered for Railway Intelligence, prioritizing operational clarity and high-density data visualization. The personality is "Calmly Authoritative"—a fusion of modern mobility aesthetics and precision navigation systems. It targets transit operators and analysts who require a high-fidelity interface that remains legible during long shifts.

The design style is **Corporate / Modern** with a focus on functional minimalism. It utilizes a layered white-on-off-white approach to minimize eye strain while maintaining a distinct hierarchy. Visual noise is aggressively reduced: no heavy gradients, no aggressive glassmorphism, and no decorative elements that do not serve a data-driven purpose. The result is a UI that feels responsive, reliable, and strictly operational.

## Colors

The palette is anchored by **Railway Blue** (#0052CC), a high-visibility primary used for actions and active states. The background strategy employs a "Cool Canvas" approach: a base of very light gray/off-white (#F4F5F7) to distinguish the application frame from the content.

Content surfaces are pure white (#FFFFFF), creating a clear "Elevated Paper" effect. Text uses a high-contrast Navy/Charcoal (#172B4D) for maximum readability. The status system is semantic and rigid:
- **On Time (Green):** Safe operational status.
- **Minor (Amber):** Watch status.
- **Significant (Orange):** Intervention required.
- **Severe (Red):** Critical alert.
- **Live/Predictive (Blue):** Real-time data streams.

## Typography

This design system uses a dual-font strategy. **Manrope** is used for headlines and structural headers to provide a modern, slightly rounded technical feel. **Inter** is used for all body text, labels, and data points due to its exceptional legibility at small sizes.

For data-heavy tables and railway timestamps, use the `data-mono` style (Inter with tabular spacing settings) to ensure numerical columns align perfectly. Mobile scaling reduces `display-lg` to 24px and `headline-md` to 20px to accommodate dense dashboards on smaller screens.

## Layout & Spacing

The system follows a **Fixed-Fluid Hybrid** grid. The sidebar and header are fixed dimensions to maintain a stable operational cockpit, while the main content area uses a 12-column fluid grid. 

A tight 4px baseline grid ensures the "compact" requirement is met. Gutters are kept at 16px to maximize information density without sacrificing clarity. 
- **Desktop:** 12 columns, 24px margins.
- **Tablet:** 8 columns, 16px margins.
- **Mobile:** 4 columns, 12px margins, sidebar collapses to a bottom bar or hidden drawer.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** supplemented by **Low-Contrast Outlines**. 
- **Level 0 (Background):** Off-white (#F4F5F7), used for the application shell.
- **Level 1 (Cards/Panels):** Pure White (#FFFFFF) with a 1px border (#E2E8F0) and a very soft, diffused shadow (0px 2px 4px rgba(0,0,0,0.04)).
- **Level 2 (Modals/Popovers):** Pure White with a more pronounced shadow (0px 8px 16px rgba(0,0,0,0.08)) to indicate temporary interaction.

Avoid heavy shadows or dark overlays. The goal is a "flat-but-stacked" appearance.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a modern touch while maintaining the structural integrity required for data-heavy enterprise software. 
- **Inputs & Buttons:** 4px (0.25rem).
- **Cards & Larger Containers:** 8px (0.5rem).
- **Status Indicators/Tags:** 4px or fully pill-shaped if they represent discrete entities like "Train IDs".

## Components

### Buttons
- **Primary:** Railway Blue background, white text. No gradient. 
- **Secondary:** White background, 1px gray border, Navy text.
- **Ghost:** No background or border, used for utility actions in toolbars.

### Cards
Cards are the primary container for intelligence widgets. They must have a 1px #E2E8F0 border. Titles should be in `headline-sm` with a subtle bottom divider separating the header from the content.

### Inputs & Fields
Inputs use a white background with a 1px border. On focus, the border changes to Railway Blue with a 2px soft outer glow. Use "Compact" height variants (32px) for data-entry intensive screens.

### Data Tables
The core of the intelligence system. Rows should have a subtle hover state (#F8FAFC). Use `data-mono` for all numerical values. Status colors should be applied as a small circular indicator next to text or as a subtle "sub-line" border on the left edge of the row.

### Sidebar
The sidebar should use a slightly darker neutral or the off-white background to differentiate navigation from the workspace. Icons should be 20px, stroke-based, and use the Navy/Charcoal color at 70% opacity for inactive states.