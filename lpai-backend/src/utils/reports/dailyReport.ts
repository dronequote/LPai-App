// /src/utils/reports/dailyReport.ts
import { Db } from 'mongodb';
import { WebhookAnalytics } from '../analytics/webhookAnalytics';
import { EmailService } from '../email/emailService';

export class DailyReportGenerator {
  private db: Db;
  private analytics: WebhookAnalytics;
  private emailService: EmailService;
  
  constructor(db: Db) {
    this.db = db;
    this.analytics = new WebhookAnalytics(db);
    this.emailService = new EmailService();
  }
  
  /**
   * Generate and send daily report
   */
  async generateDailyReport(): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    
    console.log(`[Daily Report] Generating report for ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get analytics data
    const analyticsData = await this.analytics.getAnalytics(startDate, endDate);
    
    // Get system health metrics
    const systemHealth = await this.getSystemHealth();
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(analyticsData, systemHealth);
    
    // Get report recipients
    const recipients = await this.getReportRecipients();
    
    // Send email
    await this.emailService.sendReport({
      to: recipients,
      subject: `LPai Webhook Report - ${new Date().toLocaleDateString()}`,
      html: htmlReport
    });
    
    // Store report in database
    await this.db.collection('reports').insertOne({
      type: 'daily',
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      data: analyticsData,
      sentTo: recipients
    });
  }
  
  /**
   * Get system health metrics
   */
  private async getSystemHealth(): Promise<any> {
    const [
      queueDepth,
      failedWebhooks,
      activeLocations
    ] = await Promise.all([
      // Current queue depth
      this.db.collection('webhook_queue')
        .aggregate([
          { $match: { status: 'pending' } },
          { $group: { _id: '$queueType', count: { $sum: 1 } } }
        ])
        .toArray(),
      
      // Failed webhooks in last 24 hours
      this.db.collection('webhook_queue')
        .countDocuments({
          status: 'failed',
          updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
      
      // Active locations
      this.db.collection('locations')
        .countDocuments({ appInstalled: true })
    ]);
    
    return {
      queueDepth,
      failedWebhooks,
      activeLocations,
      timestamp: new Date()
    };
  }
  
  /**
   * Generate HTML report
   */
  private generateHTMLReport(analytics: any, systemHealth: any): string {
    const { byQueue, topErrors, slowestWebhooks } = analytics;
    
    // Calculate totals
    let totalWebhooks = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalSLAViolations = 0;
    
    byQueue.forEach(queue => {
      totalWebhooks += queue.total;
      queue.byStatus.forEach(status => {
        if (status.status === 'success') totalSuccessful += status.count;
        if (status.status === 'failed') totalFailed += status.count;
      });
      totalSLAViolations += queue.slaViolations || 0;
    });
    
    const successRate = totalWebhooks > 0 ? 
      ((totalSuccessful / totalWebhooks) * 100).toFixed(1) : '0';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LPai Daily Webhook Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      color: #2E86AB;
      border-bottom: 2px solid #2E86AB;
      padding-bottom: 10px;
    }
    h2 {
      color: #444;
      margin-top: 30px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e9ecef;
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #2E86AB;
    }
    .metric-label {
      color: #666;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .success { color: #27AE60; }
    .warning { color: #F39C12; }
    .error { color: #E74C3C; }
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
    }
    .performance-bar {
      background: #e9ecef;
      height: 20px;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    }
    .performance-fill {
      height: 100%;
      background: #27AE60;
      transition: width 0.3s;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Daily Webhook Performance Report</h1>
    <p style="color: #666;">Report generated on ${new Date().toLocaleString()}</p>
    
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value">${totalWebhooks.toLocaleString()}</div>
        <div class="metric-label">Total Webhooks</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${parseFloat(successRate) >= 99 ? 'success' : parseFloat(successRate) >= 95 ? 'warning' : 'error'}">
          ${successRate}%
        </div>
        <div class="metric-label">Success Rate</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${totalSLAViolations === 0 ? 'success' : totalSLAViolations < 10 ? 'warning' : 'error'}">
          ${totalSLAViolations}
        </div>
        <div class="metric-label">SLA Violations</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${systemHealth.activeLocations}</div>
        <div class="metric-label">Active Locations</div>
      </div>
    </div>

    <h2>📈 Performance by Queue Type</h2>
    <table>
      <thead>
        <tr>
          <th>Queue</th>
          <th>Total</th>
          <th>Success</th>
          <th>Failed</th>
          <th>Avg Duration</th>
          <th>Max Duration</th>
          <th>SLA Violations</th>
        </tr>
      </thead>
      <tbody>
        ${byQueue.map(queue => {
          const successful = queue.byStatus.find(s => s.status === 'success')?.count || 0;
          const failed = queue.byStatus.find(s => s.status === 'failed')?.count || 0;
          const successRate = queue.total > 0 ? (successful / queue.total * 100).toFixed(1) : '0';
          
          return `
          <tr>
            <td><strong>${queue._id}</strong></td>
            <td>${queue.total.toLocaleString()}</td>
            <td class="success">${successful.toLocaleString()}</td>
            <td class="error">${failed.toLocaleString()}</td>
            <td>${this.formatDuration(queue.avgTotalDuration)}</td>
            <td>${this.formatDuration(queue.maxTotalDuration)}</td>
            <td class="${queue.slaViolations === 0 ? 'success' : 'warning'}">
              ${queue.slaViolations}
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <h2>⚠️ Current Queue Status</h2>
    <table>
      <thead>
        <tr>
          <th>Queue</th>
          <th>Pending Items</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${systemHealth.queueDepth.map(queue => `
          <tr>
            <td><strong>${queue._id}</strong></td>
            <td class="${queue.count > 100 ? 'error' : queue.count > 50 ? 'warning' : ''}"}>
              ${queue.count}
            </td>
            <td>${queue.count > 100 ? '🔴 High' : queue.count > 50 ? '🟡 Medium' : '🟢 Normal'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${topErrors.length > 0 ? `
    <h2>❌ Top Errors (Last 24 Hours)</h2>
    <table>
      <thead>
        <tr>
          <th>Error</th>
          <th>Count</th>
          <th>Webhook Types</th>
        </tr>
      </thead>
      <tbody>
        ${topErrors.slice(0, 5).map(error => `
          <tr>
            <td>${error._id}</td>
            <td class="error">${error.count}</td>
            <td>${error.types.join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${slowestWebhooks.length > 0 ? `
    <h2>🐌 Slowest Webhooks</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Queue</th>
          <th>Total Duration</th>
          <th>Location ID</th>
        </tr>
      </thead>
      <tbody>
        ${slowestWebhooks.slice(0, 5).map(webhook => `
          <tr>
            <td>${webhook.type}</td>
            <td>${webhook.queueType}</td>
            <td class="error">${this.formatDuration(webhook.totalDuration)}</td>
            <td>${webhook.locationId}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    <h2>💡 Insights & Recommendations</h2>
    <ul>
      ${parseFloat(successRate) < 99 ? 
        `<li class="warning">Success rate is below 99%. Review failed webhooks for patterns.</li>` : 
        `<li class="success">Excellent success rate of ${successRate}%!</li>`
      }
      ${totalSLAViolations > 10 ? 
        `<li class="error">High number of SLA violations (${totalSLAViolations}). Consider scaling up processing.</li>` : 
        ''
      }
      ${systemHealth.queueDepth.some(q => q.count > 100) ? 
        `<li class="warning">Some queues have high pending counts. Monitor for processing delays.</li>` : 
        ''
      }
      ${slowestWebhooks[0]?.totalDuration > 30000 ? 
        `<li class="warning">Some webhooks taking over 30 seconds. Investigate slow operations.</li>` : 
        ''
      }
    </ul>

    <div class="footer">
      <p>This report covers webhook activity from ${analytics.period.start.toLocaleString()} to ${analytics.period.end.toLocaleString()}</p>
      <p>For detailed analytics, visit the LPai Dashboard. Questions? Contact support@lpai.com</p>
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
   * Get report recipients from database
   */
  private async getReportRecipients(): Promise<string[]> {
    const settings = await this.db.collection('settings').findOne({ 
      type: 'reportRecipients' 
    });
    
    return settings?.recipients || [process.env.ADMIN_EMAIL || 'admin@lpai.com'];
  }
}