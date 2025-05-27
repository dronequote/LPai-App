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
Complete Dynamic Template System Plan
Overview
Create a fully dynamic, database-driven template system where admins can:

Edit every piece of content (text, icons, colors)
Mix and match reusable content blocks
Create unlimited custom templates
Reuse block types multiple times per template

1. Database Schema (MongoDB)
Templates Collection
javascript{
  _id: "template_123",
  locationId: "loc_456",
  name: "Professional Plumbing Template",
  description: "Clean professional layout",
  primaryColor: "#2E86AB",
  accentColor: "#A23B72", 
  isDefault: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  tabs: [
    {
      id: "tab_1",
      title: "Why Choose Us", // fully editable
      icon: "🏠", // fully editable
      position: 1,
      enabled: true,
      blocks: [
        {
          id: "block_1",
          type: "hero",
          position: 1,
          content: {
            title: "Why Choose {companyName}",
            subtitle: "{companyTagline}",
            icon: "🔧"
          }
        },
        {
          id: "block_2", 
          type: "benefit_cards",
          position: 2,
          content: {
            cards: [
              {
                icon: "🏆",
                title: "Expert Craftsmanship",
                subtitle: "Professional Excellence", 
                description: "Professional solutions with {experienceYears} years..."
              }
              // ... more cards
            ]
          }
        }
        // ... more blocks
      ]
    }
    // ... more tabs (max 5)
  ]
}
2. Block Type Definitions
Reusable Block Types (from current templates):

hero - Title + subtitle + icon
benefit_cards - Grid of icon + title + subtitle + description
contact_info - Contact details with icons
quote_header - Quote number + project + customer
quote_breakdown - Pricing table
terms_section - Terms and conditions text
process_steps - Numbered steps with timeline
warranty_cards - Warranty feature cards
service_list - Checkmark list items
scope_list - Bulleted scope items
specifications - Two-column spec cards
text_section - Simple title + paragraph

3. API Endpoints
Template Management
GET /api/templates/[locationId] - Get all templates for location
POST /api/templates/[locationId] - Create new template
GET /api/templates/[locationId]/[templateId] - Get specific template
PATCH /api/templates/[locationId]/[templateId] - Update template
DELETE /api/templates/[locationId]/[templateId] - Delete template
Global Templates (for copying)
GET /api/templates/global - Get all global templates
POST /api/templates/[locationId]/copy/[globalTemplateId] - Copy global to location
4. Frontend Components
Block Components
src/components/blocks/
├── HeroBlock.tsx
├── BenefitCardsBlock.tsx
├── ContactInfoBlock.tsx
├── QuoteHeaderBlock.tsx
├── QuoteBreakdownBlock.tsx
├── TermsSectionBlock.tsx
├── ProcessStepsBlock.tsx
├── WarrantyCardsBlock.tsx
├── ServiceListBlock.tsx
├── ScopeListBlock.tsx
├── SpecificationsBlock.tsx
└── TextSectionBlock.tsx
Generic Block Renderer
javascript// src/components/BlockRenderer.tsx
const BLOCK_COMPONENTS = {
  hero: HeroBlock,
  benefit_cards: BenefitCardsBlock,
  contact_info: ContactInfoBlock,
  // ... etc
};

const BlockRenderer = ({ block, variables }) => {
  const BlockComponent = BLOCK_COMPONENTS[block.type];
  if (!BlockComponent) return null;
  
  const processedContent = replaceVariables(block.content, variables);
  return <BlockComponent {...processedContent} />;
};
Updated Quote Presentation Screen
javascript// Generic tab renderer
const renderTab = (tab, variables) => {
  return (
    <ScrollView>
      {tab.blocks.map(block => (
        <BlockRenderer 
          key={block.id}
          block={block} 
          variables={variables}
        />
      ))}
    </ScrollView>
  );
};
5. Variable System
Variable Sources (Priority Order):

Template-specific overrides (if admin customized)
Location data (company info, branding)
Quote data (amounts, customer info)
Fallback defaults

Variable Processing:
javascriptconst buildVariables = (template, location, quote) => {
  return {
    // Company variables
    companyName: template.customCompanyName || location.companyName || "Your Company",
    companyTagline: template.customTagline || location.tagline || "Your trusted experts",
    phone: template.customPhone || location.phone,
    email: template.customEmail || location.email,
    address: template.customAddress || location.address,
    warrantyYears: template.warrantyYears || location.warrantyYears || "5",
    experienceYears: template.experienceYears || location.experienceYears || "10",
    
    // Quote variables  
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    projectTitle: quote.projectTitle,
    totalAmount: quote.totalAmount,
    
    // Color variables
    primaryColor: template.primaryColor,
    accentColor: template.accentColor
  };
};
6. Implementation Steps
Phase 1: Core System

✅ Create static tabTemplateDefinitions.js (DONE - but will be replaced)
Create MongoDB template schema
Create block component definitions
Build generic BlockRenderer component
Update QuotePresentationScreen to use BlockRenderer

Phase 2: Template Management

Create template CRUD APIs
Build TemplateSelectionModal (using dynamic templates)
Convert static definitions to database records
Create default global templates

Phase 3: Admin Features

Build template editor interface
Add block drag-and-drop functionality
Implement variable override system
Add template preview functionality

Phase 4: Advanced Features

Template versioning
Template sharing between locations
Custom block type creation
Advanced variable system

7. Migration Strategy
Convert Current Static Templates:

Take existing tabTemplateDefinitions.js content
Create MongoDB documents with block structure
Seed database with converted templates
Update presentation screen to use database templates
Remove static definition file

8. Future Extensibility
Easy to Add:

New block types (just create component + register)
New variable types (extend variable system)
New template layouts (combine existing blocks)
Custom branding per template
Template marketplace/sharing

Admin Builder Vision:
Eventually becomes a drag-and-drop interface where admins can:

Drag blocks from palette into tabs
Edit all content inline
Preview changes live
Save custom templates
Share templates with other locations


Yes, we will save Ionicon anem in db right? that will be what they can choose from is only ionicons. Would that be best? You can ge the code from the quotepresentationscreen, each block is being taken from there