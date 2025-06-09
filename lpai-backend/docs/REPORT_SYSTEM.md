# LPai Report System Documentation
**Date: June 9, 2025**

## Overview
The LPai Report System generates and sends automated performance reports via email using enhanced report generators that provide comprehensive analytics and insights.

## Architecture

### Active Components

#### Report Generators
- **EnhancedDailyReportGenerator** (`/src/utils/reports/enhancedDailyReport.ts`) - 1141 lines
  - Generates comprehensive daily analytics reports
  - Calculates system health scores
  - Provides actionable insights and recommendations
  
- **EnhancedWeeklyReportGenerator** (`/src/utils/reports/enhancedWeeklyReport.ts`) - 943 lines
  - Week-over-week comparisons
  - Financial impact analysis
  - Location growth tracking
  - Performance trends

#### Email Service
- **EmailService** (`/src/utils/email/emailService.ts`)
  - Wrapper for Resend API
  - Sends HTML reports to configured recipients
  - Uses `RESEND_API_KEY` environment variable

#### Analytics Engine  
- **WebhookAnalytics** (`/src/utils/analytics/webhookAnalytics.ts`)
  - Records webhook processing metrics
  - Tracks SLA compliance
  - Calculates performance statistics
  - **NOTE**: Now fully integrated with webhook processors

### Cron Jobs

#### Daily Report (`/pages/api/cron/daily-report.ts`)
- **Schedule**: Daily at 9 AM UTC (defined in vercel.json)
- **Process**:
  1. Creates EnhancedDailyReportGenerator instance
  2. Calls generateDailyReport()
  3. Sends to info@leadprospecting.ai

#### Weekly Report (`/pages/api/cron/weekly-report.ts`)
- **Schedule**: Mondays at 9 AM UTC (defined in vercel.json)
- **Process**:
  1. Creates EnhancedWeeklyReportGenerator instance
  2. Calls generateWeeklyReport()
  3. Sends to info@leadprospecting.ai

### Deprecated Files (Safe to Delete)
- `/src/utils/reports/dailyReport.ts` - Replaced by enhanced version
- `/src/utils/reports/weeklyReport.ts` - Replaced by enhanced version

## Data Sources

### Daily Report Metrics
```javascript
// From enhancedDailyReport.ts
- webhook_queue: Processing statistics
- webhook_metrics: Performance timing data
- locations: Installation and health metrics
- processor_logs: Cron execution history
Weekly Report Metrics
javascript// From enhancedWeeklyReport.ts
- Week-over-week webhook volume
- Success rate trends
- Location growth (installs/uninstalls)
- Installation performance
- Financial impact estimates
Report Features
Daily Report Includes:

Executive Summary

Total webhooks processed
Success rate with color coding
Active locations count
System health score (0-100)


Queue Performance

Performance by queue type
Average processing times
SLA compliance rates
Queue-specific health indicators


Hourly Activity Chart

24-hour webhook volume visualization
Peak activity identification


Error Analysis

Top error types with occurrence counts
Affected webhook types
Average retry attempts


Installation Analytics

New installations with timing
Setup completion status
Data sync volumes


Recommendations

System-generated action items
Based on performance thresholds
Prioritized by impact



Weekly Report Includes:

Week-over-Week Comparison

Volume changes
Success rate trends
Performance improvements/degradations


Location Analytics

Total active locations
New installations vs uninstalls
Setup completion rates
Most active locations


Financial Impact

Estimated costs based on volume
Per-webhook cost calculations
Cost trend analysis


Performance Champions

Best performing queues
Fastest processing types



Email Templates
HTML Structure
Both reports use rich HTML with:

Inline CSS for email client compatibility
Responsive design
Chart.js visualizations (for web view)
Color-coded metrics (green/yellow/red)
Animated elements (shimmer effects)

Styling
css- Primary color: #667eea → #764ba2 (gradient)
- Success: #22c55e
- Warning: #f59e0b  
- Error: #ef4444
- Font: System font stack
Configuration
Email Recipients
Currently hardcoded to: info@leadprospecting.ai
To change recipients, modify:
javascript// In both report generators
const recipients = ['info@leadprospecting.ai'];
Report Timing
Configured in /vercel.json:
json{
  "crons": [
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 9 * * *"  // 9 AM UTC daily
    },
    {
      "path": "/api/cron/weekly-report", 
      "schedule": "0 9 * * 1"  // 9 AM UTC Mondays
    }
  ]
}
Monitoring
Check Report Generation
javascript// MongoDB query to see recent reports
db.reports.find({ type: { $in: ['daily', 'weekly'] } })
  .sort({ generatedAt: -1 })
  .limit(10)
Verify Email Delivery

Check Resend dashboard for delivery status
Monitor email inbox for reports

Troubleshooting
Reports Not Sending

Check cron job execution in Vercel logs
Verify RESEND_API_KEY is set
Check MongoDB connection
Review error logs in processor_logs collection

Missing Data in Reports

Verify webhook_metrics collection has data
Check if analytics integration is working
Ensure processors are running successfully

Performance Issues

Check report generation time in logs
Consider optimizing aggregation queries
Monitor MongoDB performance

Future Improvements

Configurable recipients via database
Custom report schedules per location
PDF export option
Interactive web dashboard
Real-time alerts for critical issues