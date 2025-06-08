// /src/utils/reports/weeklyReport.ts
import { Db } from 'mongodb';
import { WebhookAnalytics } from '../analytics/webhookAnalytics';
import { EmailService } from '../email/emailService';

export class WeeklyReportGenerator {
  private db: Db;
  private analytics: WebhookAnalytics;
  private emailService: EmailService;
  
  constructor(db: Db) {
    this.db = db;
    this.analytics = new WebhookAnalytics(db);
    this.emailService = new EmailService();
  }
  
  /**
   * Generate and send weekly report
   */
  async generateWeeklyReport(): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    console.log(`[Weekly Report] Generating report for ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get analytics data
    const analyticsData = await this.analytics.getAnalytics(startDate, endDate);
    
    // Get weekly trends
    const weeklyTrends = await this.getWeeklyTrends();
    
    // Get location statistics
    const locationStats = await this.getLocationStatistics();
    
    // Get system performance
    const systemPerformance = await this.getSystemPerformance(startDate, endDate);
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(
      analyticsData, 
      weeklyTrends,
      locationStats,
      systemPerformance
    );
    
    // Get report recipients
    const recipients = await this.getReportRecipients();
    
    // Send email
    await this.emailService.sendReport({
      to: recipients,
      subject: `LPai Weekly Report - Week of ${startDate.toLocaleDateString()}`,
      html: htmlReport
    });
    
    // Store report in database
    await this.db.collection('reports').insertOne({
      type: 'weekly',
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      data: {
        analytics: analyticsData,
        trends: weeklyTrends,
        locations: locationStats,
        performance: systemPerformance
      },
      sentTo: recipients
    });
  }
  
  /**
   * Get weekly trends comparison
   */
  private async getWeeklyTrends(): Promise<any> {
    const thisWeek = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const [thisWeekData, lastWeekData] = await Promise.all([
      // This week
      this.db.collection('webhook_metrics').aggregate([
        {
          $match: {
            receivedAt: { $gte: lastWeek, $lte: thisWeek }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: { $sum: { $cond: ['$status', 1, 0] } },
            avgDuration: { $avg: '$totalDuration' }
          }
        }
      ]).toArray(),
      
      // Last week
      this.db.collection('webhook_metrics').aggregate([
        {
          $match: {
            receivedAt: { $gte: twoWeeksAgo, $lte: lastWeek }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: { $sum: { $cond: ['$status', 1, 0] } },
            avgDuration: { $avg: '$totalDuration' }
          }
        }
      ]).toArray()
    ]);
    
    const current = thisWeekData[0] || { total: 0, successful: 0, avgDuration: 0 };
    const previous = lastWeekData[0] || { total: 0, successful: 0, avgDuration: 0 };
    
    return {
      volume: {
        current: current.total,
        previous: previous.total,
        change: previous.total > 0 ? 
          ((current.total - previous.total) / previous.total * 100).toFixed(1) : 0
      },
      successRate: {
        current: current.total > 0 ? (current.successful / current.total * 100).toFixed(1) : 0,
        previous: previous.total > 0 ? (previous.successful / previous.total * 100).toFixed(1) : 0
      },
      performance: {
        current: current.avgDuration,
        previous: previous.avgDuration,
        change: previous.avgDuration > 0 ? 
          ((current.avgDuration - previous.avgDuration) / previous.avgDuration * 100).toFixed(1) : 0
      }
    };
  }
  
  /**
   * Get location statistics
   */
  private async getLocationStatistics(): Promise<any> {
    const activeLocations = await this.db.collection('locations')
      .aggregate([
        {
          $match: {
            appInstalled: true
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withOAuth: { $sum: { $cond: ['$ghlOAuth.accessToken', 1, 0] } },
            setupCompleted: { $sum: { $cond: ['$setupCompleted', 1, 0] } },
            recentlyActive: {
              $sum: {
                $cond: [
                  { $gte: ['$lastActivity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray();
    
    const stats = activeLocations[0] || {
      total: 0,
      withOAuth: 0,
      setupCompleted: 0,
      recentlyActive: 0
    };
    
    // Get new installs this week
    const newInstalls = await this.db.collection('locations')
      .countDocuments({
        installedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
    
    // Get uninstalls this week
    const uninstalls = await this.db.collection('locations')
      .countDocuments({
        uninstalledAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
    
    return {
      ...stats,
      newInstalls,
      uninstalls,
      netGrowth: newInstalls - uninstalls
    };
  }
  
  /**
   * Get system performance metrics
   */
  private async getSystemPerformance(startDate: Date, endDate: Date): Promise<any> {
    // Get queue performance by type
    const queuePerformance = await this.db.collection('webhook_queue')
      .aggregate([
        {
          $match: {
            processingCompleted: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$queueType',
            processed: { $sum: 1 },
            avgProcessingTime: {
              $avg: {
                $subtract: ['$processingCompleted', '$processingStarted']
              }
            },
            failures: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { processed: -1 }
        }
      ]).toArray();
    
    // Get hourly distribution
    const hourlyDistribution = await this.db.collection('webhook_queue')
      .aggregate([
        {
          $match: {
            queuedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $hour: '$queuedAt' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]).toArray();
    
    // Get peak load times
    const peakHour = hourlyDistribution.reduce((max, hour) => 
      hour.count > (max?.count || 0) ? hour : max, 
      { _id: 0, count: 0 }
    );
    
    return {
      queuePerformance,
      hourlyDistribution,
      peakHour: {
        hour: peakHour._id,
        volume: peakHour.count
      }
    };
  }
  
  /**
   * Generate HTML report
   */
  private generateHTMLReport(
    analytics: any, 
    trends: any,
    locations: any,
    performance: any
  ): string {
    const { byQueue, topErrors, slowestWebhooks } = analytics;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LPai Weekly Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1 {
      color: #2E86AB;
      border-bottom: 3px solid #2E86AB;
      padding-bottom: 15px;
      font-size: 2.5em;
    }
    h2 {
      color: #444;
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 25px;
      margin: 30px 0;
    }
    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .summary-value {
      font-size: 3em;
      font-weight: bold;
      margin: 10px 0;
    }
    .summary-label {
      font-size: 0.9em;
      opacity: 0.9;
    }
    .trend {
      font-size: 1.2em;
      margin-top: 10px;
    }
    .trend.up { color: #10B981; }
    .trend.down { color: #EF4444; }
    .trend.neutral { color: #6B7280; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #2E86AB;
    }
    .chart-container {
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .success { color: #27AE60; }
    .warning { color: #F39C12; }
    .error { color: #E74C3C; }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      color: #666;
      font-size: 0.9em;
    }
    .highlight-box {
      background: #E3F2FD;
      border-left: 4px solid #2196F3;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Weekly Performance Report</h1>
    <p style="color: #666; font-size: 1.1em;">
      Week of ${analytics.period.start.toLocaleDateString()} - ${analytics.period.end.toLocaleDateString()}
    </p>
    
    <!-- Executive Summary -->
    <div class="summary-grid">
      <div class="summary-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="summary-label">Total Webhooks</div>
        <div class="summary-value">${trends.volume.current.toLocaleString()}</div>
        <div class="trend ${trends.volume.change > 0 ? 'up' : trends.volume.change < 0 ? 'down' : 'neutral'}">
          ${trends.volume.change > 0 ? '↑' : trends.volume.change < 0 ? '↓' : '→'} ${Math.abs(trends.volume.change)}% vs last week
        </div>
      </div>
      
      <div class="summary-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
        <div class="summary-label">Success Rate</div>
        <div class="summary-value">${trends.successRate.current}%</div>
        <div class="trend ${trends.successRate.current > trends.successRate.previous ? 'up' : 'down'}">
          ${trends.successRate.current > trends.successRate.previous ? '↑' : '↓'} 
          ${Math.abs(trends.successRate.current - trends.successRate.previous).toFixed(1)}% change
        </div>
      </div>
      
      <div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <div class="summary-label">Active Locations</div>
        <div class="summary-value">${locations.total}</div>
        <div class="trend ${locations.netGrowth > 0 ? 'up' : locations.netGrowth < 0 ? 'down' : 'neutral'}">
          ${locations.netGrowth > 0 ? '+' : ''}${locations.netGrowth} this week
        </div>
      </div>
      
      <div class="summary-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <div class="summary-label">Avg Response Time</div>
        <div class="summary-value">${this.formatDuration(trends.performance.current)}</div>
        <div class="trend ${trends.performance.change < 0 ? 'up' : trends.performance.change > 0 ? 'down' : 'neutral'}">
          ${trends.performance.change < 0 ? '↑' : trends.performance.change > 0 ? '↓' : '→'} 
          ${Math.abs(trends.performance.change)}% ${trends.performance.change < 0 ? 'faster' : 'slower'}
        </div>
      </div>
    </div>

    <!-- Week Highlights -->
    <div class="highlight-box">
      <h3>📈 Week Highlights</h3>
      <ul>
        ${locations.newInstalls > 0 ? `<li><strong>${locations.newInstalls}</strong> new locations installed LPai</li>` : ''}
        ${locations.uninstalls > 0 ? `<li><strong>${locations.uninstalls}</strong> locations uninstalled (investigate reasons)</li>` : ''}
        ${performance.peakHour.hour ? `<li>Peak activity at <strong>${performance.peakHour.hour}:00</strong> with ${performance.peakHour.volume} webhooks</li>` : ''}
        ${locations.recentlyActive < locations.total * 0.5 ? 
          `<li class="warning">Only <strong>${Math.round(locations.recentlyActive / locations.total * 100)}%</strong> of locations were active this week</li>` : 
          `<li><strong>${Math.round(locations.recentlyActive / locations.total * 100)}%</strong> of locations actively using the system</li>`
        }
      </ul>
    </div>

    <h2>📊 Queue Performance Analysis</h2>
    <table>
      <thead>
        <tr>
          <th>Queue Type</th>
          <th>Processed</th>
          <th>Success Rate</th>
          <th>Avg Processing Time</th>
          <th>Failures</th>
          <th>Performance</th>
        </tr>
      </thead>
      <tbody>
        ${performance.queuePerformance.map(queue => {
          const successRate = queue.processed > 0 ? 
            ((queue.processed - queue.failures) / queue.processed * 100).toFixed(1) : 100;
          const performanceClass = successRate >= 99 ? 'success' : 
                                 successRate >= 95 ? 'warning' : 'error';
          
          return `
          <tr>
            <td><strong>${queue._id}</strong></td>
            <td>${queue.processed.toLocaleString()}</td>
            <td class="${performanceClass}">${successRate}%</td>
            <td>${this.formatDuration(queue.avgProcessingTime)}</td>
            <td class="${queue.failures > 0 ? 'error' : 'success'}">${queue.failures}</td>
            <td>${this.getPerformanceEmoji(successRate)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <h2>🏢 Location Statistics</h2>
    <div class="chart-container">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
        <div>
          <h4>Setup Status</h4>
          <p><strong>${locations.setupCompleted}</strong> of ${locations.total} locations fully configured</p>
          <p>Completion rate: <strong>${Math.round(locations.setupCompleted / locations.total * 100)}%</strong></p>
        </div>
        <div>
          <h4>OAuth Status</h4>
          <p><strong>${locations.withOAuth}</strong> locations with valid OAuth</p>
          <p>OAuth coverage: <strong>${Math.round(locations.withOAuth / locations.total * 100)}%</strong></p>
        </div>
        <div>
          <h4>Activity Level</h4>
          <p><strong>${locations.recentlyActive}</strong> active this week</p>
          <p>Activity rate: <strong>${Math.round(locations.recentlyActive / locations.total * 100)}%</strong></p>
        </div>
      </div>
    </div>

    ${topErrors.length > 0 ? `
    <h2>⚠️ Top Issues This Week</h2>
    <table>
      <thead>
        <tr>
          <th>Error Type</th>
          <th>Occurrences</th>
          <th>Affected Types</th>
          <th>Action Required</th>
        </tr>
      </thead>
      <tbody>
        ${topErrors.slice(0, 5).map(error => `
          <tr>
            <td class="error">${error._id}</td>
            <td>${error.count}</td>
            <td>${error.types.join(', ')}</td>
            <td>${this.getActionForError(error._id)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<h2>✅ No Major Issues This Week</h2><p>All systems running smoothly!</p>'}

    <h2>💡 Recommendations</h2>
    <ul>
      ${trends.successRate.current < 99 ? 
        `<li class="warning">Success rate below target. Review error logs and implement fixes for top issues.</li>` : 
        `<li class="success">Excellent success rate maintained above 99%!</li>`
      }
      ${locations.recentlyActive < locations.total * 0.7 ? 
        `<li>Low activity rate (${Math.round(locations.recentlyActive / locations.total * 100)}%). Consider reaching out to inactive locations.</li>` : 
        ''
      }
      ${performance.peakHour.volume > 1000 ? 
        `<li>High peak load at ${performance.peakHour.hour}:00. Consider scaling resources during this time.</li>` : 
        ''
      }
      ${locations.setupCompleted < locations.total * 0.9 ? 
        `<li>Only ${Math.round(locations.setupCompleted / locations.total * 100)}% of locations have completed setup. Follow up with incomplete setups.</li>` : 
        ''
      }
    </ul>

    <div class="footer">
      <p><strong>Report Period:</strong> ${analytics.period.start.toLocaleString()} to ${analytics.period.end.toLocaleString()}</p>
      <p><strong>Next Report:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
      <p>For detailed analytics and real-time monitoring, visit the LPai Dashboard.</p>
      <p>Questions or concerns? Contact support@leadprospecting.ai</p>
    </div>
  </div>
</body>
</html>
    `;
  }
  
  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
  
  /**
   * Get performance emoji
   */
  private getPerformanceEmoji(successRate: number): string {
    if (successRate >= 99) return '🟢 Excellent';
    if (successRate >= 95) return '🟡 Good';
    if (successRate >= 90) return '🟠 Fair';
    return '🔴 Needs Attention';
  }
  
  /**
   * Get action recommendation for error type
   */
  private getActionForError(errorType: string): string {
    const actions: Record<string, string> = {
      'Timeout Error': 'Increase timeout limits or optimize slow operations',
      'Network Error': 'Check API connectivity and retry logic',
      'Authentication Error': 'Verify OAuth tokens and refresh mechanism',
      'Validation Error': 'Review data schemas and validation rules',
      'Rate Limit Error': 'Implement better rate limiting and queuing',
      'Processing Error': 'Check logs for specific error details'
    };
    
    return actions[errorType] || 'Investigate error logs';
  }
  
  /**
   * Get report recipients from database
   */
  private async getReportRecipients(): Promise<string[]> {
    const settings = await this.db.collection('settings').findOne({ 
      type: 'reportRecipients' 
    });
    
    // Default to info@leadprospecting.ai as requested
    return settings?.recipients || ['info@leadprospecting.ai'];
  }
}