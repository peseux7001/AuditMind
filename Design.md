# AuditMind Design Guidelines

AuditMind should use the Microsoft Teams UI Kit as a reference system, not as a direct visual clone. The goal is a work-focused product UI that feels native to a Microsoft 365/Teams environment: quiet, collaborative, trustworthy, accessible, and efficient.

Source reference:

- Figma file: `Microsoft Teams UI Kit (Community)`
- Introduction page: `6150:141`
- Colors page: `6150:151`
- Library: `Microsoft Teams UI Kit (Community)`

## Design Principles

AuditMind interfaces must follow these principles from the Teams UI Kit and adapt them to an audit/compliance workflow.

- **Collaborative**: Support shared work, review, comments, ownership, status, and handoff. Make it clear who is responsible for each item and what changed.
- **Trustworthy**: Prioritize clarity, security, auditability, and transparent state. Users should always understand data provenance, privacy boundaries, and approval status.
- **Globally inclusive**: Use accessible language, predictable patterns, keyboard-friendly flows, and culturally neutral visuals.
- **Light**: Keep screens focused on core tasks. Avoid decorative weight, dense hero treatment, or marketing-style panels inside the product.
- **Native or distinct**: Use Teams/Fluent-inspired components consistently, or use a clearly intentional AuditMind component. Do not mix unrelated control styles.
- **Useful**: Every visible surface should help users complete a real workflow: review evidence, track risks, assign work, approve changes, or understand status.
- **Easy to use**: Prefer obvious labels, familiar controls, and low-friction scanning over clever interactions.
- **Responsive**: Layouts must work across desktop, laptop, and tablet widths without hiding essential audit state.
- **Accessible**: Meet contrast requirements, provide visible focus, preserve keyboard navigation, and do not encode meaning by color alone.
- **Well described**: Text, icons, and empty states must clearly explain what the screen is for and what action is available next.

## Product Tone

AuditMind is a professional audit and compliance tool. The UI should feel calm, precise, and dependable.

- Use direct, plain language.
- Prefer action verbs: `Review`, `Assign`, `Approve`, `Resolve`, `Export`.
- Avoid playful copy in risk, control, evidence, or approval flows.
- Use concise helper text only where it reduces ambiguity.
- Error and warning text must explain the problem and the next step.

## Layout

Use a Teams-style application shell as the default mental model.

- **App shell**: Persistent left navigation, top context/header region, and a main work canvas.
- **Work canvas**: Dense but organized. Prioritize tables, lists, detail panes, filters, and status summaries.
- **Content width**: Dashboards and tables should use the available width. Narrative pages can use constrained widths for readability.
- **Hierarchy**: Page title, compact description, primary controls, then content.
- **Spacing**: Use consistent spacing steps based on `4px` increments. Prefer `8`, `12`, `16`, `24`, `32`, and `48`.
- **Cards**: Use cards only for repeated records, summary tiles, or contained forms. Do not place cards inside cards.
- **Radius**: Keep radii restrained. Default container radius should be `8px` or less unless matching a specific Fluent/Teams control.

## Color

Use neutral surfaces first. Teams brand colors should be used sparingly for orientation, selected states, and live/active activity.

Core reference colors observed from the Teams UI Kit:

| Token | Value | Use |
| --- | --- | --- |
| `teams.brand` | `#6264A7` | Primary orientation, selected nav, active states, key accents |
| `text.primary` | `#2A2A2A` | Main headings and high-emphasis text |
| `text.secondary` | `#424242` | Standard body text and labels |
| `text.tertiary` | `#616161` | Subtle metadata and secondary nav |
| `text.muted` | `#717171` | Descriptions and low-emphasis explanatory text |
| `surface.base` | `#FFFFFF` | Main surface |
| `surface.subtle` | `#E0E0E0` | Pills, subtle badges, separators, inactive fills |

Usage rules:

- Use neutral backgrounds for most product surfaces.
- Reserve brand purple for active navigation, selected filters, primary action emphasis, and focused orientation.
- Do not build one-note purple pages. Most UI should remain neutral with precise accent use.
- Use green for success/available states, red for destructive or failed states, yellow/orange for warnings, and always pair color with text or iconography.
- Support light and dark themes conceptually, even if the first implementation ships light-only.

## Typography

Use Segoe UI as the target typeface where available, with system fallbacks.

```css
font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
```

Reference type from the UI kit:

- Large documentation heading: `96px`, semibold, used only for large docs/cover pages.
- Product page headings: use smaller application scale instead of oversized marketing type.
- Section heading: `32px / 40px`, semibold.
- Body text: `20px / 32px` in the source documentation, but AuditMind app UI should usually use `14px` to `16px` body text for dense product screens.

AuditMind application scale:

| Role | Size | Weight | Use |
| --- | ---: | ---: | --- |
| Page title | `24-28px` | `600` | Main product view title |
| Section title | `18-20px` | `600` | Panels, table sections, form groups |
| Body | `14-16px` | `400` | Main product copy |
| Metadata | `12-13px` | `400` | Timestamps, IDs, status details |
| Button label | `14px` | `600` | Primary and secondary actions |

Typography rules:

- Letter spacing should remain `0`.
- Avoid viewport-scaled font sizes.
- Keep table and dashboard text compact enough for repeated use.
- Use semibold sparingly for hierarchy, not decoration.

## Components

Prefer Fluent/Teams-inspired controls and states.

- **Buttons**: Primary, secondary, subtle, icon-only, and destructive variants. Include hover, pressed, focus, disabled, and loading states.
- **Navigation**: Left app nav with selected state and compact labels. Use icons only when the meaning is established.
- **Tables**: Default surface for audit evidence, controls, risks, tasks, and findings. Include sort, filter, selection, status, and row action patterns.
- **Forms**: Labels above fields, clear validation, helper text only when useful.
- **Badges and pills**: Use for status, severity, owner, and workflow stage. Keep them compact.
- **Dialogs and drawers**: Use for focused edits or review. Avoid full-screen interruption unless the workflow is complex.
- **Notifications**: Use Teams-style concise notification patterns for assignment, review, approval, and evidence updates.
- **Avatars/presence**: Use for owners, reviewers, and collaborators where accountability matters.

All interactive components need these states:

- Rest
- Hover
- Pressed
- Focus visible
- Disabled
- Loading or pending, when applicable
- Error or validation, when applicable

## AuditMind-Specific Patterns

Use these patterns consistently across the website/app.

- **Evidence records**: Show source, owner, date, confidence/status, and linked control.
- **Controls**: Show objective, owner, review cadence, latest evidence, and exceptions.
- **Risks**: Show severity, likelihood, impact, mitigation, owner, and due date.
- **Approvals**: Show requested by, reviewer, status, decision history, and timestamp.
- **Audit trail**: Make history visible and immutable in tone. Avoid hiding critical audit changes behind hover-only UI.
- **AI output**: Label generated summaries clearly, show source references, and provide review/accept controls.

## Accessibility

Accessibility is a product requirement, not polish.

- Maintain WCAG contrast for text, icons, focus rings, and status indicators.
- Provide keyboard access to navigation, tables, filters, dialogs, and menus.
- Never rely on color alone for status or severity.
- Use visible focus rings that are easy to find on both light and dark surfaces.
- Ensure all icon-only controls have labels or tooltips.
- Keep hit targets large enough for repeated professional use.

## Implementation Rules

When implementing AuditMind screens:

- Start from the real workflow, not a landing page.
- Use existing design tokens before adding new colors or sizes.
- Build dense, scan-friendly interfaces for repeated use.
- Use icons for familiar tool actions and text labels for consequential commands.
- Avoid decorative gradients, oversized heroes, nested cards, and purely atmospheric imagery.
- Validate responsive behavior at desktop and mobile widths.
- Keep UI state explicit: loading, empty, error, filtered, selected, unsaved, and submitted.

## Figma Reference Workflow

When using the Teams UI Kit as source material:

1. Use the Introduction page for design principles.
2. Use Layout & Scaling, Type, Colors, and Shape and elevation pages for system rules.
3. Use UI Components pages for component behavior and state references.
4. Search the `Microsoft Teams UI Kit (Community)` library for concrete assets such as notifications, buttons, chat patterns, and app shell references.
5. Adapt visual rules to AuditMind’s domain; do not copy Teams branding wholesale unless it improves familiarity inside a Teams-like workflow.
