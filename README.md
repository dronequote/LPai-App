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
**********************************************************************************************
******************In-App Signature & Document Approval Overview (May 2025 Update)*************
**********************************************************************************************

Goal
Modernize the proposal workflow so users can capture signatures and approve agreements directly in the LPai mobile app—no more forcing both parties to check their email. Supports both instant signing (in-person) and remote email-based signing for flexibility.

UX Overview
Replace/Get Signature Button
On the proposal screen, replace the old “Get Signature” button with a new, clearer Next Steps button.

Next Steps Modal/Sheet (opens when tapped):
Presents two options:

Sign & Approve Now (for in-person signing on device)

Opens the document preview with signature boxes for consultant & customer.

Both sign directly on the device.

Signatures are captured and overlaid on the PDF.

The signed doc is instantly saved, emailed to both parties, and stored in MongoDB/GHL.

Send for Signature/Email Agreement (for remote/async)

Triggers the existing email/webhook flow:

Proposal sent out for digital signing via email.

Both parties complete signatures at their own convenience.

Technical Implementation
Signature Capture:
Use react-native-signature-canvas to capture signatures within the app.

PDF Handling:
Use pdf-lib or backend service to overlay signature images onto the PDF at the correct spots.

Distribution:
After completion, the app (or backend):

Emails the final signed PDF to both the customer and consultant.

Stores the signed PDF in MongoDB/cloud storage.

Optionally, sends a webhook to GHL to update the opportunity or attach the document.

User Flow Summary
User taps “Next Steps”

Chooses:

Sign & Approve Now (for instant, on-device signing)

Send for Signature (for email/digital signing)

Document is signed and distributed via email/DB, as above.

Why This Matters
Provides a professional, “Jobber/ServiceTitan-level” signing flow.

Eliminates friction and delays from email-based signature collection.

Allows both remote and in-person deals to close faster.

Ensures documents and signatures are always saved and synced.

TODO:

 Implement Next Steps button and modal

 Add in-app signature capture using react-native-signature-canvas

 Integrate PDF overlay logic (pdf-lib or backend)

 Add document emailing & storage logic

 Keep legacy email-signing as fallback option


**********************************************************************************************
******************Publish Quote (May 2025 Update)*************
**********************************************************************************************
LPai App – Proposal/Quote Sharing, Signature & Web Link Workflow (2025 Master Spec)
Step 1: Share Button & Sharing Modal
User Flow
User taps Share (top right).

Share Modal opens:

Primary/Recommended Option:

“Send Web Link via Email (Recommended, based on GHL template)”—default can be set per location in the future.

Advanced Options:

Send PDF by Email

Send Web Link by Email

Send Both (PDF + Link)

Copy Web Link (to clipboard, all users)

Confirmation Prompt:

“Are you sure you want to send this proposal?”

Action:

Proposal is published, email is prepared using the GHL template, with consultant shown a preview/edit screen.

Upon send, email is sent via GHL API/template, action is logged in the activity feed.

Success Feedback:

“Quote published and sent!”

User is auto-navigated to Project Profile/Detail.

Edit Attempt on Published Quote:

“This quote is already published. Are you sure you want to edit it? Your changes will update the version your client sees.”

Step 2: Publishing & Status
Published = Quote has been shared by any method (PDF, link, both).

App/internal UI:

“Published” badge + date, last updated, published by, full activity feed.

Web Client UI:

Only “Published” badge and date.

Activity Feed:

Logs every publish, edit, and recall/unpublish (user, timestamp, action).

Edit Warning:

Editing a published quote prompts a modal:

“This quote is already published. Are you sure you want to edit it?”

After Edit:

After making changes, consultant is prompted:

“Would you like to notify the client about the update?” (Yes/No)

Versioning:

Internal version is incremented with every publish/edit; client always sees latest published version.

Version history is internal only (not visible to clients).

Recall/Unpublish:

“Recall” disables client access and displays:

“This quote has been recalled or expired. Please contact your consultant.”

Draft Mode:

All quotes are drafts until first published/shared.

Step 3: Web Link & Real-Time Update Workflow
Web Link:

Each quote gets a secure, unique link (not indexed).

Client lands on a branded, responsive quote page showing all details, “Published” badge, and Approve & Sign button.

No Download PDF button (consultant can send signed PDF after signing).

Real-Time Sync:

Page always loads latest published version.

If consultant edits after client opens, display:

“This quote was updated since you last viewed it.”

Recall/Expiry:

If quote is recalled or after both parties sign, page displays:

“This quote has been recalled or expired. Please contact your consultant.”

Analytics/Tracking:

Track first opened, last viewed, and signed (saved in DB/activity feed).

Request Revision:

“Request Revision” button opens message box; client can send feedback/questions directly to consultant (notifies consultant, logs in activity feed).

Step 4: Signature & Emailing (with GHL Integration)
A. Signing Flow (Web & In-App)
Consultant signs first (either when sending, or in advance).

Client signs second (via web link or in-app).

After both sign:

Both signatures and timestamps saved to DB.

Signed PDF is generated, with:

All quote data as of signing

Both signatures and times

Audit block (“Signed by Consultant: [name] on [timestamp], Signed by Client: [name] on [timestamp]”)

Web link auto-expires (shows signed/expired message).

Activity feed logs all signing events.

B. Edits After Signature
If consultant attempts to edit after both have signed:

Show:
“Editing this proposal after signature and approval will void the current contract. Are you sure you want to continue?”

If confirmed, previous signed contract is expired (cannot be signed again), and a new signature flow must start for the edited quote.

C. Email Protocol
All proposal/share/send emails use GHL templates:

Consultant is shown a pre-populated preview screen in-app/web.

Consultant can edit before sending (dynamic body/subject).

Emails always sent via GHL API/template (current data, never from cached templates).

After signature:

Both client and consultant receive signed PDF and confirmation using GHL template for the location.

All outgoing content is branded and populated from location’s template and proposal data.

D. Security & Compliance
Web link expires/locks after signature or recall.

Audit log retained for all actions.

All signatures, times, and status changes included in PDF and DB for legal/compliance.

Technical & Legal/Industry Notes
Audit Block:

Including signature blocks with date/time and a summary (“Signed by...”) is industry standard for home service and SaaS e-contracts.

GHL Integration:

All emails and notifications are delivered using GoHighLevel’s templates and mailers for branding and deliverability.

All email content is previewed and can be edited prior to sending.

Data Model:

Quotes have:

published, publishedAt, publishedBy, lastUpdatedAt, lastUpdatedBy, version, activityFeed, signedByConsultant, signedByClient, signatures, recalled, recalledAt

Web Security:

All links tokenized and non-indexed.

Links auto-expire on signature or recall.

Draft Mode:

Quotes are editable until first publish/share.

Why This Rocks
Super modern, Jobber/ServiceTitan-grade quoting flow.

No friction—clients sign instantly or remotely, no login needed.

Consultants control all communication—can edit emails, see all actions.

Audit trail and legal compliance built in.

Fits perfectly with GHL’s branding and CRM automation.

Summary of Open/Optional Features
Admin portal for setting default sharing mode (future).

Recall/unpublish permission controls (future).

Version rollback or full version history (internal only, V2+).

Web client chat or in-page messaging (now for revision requests, can expand later).