# GHL Integration Status - Complete Field Reference

## Contacts & CRM

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Contact created | ✅ Native | ContactCreate webhook |
| Contact updated (any field) | ✅ Native | ContactUpdate webhook |
| Contact deleted | ✅ Native | ContactDelete webhook |
| Contact DND status changed | ✅ Native | ContactDndUpdate webhook |
| Contact tags added/removed | ✅ Native | ContactTagUpdate webhook |
| Note created on contact | ✅ Native | NoteCreate webhook |
| Note updated | ✅ Native | NoteUpdate webhook |
| Note deleted | ✅ Native | NoteDelete webhook |
| Task created | ✅ Native | TaskCreate webhook |
| Task completed | ✅ Native | TaskComplete webhook |
| Task deleted | ✅ Native | TaskDelete webhook |
| Contact birthday reached | ⚠️ Automation | Workflow trigger on date |
| Contact score threshold | ⚠️ Automation | Workflow trigger on score |
| Days since last contact | ⚠️ Automation | Workflow time-based trigger |

## Opportunities/Projects

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Opportunity created | ✅ Native | OpportunityCreate webhook |
| Opportunity updated | ✅ Native | OpportunityUpdate webhook |
| Opportunity deleted | ✅ Native | OpportunityDelete webhook |
| Opportunity status changed | ✅ Native | OpportunityStatusUpdate webhook |
| Opportunity stage moved | ✅ Native | OpportunityStageUpdate webhook |
| Opportunity assigned to user | ✅ Native | OpportunityAssignedToUpdate webhook |
| Opportunity value changed | ✅ Native | OpportunityMonetaryValueUpdate webhook |
| Opportunity stuck in stage X days | ⚠️ Automation | Workflow time-based trigger |
| Pipeline created/deleted | ⚠️ API | Periodic sync or manual trigger |
| Pipeline stages modified | ⚠️ API | Periodic sync or manual trigger |

## Appointments/Calendar

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Appointment created | ✅ Native | AppointmentCreate webhook |
| Appointment updated | ✅ Native | AppointmentUpdate webhook |
| Appointment deleted/cancelled | ✅ Native | AppointmentDelete webhook |
| Appointment reminder due | ⚠️ Automation | Workflow time-based trigger |
| Appointment no-show | ⚠️ Automation | Workflow trigger on status |
| Calendar availability changed | ⚠️ Automation | Trigger on calendar open (your solution!) |
| Calendar settings updated | ⚠️ API | Periodic sync or on calendar open |
| Appointment slots modified | ⚠️ API | Periodic sync or on calendar open |

## Messaging/Conversations

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Inbound SMS received | ✅ Native | InboundMessage webhook |
| Inbound email received | ✅ Native | InboundMessage webhook |
| Outbound message sent | ✅ Native | OutboundMessage webhook |
| Conversation unread count | ✅ Native | ConversationUnreadUpdate webhook |
| Email opened | ⚠️ Automation | Workflow trigger on email event |
| Email link clicked | ⚠️ Automation | Workflow trigger on email event |
| SMS delivered/failed | ⚠️ Automation | Workflow trigger on SMS status |
| Call completed | ⚠️ Automation | Workflow trigger on call |

## Forms & Surveys

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Form submitted (generic) | ⚠️ Automation | Workflow trigger on form submit |
| Specific form submitted | ⚠️ Automation | Workflow trigger with form filter |
| Form field specific value | ⚠️ Automation | Workflow condition on field |
| Survey completed | ⚠️ Automation | Workflow trigger on survey |
| Form created/edited | ⚠️ API | Periodic sync or manual |
| Form fields modified | ⚠️ API | Periodic sync or manual |
| Survey template changes | ⚠️ API | Periodic sync or manual |

## Commerce/Payments

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Product created | ✅ Native | ProductCreate webhook |
| Product updated | ✅ Native | ProductUpdate webhook |
| Product deleted | ✅ Native | ProductDelete webhook |
| Price created | ✅ Native | PriceCreate webhook |
| Price updated | ✅ Native | PriceUpdate webhook |
| Price deleted | ✅ Native | PriceDelete webhook |
| Order created | ✅ Native | OrderCreate webhook |
| Order status updated | ✅ Native | OrderStatusUpdate webhook |
| Invoice created | ✅ Native | InvoiceCreate webhook |
| Invoice updated | ✅ Native | InvoiceUpdate webhook |
| Invoice deleted | ✅ Native | InvoiceDelete webhook |
| Invoice sent | ✅ Native | InvoiceSent webhook |
| Invoice paid (full) | ✅ Native | InvoicePaid webhook |
| Invoice partially paid | ✅ Native | InvoicePartiallyPaid webhook |
| Invoice voided | ✅ Native | InvoiceVoid webhook |
| Payment failed | ⚠️ Automation | Workflow trigger on payment |
| First purchase made | ⚠️ Automation | Workflow trigger on order |

## Users & Team

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| User created | ✅ Native | UserCreate webhook |
| User role changed | ⚠️ API | Periodic sync |
| User permissions updated | ⚠️ API | Periodic sync |
| User deactivated | ⚠️ API | Periodic sync |
| Team created/deleted | ⚠️ API | Periodic sync |
| Permission groups changed | ⚠️ API | Periodic sync |

## Locations & Settings

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Location created | ✅ Native | LocationCreate webhook |
| Location updated | ✅ Native | LocationUpdate webhook |
| Business hours changed | ⚠️ API | Periodic sync or manual |
| Location branding/logo | ⚠️ API | Periodic sync or manual |
| Phone numbers changed | ⚠️ API | Periodic sync or manual |
| Email settings changed | ⚠️ API | Periodic sync or manual |
| Timezone changed | ⚠️ API | Periodic sync or manual |

## Custom Fields & Objects

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Custom object created | ✅ Native | ObjectCreate webhook |
| Custom object updated | ✅ Native | ObjectUpdate webhook |
| Custom record created | ✅ Native | RecordCreate webhook |
| Custom record updated | ✅ Native | RecordUpdate webhook |
| Custom record deleted | ✅ Native | RecordDelete webhook |
| Custom field created/deleted | ⚠️ API | Periodic sync |
| Field type changed | ⚠️ API | Periodic sync |
| Field options updated | ⚠️ API | Periodic sync |
| Field validation changed | ⚠️ API | Periodic sync |

## Marketing & Campaigns

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Campaign status changed | ✅ Native | CampaignStatusUpdate webhook |
| Email stats (opens/clicks) | ✅ Native | LCEmailStats webhook |
| Campaign created/edited | ⚠️ API | Periodic sync |
| Email template changes | ⚠️ API | Periodic sync or manual |
| SMS template changes | ⚠️ API | Periodic sync or manual |

## Tags & Segments

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Tag assigned to contact | ✅ Native | ContactTagUpdate webhook |
| Tag created/deleted | ⚠️ API | Periodic sync |
| Tag groups created | ⚠️ API | Periodic sync |
| Smart lists created/edited | ⚠️ API | Periodic sync |
| Segments defined | ⚠️ API | Periodic sync |

## Workflows & Automation

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| Workflow triggered | ⚠️ Automation | Can send webhook as action |
| Workflow created/edited | ⚠️ API | No sync available |
| Trigger conditions changed | ⚠️ API | No sync available |
| Actions modified | ⚠️ API | No sync available |

## Files & Media

| Field/Event | Status | Integration Method |
|------------|--------|-------------------|
| File uploaded to contact | ⚠️ API | Periodic sync |
| Media library changes | ⚠️ API | Periodic sync |
| Document templates | ⚠️ API | Periodic sync |

## Summary

### ✅ Native Integration (42 events)
All contact, opportunity, appointment, message, and commerce events are handled automatically by native webhooks.

### ⚠️ Automation Opportunities (18 events)
- Time-based triggers (birthdays, X days after event)
- Complex conditions (score thresholds, multiple criteria)
- Communication analytics (opens, clicks, call duration)
- Form/survey specific events

### ⚠️ API Sync Required (35+ configurations)
- All structural changes (pipelines, custom fields, templates)
- Settings and configurations
- User permissions and roles
- Analytics and reporting data

### 💡 Smart Solutions Like Yours
- **Calendar Sync on Open**: Trigger sync when user opens calendar screen
- **Pipeline Sync on Project View**: Trigger sync when user views projects
- **Custom Field Sync on Contact Edit**: Trigger sync when editing contacts

This approach minimizes unnecessary API calls while keeping data fresh when users need it!