# LPai-App
TheSiznit
LPai App UI Project Note
As of May 2025, we are standardizing all modal-style forms and popups in the LPai App (React Native) to use a bottom sheet approach for optimal mobile UX and future-proofing.

Bottom sheets will replace traditional modals for major actions like creating appointments, editing contacts, and similar tasks.

All dropdowns, selection lists, and pickers will be rendered within the bottom sheet, never as Portals or menus that escape the sheet/modal layer.

This avoids all overlay/layer/z-index bugs, ensures a seamless “mobile-native” feel, and is in line with UX standards for top SaaS and mobile apps in 2025.

Action: As we iterate, we’ll gradually convert legacy modals/portals (like CreateAppointmentModal) to bottom sheet components, starting now.

How We’ll Do It (Summary for Team/Future You)
Replace Modal/Portal + Paper Menu/Dropdowns with a single bottom sheet (e.g., Gorhom Bottom Sheet).

All overlays (dropdowns, pickers, search results) render INSIDE the bottom sheet, absolutely positioned if needed—never in a Portal or separate Modal.

This fixes the “dropdown outside modal” bug and improves mobile feel.

We’ll start with appointment creation and update other modals as we go.

Project Practice: Centralized Theme and Types
1. Central Theme File (theme.js)
All future components must use shared color, font, and spacing constants from a central theme.js file (e.g., /src/styles/theme.js).

Examples of constants to centralize:

COLORS (brand, status, background, etc.)

FONT (sizes, weights)

SHADOW, SPACING, etc.

Component styles should use the theme file for all visual tokens.

If a style is reused (like a card shadow or border radius), define it in theme.js and spread it into your component styles.

Goal: Consistent look, easy updates, supports future dark/light mode.

2. Data Types
Always import and use types from the /src/types.ts file for all components, props, API payloads, etc.

When adding or updating a feature, reference the shared types instead of redefining inline (e.g., Project, Contact, Appointment).

Goal: Type safety, maintainability, and single source of truth for data shape.

3. Backlog / Refactor List
Go back through legacy files/components and refactor to use:

Centralized theme variables for colors, fonts, spacing, shadows, etc.

Shared types for all interfaces and props.

Track refactored files in a checklist.

4. Future Reminders
Before starting a new screen/component:
a. Check if a color/font/spacing already exists in theme.js and use it.
b. Always import types from /src/types.ts.



Yes, we will save Ionicon anem in db right? that will be what they can choose from is only ionicons. Would that be best? You can ge the code from the quotepresentationscreen, each block is being taken from there