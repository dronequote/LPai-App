// /src/utils/reports/enhancedDailyReport.ts
import { Db } from 'mongodb';
import { EmailService } from '../email/emailService';

export class EnhancedDailyReportGenerator {
  private db: Db;
  private emailService: EmailService;
  
  constructor(db: Db) {
    this.db = db;
    this.emailService = new EmailService();
  }
  
  /**
   * Generate and send enhanced daily report with rich analytics
   */
  async generateDailyReport(): Promise<void> {
    const now = new Date();
    const startDate = new Date(now.setHours(0, 0, 0, 0));
    const endDate = new Date();
    
    console.log(`[Enhanced Daily Report] Generating report for ${startDate.toISOString()}`);
    
    try {
      // 1. Get comprehensive metrics using aggregation pipelines
      const metrics = await this.getComprehensiveMetrics(startDate, endDate);
      
      // 2. Get queue performance data
      const queuePerformance = await this.getQueuePerformance(startDate, endDate);
      
      // 3. Get location activity
      const locationActivity = await this.getLocationActivity(startDate, endDate);
      
      // 4. Get error analysis
      const errorAnalysis = await this.getErrorAnalysis(startDate, endDate);
      
      // 5. Get system health
      const systemHealth = await this.calculateSystemHealth(metrics, queuePerformance);
      
      // 6. Get install analytics
      const installAnalytics = await this.getInstallAnalytics(startDate, endDate);
      
      // Generate HTML report
      const htmlReport = this.generateHTMLReport({
        date: new Date(),
        period: { start: startDate, end: endDate },
        metrics,
        queuePerformance,
        locationActivity,
        errorAnalysis,
        systemHealth,
        installAnalytics
      });
      
      // Send email
      await this.emailService.sendReport({
        to: ['info@leadprospecting.ai'],
        subject: `LPai Daily Report - ${new Date().toLocaleDateString()} 📊`,
        html: htmlReport
      });
      
      // Store report in database
      await this.db.collection('reports').insertOne({
        type: 'daily',
        generatedAt: new Date(),
        period: { start: startDate, end: endDate },
        data: {
          metrics,
          queuePerformance,
          locationActivity,
          errorAnalysis,
          systemHealth,
          installAnalytics
        },
        sentTo: ['info@leadprospecting.ai']
      });
      
      console.log('[Enhanced Daily Report] Report sent successfully');
      
    } catch (error) {
      console.error('[Enhanced Daily Report] Error:', error);
      throw error;
    }
  }
  
  /**
   * Get comprehensive metrics using aggregation
   */
  private async getComprehensiveMetrics(startDate: Date, endDate: Date) {
    const result = await this.db.collection('webhook_queue').aggregate([
      {
        $facet: {
          // Today's summary
          todaySummary: [
            {
              $match: {
                queuedAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
                avgProcessingTime: {
                  $avg: {
                    $cond: [
                      { $and: ['$processingStarted', '$processingCompleted'] },
                      { $subtract: ['$processingCompleted', '$processingStarted'] },
                      null
                    ]
                  }
                },
                minProcessingTime: {
                  $min: {
                    $cond: [
                      { $and: ['$processingStarted', '$processingCompleted'] },
                      { $subtract: ['$processingCompleted', '$processingStarted'] },
                      null
                    ]
                  }
                },
                maxProcessingTime: {
                  $max: {
                    $cond: [
                      { $and: ['$processingStarted', '$processingCompleted'] },
                      { $subtract: ['$processingCompleted', '$processingStarted'] },
                      null
                    ]
                  }
                }
              }
            }
          ],
          // Hourly breakdown
          hourlyBreakdown: [
            {
              $match: {
                queuedAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: { $hour: '$queuedAt' },
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                avgTime: {
                  $avg: {
                    $cond: [
                      { $and: ['$processingStarted', '$processingCompleted'] },
                      { $subtract: ['$processingCompleted', '$processingStarted'] },
                      null
                    ]
                  }
                }
              }
            },
            { $sort: { _id: 1 } }
          ],
          // Type distribution
          typeDistribution: [
            {
              $match: {
                queuedAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]).toArray();
    
    return result[0];
  }
  
  /**
   * Get queue performance metrics
   */
  private async getQueuePerformance(startDate: Date, endDate: Date) {
    const queueTypes = ['critical', 'messages', 'appointments', 'contacts', 'projects', 'financial', 'general'];
    
    const performance = await this.db.collection('webhook_queue').aggregate([
      {
        $match: {
          queuedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$queueType',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $and: ['$processingStarted', '$processingCompleted'] },
                { $subtract: ['$processingCompleted', '$processingStarted'] },
                null
              ]
            }
          },
          avgWaitTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                { $subtract: [new Date(), '$queuedAt'] },
                null
              ]
            }
          },
          oldestPending: { $min: { $cond: [{ $eq: ['$status', 'pending'] }, '$queuedAt', null] } }
        }
      }
    ]).toArray();
    
    // Add SLA compliance
    const slaTargets = {
      critical: 5000,
      messages: 2000,
      appointments: 30000,
      contacts: 60000,
      projects: 60000,
      financial: 30000,
      general: 120000
    };
    
    return performance.map(queue => ({
      ...queue,
      successRate: queue.total > 0 ? Math.round((queue.completed / queue.total) * 100) : 100,
      slaCompliance: queue.avgProcessingTime ? 
        Math.min(100, Math.round((slaTargets[queue._id] / queue.avgProcessingTime) * 100)) : 100,
      health: queue.failed > queue.total * 0.1 ? 'critical' :
              queue.failed > queue.total * 0.05 ? 'warning' :
              queue.pending > 100 ? 'warning' : 'healthy'
    }));
  }
  
  /**
   * Get location activity metrics
   */
  private async getLocationActivity(startDate: Date, endDate: Date) {
    const activity = await this.db.collection('locations').aggregate([
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalActive: {
                  $sum: { $cond: ['$appInstalled', 1, 0] }
                },
                withOAuth: {
                  $sum: { $cond: ['$ghlOAuth.accessToken', 1, 0] }
                },
                setupCompleted: {
                  $sum: { $cond: ['$setupCompleted', 1, 0] }
                },
                installedToday: {
                  $sum: {
                    $cond: [
                      { $gte: ['$installedAt', startDate] },
                      1,
                      0
                    ]
                  }
                },
                uninstalledToday: {
                  $sum: {
                    $cond: [
                      { $gte: ['$uninstalledAt', startDate] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          recentInstalls: [
            {
              $match: {
                installedAt: { $gte: startDate }
              }
            },
            {
              $project: {
                locationId: 1,
                name: 1,
                installedAt: 1,
                setupCompleted: 1,
                setupDuration: '$setupResults.duration'
              }
            },
            { $sort: { installedAt: -1 } },
            { $limit: 5 }
          ],
          needsAttention: [
            {
              $match: {
                $or: [
                  { 'ghlOAuth.needsReauth': true },
                  { setupError: { $exists: true } },
                  {
                    $and: [
                      { appInstalled: true },
                      { setupCompleted: { $ne: true } },
                      { installedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                    ]
                  }
                ]
              }
            },
            {
              $project: {
                locationId: 1,
                name: 1,
                issue: {
                  $cond: [
                    { $eq: ['$ghlOAuth.needsReauth', true] },
                    'OAuth needs refresh',
                    {
                      $cond: [
                        { $ne: ['$setupError', null] },  // <-- FIXED: Check if not null
                        'Setup error',
                        'Incomplete setup'
                      ]
                    }
                  ]
                }
              }
            },
            { $limit: 10 }
          ]
        }
      }
    ]).toArray();
    
    return activity[0];
  }
  
  /**
   * Get error analysis
   */
  private async getErrorAnalysis(startDate: Date, endDate: Date) {
    const errors = await this.db.collection('webhook_queue').aggregate([
      {
        $match: {
          status: 'failed',
          processingCompleted: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            error: {
              $switch: {
                branches: [
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /timeout/i } }, then: 'Timeout Error' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /network/i } }, then: 'Network Error' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /auth/i } }, then: 'Authentication Error' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /validation/i } }, then: 'Validation Error' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /rate limit/i } }, then: 'Rate Limit Error' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /not found/i } }, then: 'Not Found Error' }
                ],
                default: 'Processing Error'
              }
            }
          },
          count: { $sum: 1 },
          queues: { $addToSet: '$queueType' },
          lastOccurrence: { $max: '$processingCompleted' },
          avgRetries: { $avg: '$attempts' },
          sampleError: { $first: '$lastError' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    return errors;
  }
  
  /**
   * Calculate system health score
   */
  private async calculateSystemHealth(metrics: any, queuePerformance: any[]) {
    const summary = metrics.todaySummary[0] || {};
    const successRate = summary.total > 0 ? (summary.completed / summary.total) * 100 : 100;
    
    // Count current issues
    const pendingCount = await this.db.collection('webhook_queue').countDocuments({ status: 'pending' });
    const stuckWebhooks = await this.db.collection('webhook_queue').countDocuments({
      status: 'pending',
      queuedAt: { $lte: new Date(Date.now() - 30 * 60 * 1000) } // Stuck for 30+ minutes
    });
    
    let healthScore = 100;
    const issues = [];
    const recommendations = [];
    
    // Success rate impact
    if (successRate < 99) {
      healthScore -= 10;
      issues.push(`Success rate at ${successRate.toFixed(1)}% (target: 99%)`);
    }
    if (successRate < 95) {
      healthScore -= 15;
      recommendations.push('🚨 Investigate failing webhooks immediately');
    }
    
    // Backlog impact
    if (pendingCount > 100) {
      healthScore -= 10;
      issues.push(`${pendingCount} webhooks in backlog`);
    }
    if (pendingCount > 500) {
      healthScore -= 15;
      recommendations.push('⚡ Scale up processing capacity');
    }
    
    // Stuck webhooks
    if (stuckWebhooks > 0) {
      healthScore -= 20;
      issues.push(`${stuckWebhooks} webhooks stuck for 30+ minutes`);
      recommendations.push('🔧 Clear stuck webhooks and check for processing errors');
    }
    
    // Queue-specific issues
    const criticalQueues = queuePerformance.filter(q => q.health === 'critical');
    if (criticalQueues.length > 0) {
      healthScore -= 10 * criticalQueues.length;
      criticalQueues.forEach(q => {
        issues.push(`${q._id} queue performance degraded`);
      });
    }
    
    // Processing time
    if (summary.avgProcessingTime > 5000) {
      healthScore -= 10;
      issues.push(`Average processing time high: ${(summary.avgProcessingTime / 1000).toFixed(1)}s`);
      recommendations.push('🚀 Optimize slow operations');
    }
    
    return {
      score: Math.max(0, healthScore),
      status: healthScore >= 85 ? 'healthy' : healthScore >= 70 ? 'degraded' : 'critical',
      issues,
      recommendations,
      metrics: {
        successRate: successRate.toFixed(1),
        pendingCount,
        stuckWebhooks,
        avgProcessingTime: summary.avgProcessingTime
      }
    };
  }
  
  /**
   * Get install analytics for the day
   */
  private async getInstallAnalytics(startDate: Date, endDate: Date) {
    const installs = await this.db.collection('webhook_metrics').aggregate([
      {
        $match: {
          type: 'INSTALL',
          'timestamps.routerReceived': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: { $sum: { $cond: ['$success', 1, 0] } },
          avgDuration: { $avg: '$metrics.totalEndToEnd' },
          minDuration: { $min: '$metrics.totalEndToEnd' },
          maxDuration: { $max: '$metrics.totalEndToEnd' }
        }
      }
    ]).toArray();
    
    // Get detailed install performance
    const installDetails = await this.db.collection('locations').aggregate([
      {
        $match: {
          installedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          locationId: 1,
          name: 1,
          installedAt: 1,
          setupCompleted: 1,
          duration: '$setupResults.duration',
          stepCount: { $size: { $objectToArray: { $ifNull: ['$setupResults.steps', {}] } } },
          contactCount: '$setupResults.steps.contacts.processed',
          customFieldCount: '$setupResults.steps.customFields.totalFields'
        }
      },
      { $sort: { installedAt: -1 } }
    ]).toArray();
    
    return {
      summary: installs[0] || { total: 0, successful: 0 },
      details: installDetails
    };
  }
  
  /**
   * Generate the HTML report
   */
  private generateHTMLReport(data: any): string {
    const {
      date,
      period,
      metrics,
      queuePerformance,
      locationActivity,
      errorAnalysis,
      systemHealth,
      installAnalytics
    } = data;
    
    const summary = metrics.todaySummary[0] || {};
    const successRate = summary.total > 0 ? (summary.completed / summary.total) * 100 : 100;
    
    // Find peak hour
    const peakHour = metrics.hourlyBreakdown.reduce((max, hour) => 
      hour.count > (max?.count || 0) ? hour : max, 
      { _id: 0, count: 0 }
    );
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LPai Daily Report - ${date.toLocaleDateString()}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f7;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 30px rgba(0,0,0,0.1);
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .header .subtitle {
      font-size: 1.1em;
      opacity: 0.9;
    }
    
    .content {
      padding: 30px;
    }
    
    /* Health Status Banner */
    .health-banner {
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
      font-weight: 600;
      font-size: 1.2em;
    }
    
    .health-banner.healthy {
      background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
      color: #0a5f0a;
    }
    
    .health-banner.degraded {
      background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
      color: #8b5a00;
    }
    
    .health-banner.critical {
      background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
      color: white;
    }
    
    .health-score {
      font-size: 3em;
      font-weight: 800;
      margin: 10px 0;
    }
    
    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .summary-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .summary-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }
    
    .summary-card .value {
      font-size: 2.5em;
      font-weight: 700;
      margin: 10px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .summary-card .label {
      font-size: 0.9em;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .summary-card .change {
      font-size: 0.85em;
      margin-top: 5px;
    }
    
    .change.positive { color: #22c55e; }
    .change.negative { color: #ef4444; }
    .change.neutral { color: #6b7280; }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    th {
      background: #f8f9fa;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #444;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tr:hover {
      background: #f9fafb;
    }
    
    /* Status badges */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
    }
    
    .badge.success { background: #d1fae5; color: #065f46; }
    .badge.warning { background: #fef3c7; color: #92400e; }
    .badge.error { background: #fee2e2; color: #991b1b; }
    .badge.info { background: #dbeafe; color: #1e40af; }
    
    /* Sections */
    .section {
      margin-bottom: 40px;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .section-header h2 {
      font-size: 1.8em;
      color: #1a1a1a;
      flex-grow: 1;
    }
    
    .section-header .icon {
      font-size: 2em;
      margin-right: 15px;
    }
    
    /* Alert boxes */
    .alert {
      padding: 15px 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid;
    }
    
    .alert.info {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }
    
    .alert.warning {
      background: #fffbeb;
      border-color: #f59e0b;
      color: #92400e;
    }
    
    .alert.error {
      background: #fef2f2;
      border-color: #ef4444;
      color: #991b1b;
    }
    
    .alert.success {
      background: #f0fdf4;
      border-color: #22c55e;
      color: #166534;
    }
    
    /* Charts */
    .chart-container {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .mini-chart {
      display: flex;
      align-items: flex-end;
      height: 60px;
      gap: 2px;
      margin-top: 10px;
    }
    
    .mini-chart .bar {
      flex: 1;
      background: linear-gradient(to top, #667eea, #764ba2);
      border-radius: 2px 2px 0 0;
      min-height: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    
    .mini-chart .bar:hover {
      opacity: 1;
    }
    
    /* Progress bars */
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    }
    
    .progress-bar .fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    /* Queue status grid */
    .queue-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    
    .queue-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    
    .queue-card.healthy { border-top: 3px solid #22c55e; }
    .queue-card.warning { border-top: 3px solid #f59e0b; }
    .queue-card.critical { border-top: 3px solid #ef4444; }
    
    .queue-card h3 {
      font-size: 1.2em;
      margin-bottom: 15px;
      text-transform: capitalize;
    }
    
    .queue-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 15px;
    }
    
    .queue-stat {
      text-align: center;
    }
    
    .queue-stat .value {
      font-size: 1.5em;
      font-weight: 700;
      color: #667eea;
    }
    
    .queue-stat .label {
      font-size: 0.8em;
      color: #666;
      text-transform: uppercase;
    }
    
    /* Footer */
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    
    /* Responsive */
    @media (max-width: 600px) {
      .header h1 {
        font-size: 2em;
      }
      
      .summary-grid {
        grid-template-columns: 1fr;
      }
      
      .content {
        padding: 20px;
      }
      
      table {
        font-size: 0.9em;
      }
      
      th, td {
        padding: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 Daily Performance Report</h1>
      <div class="subtitle">${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
    
    <div class="content">
      <!-- Health Status -->
      <div class="health-banner ${systemHealth.status}">
        <div>System Health Status: ${systemHealth.status.toUpperCase()}</div>
        <div class="health-score">${systemHealth.score}/100</div>
        ${systemHealth.issues.length > 0 ? 
          `<div style="font-size: 0.9em; margin-top: 10px;">
            ${systemHealth.issues.slice(0, 3).join(' • ')}
          </div>` : 
          '<div style="font-size: 0.9em; margin-top: 10px;">All systems operating normally</div>'
        }
      </div>
      
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Total Webhooks</div>
          <div class="value">${(summary.total || 0).toLocaleString()}</div>
          <div class="change neutral">
            Peak: ${peakHour._id}:00 (${peakHour.count} webhooks)
          </div>
        </div>
        
        <div class="summary-card">
          <div class="label">Success Rate</div>
          <div class="value">${successRate.toFixed(1)}%</div>
          <div class="change ${successRate >= 99 ? 'positive' : successRate >= 95 ? 'neutral' : 'negative'}">
            ${summary.completed || 0} completed, ${summary.failed || 0} failed
          </div>
        </div>
        
        <div class="summary-card">
          <div class="label">Avg Processing</div>
          <div class="value">${this.formatDuration(summary.avgProcessingTime || 0)}</div>
          <div class="change neutral">
            Min: ${this.formatDuration(summary.minProcessingTime || 0)} / Max: ${this.formatDuration(summary.maxProcessingTime || 0)}
          </div>
        </div>
        
        <div class="summary-card">
          <div class="label">Active Locations</div>
          <div class="value">${locationActivity.summary[0]?.totalActive || 0}</div>
          <div class="change ${(locationActivity.summary[0]?.installedToday || 0) > (locationActivity.summary[0]?.uninstalledToday || 0) ? 'positive' : 'negative'}">
            +${locationActivity.summary[0]?.installedToday || 0} / -${locationActivity.summary[0]?.uninstalledToday || 0} today
          </div>
        </div>
      </div>
      
      ${systemHealth.recommendations.length > 0 ? `
      <!-- Recommendations -->
      <div class="section">
        <div class="alert warning">
          <strong>🎯 Action Items:</strong>
          <ul style="margin-top: 10px; margin-left: 20px;">
            ${systemHealth.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
      ` : ''}
      
      <!-- Queue Performance -->
      <div class="section">
        <div class="section-header">
          <span class="icon">⚡</span>
          <h2>Queue Performance</h2>
        </div>
        
        <div class="queue-grid">
          ${queuePerformance.map(queue => `
            <div class="queue-card ${queue.health}">
              <h3>${queue._id} Queue</h3>
              
              <div class="progress-bar">
                <div class="fill" style="width: ${queue.successRate}%"></div>
              </div>
              
              <div class="queue-stats">
                <div class="queue-stat">
                  <div class="value">${queue.total}</div>
                  <div class="label">Processed</div>
                </div>
                <div class="queue-stat">
                  <div class="value">${queue.successRate}%</div>
                  <div class="label">Success</div>
                </div>
                <div class="queue-stat">
                  <div class="value">${this.formatDuration(queue.avgProcessingTime || 0)}</div>
                  <div class="label">Avg Time</div>
                </div>
                <div class="queue-stat">
                  <div class="value">${queue.slaCompliance}%</div>
                  <div class="label">SLA Met</div>
                </div>
              </div>
              
              ${queue.pending > 0 ? 
                `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <strong>${queue.pending}</strong> pending
                  ${queue.oldestPending ? ` • Oldest: ${this.formatAge(queue.oldestPending)}` : ''}
                </div>` : ''
              }
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Hourly Activity Chart -->
      <div class="section">
        <div class="section-header">
          <span class="icon">📈</span>
          <h2>24-Hour Activity Pattern</h2>
        </div>
        
        <div class="chart-container">
          <div class="mini-chart">
            ${Array(24).fill(0).map((_, hour) => {
              const hourData = metrics.hourlyBreakdown.find(h => h._id === hour) || { count: 0 };
              const height = hourData.count > 0 ? 
                (hourData.count / Math.max(...metrics.hourlyBreakdown.map(h => h.count))) * 100 : 5;
              return `<div class="bar" style="height: ${height}%" title="${hour}:00 - ${hourData.count} webhooks"></div>`;
            }).join('')}
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.8em; color: #666;">
            <span>12AM</span>
            <span>6AM</span>
            <span>12PM</span>
            <span>6PM</span>
            <span>11PM</span>
          </div>
        </div>
      </div>
      
      <!-- Error Analysis -->
      ${errorAnalysis.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <span class="icon">⚠️</span>
          <h2>Error Analysis</h2>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Error Type</th>
              <th>Webhook Type</th>
              <th>Count</th>
              <th>Affected Queues</th>
              <th>Avg Retries</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            ${errorAnalysis.slice(0, 10).map(error => `
              <tr>
                <td><span class="badge error">${error._id.error}</span></td>
                <td>${error._id.type || 'Unknown'}</td>
                <td><strong>${error.count}</strong></td>
                <td>${error.queues.join(', ')}</td>
                <td>${error.avgRetries.toFixed(1)}</td>
                <td>${new Date(error.lastOccurrence).toLocaleTimeString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : `
      <div class="section">
        <div class="alert success">
          <strong>✨ No Errors Today!</strong> All webhooks processed successfully.
        </div>
      </div>
      `}
      
      <!-- Installation Analytics -->
      ${installAnalytics.details.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <span class="icon">🚀</span>
          <h2>Today's Installations</h2>
        </div>
        
        <div style="margin-bottom: 20px;">
          <strong>${installAnalytics.summary.total || 0}</strong> installations attempted • 
          <strong>${installAnalytics.summary.successful || 0}</strong> successful
          ${installAnalytics.summary.avgDuration ? 
            ` • Average time: <strong>${this.formatDuration(installAnalytics.summary.avgDuration)}</strong>` : ''
          }
        </div>
        
        ${installAnalytics.details.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Data Synced</th>
            </tr>
          </thead>
          <tbody>
            ${installAnalytics.details.map(install => `
              <tr>
                <td>
                  <strong>${install.name || 'Unknown'}</strong><br>
                  <small style="color: #666;">${install.locationId}</small>
                </td>
                <td>${new Date(install.installedAt).toLocaleTimeString()}</td>
                <td>${install.duration || 'N/A'}</td>
                <td>
                  <span class="badge ${install.setupCompleted ? 'success' : 'warning'}">
                    ${install.setupCompleted ? 'Complete' : 'In Progress'}
                  </span>
                </td>
                <td>
                  ${install.contactCount ? `${install.contactCount} contacts` : ''}
                  ${install.customFieldCount ? ` • ${install.customFieldCount} fields` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </div>
      ` : ''}
      
      <!-- Locations Needing Attention -->
      ${locationActivity.needsAttention.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <span class="icon">🔧</span>
          <h2>Locations Needing Attention</h2>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Issue</th>
              <th>Action Required</th>
            </tr>
          </thead>
          <tbody>
            ${locationActivity.needsAttention.map(location => `
              <tr>
                <td>
                  <strong>${location.name || 'Unknown'}</strong><br>
                  <small style="color: #666;">${location.locationId}</small>
                </td>
                <td><span class="badge warning">${location.issue}</span></td>
                <td>${this.getActionForIssue(location.issue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <!-- Webhook Type Distribution -->
      <div class="section">
        <div class="section-header">
          <span class="icon">📊</span>
          <h2>Webhook Distribution</h2>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Total</th>
              <th>Completed</th>
              <th>Failed</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.typeDistribution.slice(0, 10).map(type => {
              const successRate = type.count > 0 ? 
                ((type.completed / type.count) * 100).toFixed(1) : '100.0';
              return `
                <tr>
                  <td><strong>${type._id || 'Unknown'}</strong></td>
                  <td>${type.count}</td>
                  <td>${type.completed}</td>
                  <td>${type.failed}</td>
                  <td>
                    <span class="badge ${parseFloat(successRate) >= 99 ? 'success' : parseFloat(successRate) >= 95 ? 'warning' : 'error'}">
                      ${successRate}%
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p><strong>Report Period:</strong> ${period.start.toLocaleString()} - ${period.end.toLocaleString()}</p>
      <p style="margin-top: 10px;">
        For real-time monitoring and detailed analytics, visit the 
        <a href="https://lpai-backend-omega.vercel.app/api/analytics/dashboard-ui">LPai Dashboard</a>
      </p>
      <p style="margin-top: 20px; font-size: 0.9em;">
        Questions? Contact <a href="mailto:support@leadprospecting.ai">support@leadprospecting.ai</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }
  
  /**
   * Format duration helper
   */
  private formatDuration(ms: number): string {
    if (!ms || ms === 0) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
  
  /**
   * Format age helper
   */
  private formatAge(date: Date): string {
    const age = Date.now() - new Date(date).getTime();
    if (age < 60000) return 'Just now';
    if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
    if (age < 86400000) return `${Math.floor(age / 3600000)}h ago`;
    return `${Math.floor(age / 86400000)}d ago`;
  }
  
  /**
   * Get action for issue type
   */
  private getActionForIssue(issue: string): string {
    const actions: Record<string, string> = {
      'OAuth needs refresh': 'Re-authenticate in GoHighLevel',
      'Setup error': 'Check error logs and retry setup',
      'Incomplete setup': 'Complete location configuration'
    };
    
    return actions[issue] || 'Contact support';
  }
}