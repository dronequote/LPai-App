# LPai Analytics System Documentation
**Date: June 9, 2025**

## Overview
The LPai Analytics System tracks webhook processing performance, generates insights, and provides real-time monitoring through dashboards and metrics collection.

## Architecture

### Core Components

#### WebhookAnalytics (`/src/utils/analytics/webhookAnalytics.ts`)
Records and analyzes webhook performance:
- `recordWebhookReceived()` - Called when webhook arrives
- `recordProcessingStarted()` - Called when processing begins
- `recordProcessingCompleted()` - Called on success/failure
- `getAnalytics()` - Aggregates metrics for reporting

#### Integration Points
1. **Router** - Records webhook arrival
2. **BaseProcessor** - Records processing start/completion
3. **Report Generators** - Reads analytics data

### Database Schema

#### webhook_metrics Collection
```javascript
{
  _id: ObjectId,
  webhookId: string,
  type: string,              // Webhook type (ContactCreate, etc.)
  queueType: string,         // Queue (critical, messages, etc.)
  locationId: string,
  
  // Timestamps
  receivedAt: Date,          // When webhook arrived
  queuedAt: Date,           // When added to queue
  processingStartedAt: Date, // When processing began
  processingCompletedAt: Date,// When finished
  
  // Durations (milliseconds)
  routingDuration: number,   // Time to route
  queueWaitDuration: number, // Time in queue
  processingDuration: number,// Processing time
  totalDuration: number,     // End-to-end time
  
  // Status
  status: 'success' | 'failed' | 'timeout',
  error: string,            // Error message if failed
  attempts: number,         // Retry attempts
  
  // Performance
  exceedsSLA: boolean,      // Over SLA target
  slaTarget: number,        // Target time (ms)
  
  createdAt: Date
}
SLA Targets
Defined by queue type:

critical: 5 seconds
messages: 2 seconds
appointments: 30 seconds
contacts: 60 seconds
projects: 60 seconds
financial: 30 seconds
general: 2 minutes

Analytics Dashboards
Dashboard API (/pages/api/analytics/dashboard.ts)
Provides aggregated metrics:

Queue statistics
Performance metrics by type
Error analysis
System health scores
Time-based filtering (hour/day/week/month)

Dashboard UI (/pages/api/analytics/dashboard-ui.ts)
Interactive HTML dashboard with:

Real-time metrics updates
Chart.js visualizations
Queue health monitoring
Performance trends
Location selector

Installation Analytics (/pages/api/analytics/installs/[locationId].ts)
Location-specific installation metrics:

Setup step timing
Performance grades
Bottleneck identification
Comparison to system averages
Actionable recommendations

Installation UI (/pages/api/analytics/installs/[locationId]/ui.ts)
Visual installation analytics with:

Step-by-step breakdown
Performance graphs
Success indicators
Interactive timeline

Metrics Aggregation
Daily Metrics
javascript// Aggregated in reports
- Total webhooks by queue
- Average processing times
- Success/failure rates
- SLA compliance
- Peak hours
- Error patterns
Performance Grades

A+: < 50% of SLA target
A: < 75% of SLA target
B: < 100% of SLA target
C: < 150% of SLA target
D: < 200% of SLA target
F: > 200% of SLA target

Usage in Reports
Daily Report Integration

Reads webhook_metrics for performance data
Calculates health scores
Identifies bottlenecks
Generates recommendations

Weekly Report Integration

Week-over-week comparisons
Trend analysis
Performance improvements/degradations
Capacity planning insights

Monitoring Queries
Real-time Performance
javascript// Recent webhook performance
db.webhook_metrics.find()
  .sort({ receivedAt: -1 })
  .limit(100)

// Slow webhooks
db.webhook_metrics.find({
  totalDuration: { $gt: 5000 }
}).sort({ totalDuration: -1 })

// Failed webhooks
db.webhook_metrics.find({
  status: 'failed'
}).sort({ receivedAt: -1 })
Queue Health
javascript// Queue performance by type
db.webhook_metrics.aggregate([
  { $match: { 
    receivedAt: { $gte: new Date(Date.now() - 3600000) }
  }},
  { $group: {
    _id: '$queueType',
    avgDuration: { $avg: '$totalDuration' },
    successRate: {
      $avg: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
    }
  }}
])
Performance Impact
Analytics adds minimal overhead:

3 database writes per webhook
Non-blocking operations
Indexed collections for fast queries
Automatic cleanup of old metrics

Best Practices

Monitor SLA Compliance

Review daily reports
Investigate queues below 95%
Adjust batch sizes if needed


Track Error Patterns

Group errors by type
Identify systematic issues
Implement fixes for common errors


Capacity Planning

Monitor queue depths
Track processing rates
Plan scaling based on trends



Future Enhancements

Real-time alerting
Custom SLA targets per location
Predictive analytics
Cost optimization recommendations
API performance endpoints