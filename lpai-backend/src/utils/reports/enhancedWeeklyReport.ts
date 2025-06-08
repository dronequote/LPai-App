// /src/utils/reports/enhancedWeeklyReport.ts
import { Db } from 'mongodb';
import { EmailService } from '../email/emailService';

export class EnhancedWeeklyReportGenerator {
  private db: Db;
  private emailService: EmailService;
  
  constructor(db: Db) {
    this.db = db;
    this.emailService = new EmailService();
  }
  
  /**
   * Generate and send enhanced weekly report
   */
  async generateWeeklyReport(): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    // Also get last week's data for comparison
    const lastWeekEnd = new Date(startDate);
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    
    console.log(`[Enhanced Weekly Report] Generating report for week of ${startDate.toISOString()}`);
    
    try {
      // 1. Get week-over-week comparison
      const weekComparison = await this.getWeekOverWeekComparison(
        startDate, endDate, lastWeekStart, lastWeekEnd
      );
      
      // 2. Get detailed performance metrics
      const performanceMetrics = await this.getWeeklyPerformanceMetrics(startDate, endDate);
      
      // 3. Get location analytics
      const locationAnalytics = await this.getLocationAnalytics(startDate, endDate);
      
      // 4. Get top performers and issues
      const insights = await this.getWeeklyInsights(startDate, endDate);
      
      // 5. Get install performance
      const installPerformance = await this.getInstallPerformance(startDate, endDate);
      
      // 6. Get financial impact estimate
      const financialImpact = await this.getFinancialImpact(startDate, endDate);
      
      // Generate HTML report
      const htmlReport = this.generateHTMLReport({
        period: { start: startDate, end: endDate },
        weekComparison,
        performanceMetrics,
        locationAnalytics,
        insights,
        installPerformance,
        financialImpact
      });
      
      // Send email
      await this.emailService.sendReport({
        to: ['info@leadprospecting.ai'],
        subject: `LPai Weekly Report - Week of ${startDate.toLocaleDateString()} 📊`,
        html: htmlReport
      });
      
      // Store report
      await this.db.collection('reports').insertOne({
        type: 'weekly',
        generatedAt: new Date(),
        period: { start: startDate, end: endDate },
        data: {
          weekComparison,
          performanceMetrics,
          locationAnalytics,
          insights,
          installPerformance,
          financialImpact
        },
        sentTo: ['info@leadprospecting.ai']
      });
      
      console.log('[Enhanced Weekly Report] Report sent successfully');
      
    } catch (error) {
      console.error('[Enhanced Weekly Report] Error:', error);
      throw error;
    }
  }
  
  /**
   * Get week-over-week comparison
   */
  private async getWeekOverWeekComparison(
    thisWeekStart: Date,
    thisWeekEnd: Date,
    lastWeekStart: Date,
    lastWeekEnd: Date
  ) {
    const [thisWeek, lastWeek] = await Promise.all([
      // This week's data
      this.db.collection('webhook_queue').aggregate([
        {
          $match: {
            queuedAt: { $gte: thisWeekStart, $lte: thisWeekEnd }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            avgProcessingTime: {
              $avg: {
                $cond: [
                  { $and: ['$processingStarted', '$processingCompleted'] },
                  { $subtract: ['$processingCompleted', '$processingStarted'] },
                  null
                ]
              }
            }
          }
        }
      ]).toArray(),
      
      // Last week's data
      this.db.collection('webhook_queue').aggregate([
        {
          $match: {
            queuedAt: { $gte: lastWeekStart, $lte: lastWeekEnd }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            avgProcessingTime: {
              $avg: {
                $cond: [
                  { $and: ['$processingStarted', '$processingCompleted'] },
                  { $subtract: ['$processingCompleted', '$processingStarted'] },
                  null
                ]
              }
            }
          }
        }
      ]).toArray()
    ]);
    
    const thisWeekData = thisWeek[0] || { total: 0, completed: 0, failed: 0 };
    const lastWeekData = lastWeek[0] || { total: 0, completed: 0, failed: 0 };
    
    // Calculate changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    return {
      thisWeek: thisWeekData,
      lastWeek: lastWeekData,
      changes: {
        volume: calculateChange(thisWeekData.total, lastWeekData.total),
        successRate: {
          current: thisWeekData.total > 0 ? (thisWeekData.completed / thisWeekData.total) * 100 : 100,
          previous: lastWeekData.total > 0 ? (lastWeekData.completed / lastWeekData.total) * 100 : 100
        },
        failures: calculateChange(thisWeekData.failed, lastWeekData.failed),
        processingTime: calculateChange(
          thisWeekData.avgProcessingTime || 0,
          lastWeekData.avgProcessingTime || 0
        )
      }
    };
  }
  
  /**
   * Get detailed weekly performance metrics
   */
  private async getWeeklyPerformanceMetrics(startDate: Date, endDate: Date) {
    const metrics = await this.db.collection('webhook_queue').aggregate([
      {
        $match: {
          queuedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $facet: {
          // Daily breakdown
          dailyBreakdown: [
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$queuedAt" }
                },
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                avgProcessingTime: {
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
          
          // Queue breakdown
          queueBreakdown: [
            {
              $group: {
                _id: '$queueType',
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                avgProcessingTime: {
                  $avg: {
                    $cond: [
                      { $and: ['$processingStarted', '$processingCompleted'] },
                      { $subtract: ['$processingCompleted', '$processingStarted'] },
                      null
                    ]
                  }
                },
                p95ProcessingTime: {
                  $percentile: {
                    p: [0.95],
                    input: {
                      $cond: [
                        { $and: ['$processingStarted', '$processingCompleted'] },
                        { $subtract: ['$processingCompleted', '$processingStarted'] },
                        null
                      ]
                    },
                    method: 'approximate'
                  }
                }
              }
            }
          ],
          
          // Type breakdown  
          typeBreakdown: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                avgProcessingTime: {
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
            { $sort: { count: -1 } },
            { $limit: 15 }
          ],
          
          // Peak hours
          hourlyPattern: [
            {
              $group: {
                _id: { $hour: '$queuedAt' },
                avgCount: { $avg: 1 },
                totalCount: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]).toArray();
    
    return metrics[0];
  }
  
  /**
   * Get location analytics
   */
  private async getLocationAnalytics(startDate: Date, endDate: Date) {
    const analytics = await this.db.collection('locations').aggregate([
      {
        $facet: {
          // Growth metrics
          growth: [
            {
              $group: {
                _id: null,
                totalActive: { $sum: { $cond: ['$appInstalled', 1, 0] } },
                newInstalls: {
                  $sum: {
                    $cond: [
                      { $and: [
                        { $gte: ['$installedAt', startDate] },
                        { $lte: ['$installedAt', endDate] }
                      ]},
                      1,
                      0
                    ]
                  }
                },
                uninstalls: {
                  $sum: {
                    $cond: [
                      { $and: [
                        { $gte: ['$uninstalledAt', startDate] },
                        { $lte: ['$uninstalledAt', endDate] }
                      ]},
                      1,
                      0
                    ]
                  }
                },
                withOAuth: { $sum: { $cond: ['$ghlOAuth.accessToken', 1, 0] } },
                setupCompleted: { $sum: { $cond: ['$setupCompleted', 1, 0] } }
              }
            }
          ],
          
          // Top locations by activity
          topLocations: [
            {
              $lookup: {
                from: 'webhook_queue',
                let: { locId: '$locationId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$locationId', '$$locId'] },
                          { $gte: ['$queuedAt', startDate] },
                          { $lte: ['$queuedAt', endDate] }
                        ]
                      }
                    }
                  },
                  { $count: 'webhookCount' }
                ],
                as: 'activity'
              }
            },
            {
              $project: {
                locationId: 1,
                name: 1,
                webhookCount: { $ifNull: [{ $first: '$activity.webhookCount' }, 0] }
              }
            },
            { $match: { webhookCount: { $gt: 0 } } },
            { $sort: { webhookCount: -1 } },
            { $limit: 10 }
          ],
          
          // Locations with issues
          problemLocations: [
            {
              $match: {
                $or: [
                  { 'ghlOAuth.needsReauth': true },
                  { setupError: { $exists: true } },
                  {
                    $and: [
                      { appInstalled: true },
                      { setupCompleted: { $ne: true } },
                      { installedAt: { $lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }
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
                                'Setup incomplete > 3 days'
                            ]
                            }
                        ]
                        },
                daysSinceInstall: {
                  $divide: [
                    { $subtract: [new Date(), '$installedAt'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              }
            }
          ]
        }
      }
    ]).toArray();
    
    return analytics[0];
  }
  
  /**
   * Get weekly insights
   */
  private async getWeeklyInsights(startDate: Date, endDate: Date) {
    // Get error patterns
    const errorPatterns = await this.db.collection('webhook_queue').aggregate([
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
            queue: '$queueType',
            error: {
              $switch: {
                branches: [
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /timeout/i } }, then: 'Timeout' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /network/i } }, then: 'Network' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /auth/i } }, then: 'Authentication' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /validation/i } }, then: 'Validation' },
                  { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /rate limit/i } }, then: 'Rate Limit' }
                ],
                default: 'Other'
              }
            }
          },
          count: { $sum: 1 },
          firstSeen: { $min: '$processingCompleted' },
          lastSeen: { $max: '$processingCompleted' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    // Get performance champions (best performing queues/types)
    const performanceChampions = await this.db.collection('webhook_queue').aggregate([
      {
        $match: {
          status: 'completed',
          processingCompleted: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            queue: '$queueType',
            type: '$type'
          },
          count: { $sum: 1 },
          avgTime: {
            $avg: {
              $subtract: ['$processingCompleted', '$processingStarted']
            }
          }
        }
      },
      { $match: { count: { $gte: 100 } } }, // Only consider high-volume
      { $sort: { avgTime: 1 } },
      { $limit: 5 }
    ]).toArray();
    
    return {
      errorPatterns,
      performanceChampions
    };
  }
  
  /**
   * Get install performance metrics
   */
  private async getInstallPerformance(startDate: Date, endDate: Date) {
    const installs = await this.db.collection('webhook_metrics').aggregate([
      {
        $match: {
          type: 'INSTALL',
          'timestamps.routerReceived': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $facet: {
          summary: [
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
          ],
          dailyInstalls: [
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$timestamps.routerReceived" }
                },
                count: { $sum: 1 },
                successful: { $sum: { $cond: ['$success', 1, 0] } },
                avgDuration: { $avg: '$metrics.totalEndToEnd' }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]).toArray();
    
    // Get detailed install data from locations
    const locationInstalls = await this.db.collection('locations').aggregate([
      {
        $match: {
          installedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalContacts: { $sum: { $ifNull: ['$setupResults.steps.contacts.processed', 0] } },
          totalCustomFields: { $sum: { $ifNull: ['$setupResults.steps.customFields.totalFields', 0] } },
          totalPipelines: { $sum: { $ifNull: ['$setupResults.steps.pipelines.pipelineCount', 0] } },
          avgSetupDuration: {
            $avg: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$setupResults.duration', ''] }, regex: /^\d+\.?\d*s$/ } },
                {
                  $toDouble: {
                    $arrayElemAt: [
                      { $split: ['$setupResults.duration', 's'] },
                      0
                    ]
                  }
                },
                null
              ]
            }
          }
        }
      }
    ]).toArray();
    
    return {
      metrics: installs[0],
      dataVolume: locationInstalls[0] || {}
    };
  }
  
  /**
   * Calculate financial impact
   */
  private async getFinancialImpact(startDate: Date, endDate: Date) {
    const metrics = await this.db.collection('webhook_queue').aggregate([
      {
        $match: {
          queuedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalWebhooks: { $sum: 1 },
          totalProcessingTime: {
            $sum: {
              $cond: [
                { $and: ['$processingStarted', '$processingCompleted'] },
                { $subtract: ['$processingCompleted', '$processingStarted'] },
                0
              ]
            }
          }
        }
      }
    ]).toArray();
    
    const data = metrics[0] || { totalWebhooks: 0, totalProcessingTime: 0 };
    
    // Cost estimates (example rates)
    const costPerWebhook = 0.0001; // $0.0001 per webhook
    const costPerComputeSecond = 0.00001; // $0.00001 per second
    
    return {
      webhookCost: data.totalWebhooks * costPerWebhook,
      computeCost: (data.totalProcessingTime / 1000) * costPerComputeSecond,
      totalCost: (data.totalWebhooks * costPerWebhook) + ((data.totalProcessingTime / 1000) * costPerComputeSecond),
      metrics: data
    };
  }
  
  /**
   * Generate the HTML report
   */
  private generateHTMLReport(data: any): string {
    const {
      period,
      weekComparison,
      performanceMetrics,
      locationAnalytics,
      insights,
      installPerformance,
      financialImpact
    } = data;
    
    // Calculate key metrics
    const weekSuccessRate = weekComparison.changes.successRate.current;
    const volumeChange = weekComparison.changes.volume;
    const netGrowth = (locationAnalytics.growth[0]?.newInstalls || 0) - (locationAnalytics.growth[0]?.uninstalls || 0);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LPai Weekly Report - ${period.start.toLocaleDateString()}</title>
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
      background-color: #f0f2f5;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 40px rgba(0,0,0,0.1);
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: pulse 20s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(1.2); opacity: 0.1; }
    }
    
    .header h1 {
      font-size: 3em;
      margin-bottom: 15px;
      font-weight: 800;
      position: relative;
      z-index: 1;
    }
    
    .header .subtitle {
      font-size: 1.2em;
      opacity: 0.9;
      position: relative;
      z-index: 1;
    }
    
    .content {
      padding: 40px;
    }
    
    /* Executive Summary */
    .executive-summary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 40px;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }
    
    .executive-summary h2 {
      font-size: 1.8em;
      margin-bottom: 20px;
    }
    
    .key-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .key-metric {
      background: rgba(255, 255, 255, 0.1);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .key-metric .value {
      font-size: 2.5em;
      font-weight: 800;
      margin: 10px 0;
    }
    
    .key-metric .label {
      font-size: 0.9em;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .key-metric .trend {
      font-size: 1.1em;
      margin-top: 10px;
      font-weight: 600;
    }
    
    .trend.up { color: #4ade80; }
    .trend.down { color: #f87171; }
    .trend.neutral { color: #fbbf24; }
    
    /* Section styling */
    .section {
      margin-bottom: 50px;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 3px solid #e5e7eb;
    }
    
    .section-header h2 {
      font-size: 2em;
      color: #1e293b;
      flex-grow: 1;
    }
    
    .section-header .icon {
      font-size: 2.5em;
      margin-right: 20px;
    }
    
    /* Charts and visualizations */
    .chart-container {
      background: #f8fafc;
      border-radius: 12px;
      padding: 25px;
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    
    .daily-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 200px;
      gap: 10px;
      padding: 20px 0;
    }
    
    .daily-bar {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    
    .daily-bar .bar {
      width: 100%;
      background: linear-gradient(to top, #667eea, #764ba2);
      border-radius: 4px 4px 0 0;
      position: relative;
      min-height: 10px;
      max-width: 60px;
      margin: 0 auto;
    }
    
    .daily-bar .label {
      font-size: 0.8em;
      color: #64748b;
      margin-top: 10px;
      text-align: center;
    }
    
    .daily-bar .value {
      position: absolute;
      top: -25px;
      font-size: 0.9em;
      font-weight: 600;
      color: #334155;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    
    th {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 16px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    td {
      padding: 14px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tr:hover {
      background: #f8fafc;
    }
    
    /* Status indicators */
    .status {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    
    .status.healthy { background: #d1fae5; color: #065f46; }
    .status.warning { background: #fef3c7; color: #92400e; }
    .status.critical { background: #fee2e2; color: #991b1b; }
    
    /* Progress bars */
    .progress-container {
      width: 100%;
      height: 10px;
      background: #e5e7eb;
      border-radius: 5px;
      overflow: hidden;
      margin: 5px 0;
    }
    
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 5px;
      transition: width 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    
    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
      );
      animation: shimmer 2s infinite;
    }
    
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    
    /* Alert boxes */
    .alert {
      padding: 20px 25px;
      border-radius: 12px;
      margin: 25px 0;
      border-left: 5px solid;
      position: relative;
      overflow: hidden;
    }
    
    .alert::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.1;
      background: currentColor;
    }
    
    .alert-content {
      position: relative;
      z-index: 1;
    }
    
    .alert.info {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }
    
    .alert.success {
      background: #f0fdf4;
      border-color: #22c55e;
      color: #166534;
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
    
    /* Grid layouts */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 25px 0;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 25px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      transition: all 0.3s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }
    
    .stat-card h3 {
      font-size: 0.9em;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    
    .stat-card .value {
      font-size: 2.2em;
      font-weight: 700;
      color: #1e293b;
      margin: 10px 0;
    }
    
    .stat-card .subtitle {
      font-size: 0.9em;
      color: #94a3b8;
    }
    
    /* Location cards */
    .location-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin: 25px 0;
    }
    
    .location-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      transition: all 0.3s ease;
    }
    
    .location-card:hover {
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    
    .location-card h4 {
      font-size: 1.1em;
      margin-bottom: 10px;
      color: #1e293b;
    }
    
    .location-card .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0;
      font-size: 0.9em;
    }
    
    .location-card .metric .label {
      color: #64748b;
    }
    
    .location-card .metric .value {
      font-weight: 600;
      color: #334155;
    }
    
    /* Footer */
    .footer {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    .footer h3 {
      font-size: 1.5em;
      margin-bottom: 20px;
    }
    
    .footer p {
      opacity: 0.9;
      margin: 10px 0;
    }
    
    .footer a {
      color: white;
      text-decoration: underline;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header h1 {
        font-size: 2em;
      }
      
      .content {
        padding: 20px;
      }
      
      .key-metrics {
        grid-template-columns: 1fr;
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      table {
        font-size: 0.9em;
      }
      
      th, td {
        padding: 10px;
      }
    }
    
    @media print {
      body {
        background: white;
      }
      
      .container {
        box-shadow: none;
      }
      
      .alert {
        page-break-inside: avoid;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 Weekly Performance Report</h1>
      <div class="subtitle">
        ${period.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
        ${period.end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
    
    <div class="content">
      <!-- Executive Summary -->
      <div class="executive-summary">
        <h2>📈 Executive Summary</h2>
        <p style="font-size: 1.1em; margin-bottom: 20px; opacity: 0.95;">
          This week, the LPai platform processed <strong>${weekComparison.thisWeek.total.toLocaleString()}</strong> webhooks
          with a <strong>${weekSuccessRate.toFixed(1)}%</strong> success rate.
          ${volumeChange > 0 ? 
            `Volume increased by <strong>${volumeChange.toFixed(1)}%</strong> compared to last week.` :
            volumeChange < 0 ?
            `Volume decreased by <strong>${Math.abs(volumeChange).toFixed(1)}%</strong> compared to last week.` :
            `Volume remained stable compared to last week.`
          }
        </p>
        
        <div class="key-metrics">
          <div class="key-metric">
            <div class="label">Total Webhooks</div>
            <div class="value">${weekComparison.thisWeek.total.toLocaleString()}</div>
            <div class="trend ${volumeChange > 0 ? 'up' : volumeChange < 0 ? 'down' : 'neutral'}">
              ${volumeChange > 0 ? '↑' : volumeChange < 0 ? '↓' : '→'} ${Math.abs(volumeChange).toFixed(1)}%
            </div>
          </div>
          
          <div class="key-metric">
            <div class="label">Success Rate</div>
            <div class="value">${weekSuccessRate.toFixed(1)}%</div>
            <div class="trend ${weekSuccessRate >= weekComparison.changes.successRate.previous ? 'up' : 'down'}">
              ${weekSuccessRate >= weekComparison.changes.successRate.previous ? '↑' : '↓'} 
              ${Math.abs(weekSuccessRate - weekComparison.changes.successRate.previous).toFixed(1)}%
            </div>
          </div>
          
          <div class="key-metric">
            <div class="label">Active Locations</div>
            <div class="value">${locationAnalytics.growth[0]?.totalActive || 0}</div>
            <div class="trend ${netGrowth > 0 ? 'up' : netGrowth < 0 ? 'down' : 'neutral'}">
              ${netGrowth > 0 ? '+' : ''}${netGrowth} this week
            </div>
          </div>
          
          <div class="key-metric">
            <div class="label">Est. Weekly Cost</div>
            <div class="value">${financialImpact.totalCost.toFixed(2)}</div>
            <div class="trend neutral">
              ${(weekComparison.thisWeek.total * 0.0001).toFixed(2)}/webhook
            </div>
          </div>
        </div>
      </div>
      
      <!-- Daily Performance Chart -->
      <div class="section">
        <div class="section-header">
          <span class="icon">📅</span>
          <h2>Daily Performance Breakdown</h2>
        </div>
        
        <div class="chart-container">
          <div class="daily-chart">
            ${performanceMetrics.dailyBreakdown.map(day => {
              const maxCount = Math.max(...performanceMetrics.dailyBreakdown.map(d => d.total));
              const height = (day.total / maxCount) * 100;
              const successRate = day.total > 0 ? (day.completed / day.total * 100).toFixed(1) : '100';
              const dayName = new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' });
              
              return `
                <div class="daily-bar">
                  <span class="value">${day.total}</span>
                  <div class="bar" style="height: ${height}%; background: ${parseFloat(successRate) >= 99 ? 'linear-gradient(to top, #22c55e, #4ade80)' : parseFloat(successRate) >= 95 ? 'linear-gradient(to top, #f59e0b, #fbbf24)' : 'linear-gradient(to top, #ef4444, #f87171)'}"></div>
                  <div class="label">${dayName}<br><small>${successRate}%</small></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <!-- Queue Performance Analysis -->
      <div class="section">
        <div class="section-header">
          <span class="icon">⚡</span>
          <h2>Queue Performance Analysis</h2>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Queue Type</th>
              <th>Total Processed</th>
              <th>Success Rate</th>
              <th>Avg Processing</th>
              <th>95th Percentile</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            ${performanceMetrics.queueBreakdown.map(queue => {
              const successRate = queue.total > 0 ? (queue.completed / queue.total * 100).toFixed(1) : '100';
              const p95 = queue.p95ProcessingTime?.[0] || queue.avgProcessingTime;
              
              return `
                <tr>
                  <td><strong>${queue._id}</strong></td>
                  <td>${queue.total.toLocaleString()}</td>
                  <td>
                    <span class="status ${parseFloat(successRate) >= 99 ? 'healthy' : parseFloat(successRate) >= 95 ? 'warning' : 'critical'}">
                      ${successRate}%
                    </span>
                  </td>
                  <td>${this.formatDuration(queue.avgProcessingTime || 0)}</td>
                  <td>${this.formatDuration(p95 || 0)}</td>
                  <td>
                    <div class="progress-container">
                      <div class="progress-bar" style="width: ${Math.min(100, parseFloat(successRate))}%"></div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Location Growth & Activity -->
      <div class="section">
        <div class="section-header">
          <span class="icon">🏢</span>
          <h2>Location Analytics</h2>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total Active</h3>
            <div class="value">${locationAnalytics.growth[0]?.totalActive || 0}</div>
            <div class="subtitle">${locationAnalytics.growth[0]?.withOAuth || 0} with valid OAuth</div>
          </div>
          
          <div class="stat-card">
            <h3>New Installations</h3>
            <div class="value" style="color: #22c55e;">+${locationAnalytics.growth[0]?.newInstalls || 0}</div>
            <div class="subtitle">This week</div>
          </div>
          
          <div class="stat-card">
            <h3>Uninstalls</h3>
            <div class="value" style="color: #ef4444;">-${locationAnalytics.growth[0]?.uninstalls || 0}</div>
            <div class="subtitle">This week</div>
          </div>
          
          <div class="stat-card">
            <h3>Setup Completion</h3>
            <div class="value">${((locationAnalytics.growth[0]?.setupCompleted || 0) / (locationAnalytics.growth[0]?.totalActive || 1) * 100).toFixed(1)}%</div>
            <div class="subtitle">${locationAnalytics.growth[0]?.setupCompleted || 0} completed</div>
          </div>
        </div>
        
        ${locationAnalytics.topLocations.length > 0 ? `
        <h3 style="margin-top: 30px; margin-bottom: 20px;">🏆 Most Active Locations</h3>
        <div class="location-grid">
          ${locationAnalytics.topLocations.slice(0, 6).map((location, index) => `
            <div class="location-card">
              <h4>${index + 1}. ${location.name || 'Unknown'}</h4>
              <div class="metric">
                <span class="label">Webhooks Processed</span>
                <span class="value">${location.webhookCount.toLocaleString()}</span>
              </div>
              <div class="metric">
                <span class="label">Daily Average</span>
                <span class="value">${Math.round(location.webhookCount / 7)}</span>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      
      <!-- Installation Performance -->
      ${installPerformance.metrics.summary[0]?.total > 0 ? `
      <div class="section">
        <div class="section-header">
          <span class="icon">🚀</span>
          <h2>Installation Performance</h2>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total Installations</h3>
            <div class="value">${installPerformance.metrics.summary[0].total}</div>
            <div class="subtitle">${installPerformance.metrics.summary[0].successful} successful</div>
          </div>
          
          <div class="stat-card">
            <h3>Success Rate</h3>
            <div class="value">${((installPerformance.metrics.summary[0].successful / installPerformance.metrics.summary[0].total) * 100).toFixed(1)}%</div>
            <div class="subtitle">This week</div>
          </div>
          
          <div class="stat-card">
            <h3>Avg Install Time</h3>
            <div class="value">${this.formatDuration(installPerformance.metrics.summary[0].avgDuration || 0)}</div>
            <div class="subtitle">Per location</div>
          </div>
          
          <div class="stat-card">
            <h3>Data Volume</h3>
            <div class="value">${(installPerformance.dataVolume.totalContacts || 0).toLocaleString()}</div>
            <div class="subtitle">Total contacts synced</div>
          </div>
        </div>
        
        ${installPerformance.metrics.dailyInstalls.length > 0 ? `
        <h3 style="margin-top: 30px; margin-bottom: 20px;">Daily Installation Trend</h3>
        <div class="chart-container">
          <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 100px;">
            ${installPerformance.metrics.dailyInstalls.map(day => {
              const maxCount = Math.max(...installPerformance.metrics.dailyInstalls.map(d => d.count));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              const dayName = new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' });
              
              return `
                <div style="text-align: center; flex: 1;">
                  <div style="background: linear-gradient(to top, #667eea, #764ba2); width: 40px; height: ${height}%; margin: 0 auto; border-radius: 4px 4px 0 0;"></div>
                  <div style="margin-top: 5px; font-size: 0.8em; color: #64748b;">${dayName}<br>${day.count}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}
      
      <!-- Error Analysis & Insights -->
      ${insights.errorPatterns.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <span class="icon">🔍</span>
          <h2>Error Patterns & Analysis</h2>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Error Type</th>
              <th>Webhook Type</th>
              <th>Queue</th>
              <th>Occurrences</th>
              <th>Time Span</th>
            </tr>
          </thead>
          <tbody>
            ${insights.errorPatterns.slice(0, 10).map(error => {
              const timeSpan = new Date(error.lastSeen).getTime() - new Date(error.firstSeen).getTime();
              const hours = Math.round(timeSpan / (1000 * 60 * 60));
              
              return `
                <tr>
                  <td><span class="status critical">${error._id.error}</span></td>
                  <td>${error._id.type || 'Unknown'}</td>
                  <td>${error._id.queue}</td>
                  <td><strong>${error.count}</strong></td>
                  <td>${hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <!-- Locations Needing Attention -->
      ${locationAnalytics.problemLocations.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <span class="icon">⚠️</span>
          <h2>Locations Requiring Attention</h2>
        </div>
        
        <div class="alert warning">
          <div class="alert-content">
            <strong>${locationAnalytics.problemLocations.length} locations</strong> require immediate attention
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Issue</th>
              <th>Days Since Install</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            ${locationAnalytics.problemLocations.map(location => `
              <tr>
                <td>
                  <strong>${location.name || 'Unknown'}</strong><br>
                  <small style="color: #64748b;">${location.locationId}</small>
                </td>
                <td><span class="status warning">${location.issue}</span></td>
                <td>${Math.round(location.daysSinceInstall || 0)} days</td>
                <td>${this.getActionForIssue(location.issue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <!-- Weekly Recommendations -->
      <div class="section">
        <div class="section-header">
          <span class="icon">💡</span>
          <h2>Weekly Insights & Recommendations</h2>
        </div>
        
        <div class="alert ${weekSuccessRate >= 99 ? 'success' : weekSuccessRate >= 95 ? 'warning' : 'error'}">
          <div class="alert-content">
            <h3>Performance Status</h3>
            <p>${weekSuccessRate >= 99 ? 
              '✨ Excellent performance! System is running optimally.' :
              weekSuccessRate >= 95 ?
              '⚡ Good performance with room for improvement.' :
              '⚠️ Performance below target. Immediate action recommended.'
            }</p>
          </div>
        </div>
        
        ${this.generateWeeklyRecommendations(data)}
      </div>
      
      <!-- Financial Summary -->
      <div class="section">
        <div class="section-header">
          <span class="icon">💰</span>
          <h2>Cost Analysis</h2>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total Weekly Cost</h3>
            <div class="value">${financialImpact.totalCost.toFixed(2)}</div>
            <div class="subtitle">All operations</div>
          </div>
          
          <div class="stat-card">
            <h3>Per Webhook</h3>
            <div class="value">${(financialImpact.totalCost / (weekComparison.thisWeek.total || 1)).toFixed(4)}</div>
            <div class="subtitle">Average cost</div>
          </div>
          
          <div class="stat-card">
            <h3>Compute Time</h3>
            <div class="value">${(financialImpact.metrics.totalProcessingTime / 1000 / 60).toFixed(1)}m</div>
            <div class="subtitle">Total processing</div>
          </div>
          
          <div class="stat-card">
            <h3>Cost Trend</h3>
            <div class="value">${volumeChange > 0 ? '↑' : volumeChange < 0 ? '↓' : '→'} ${Math.abs(volumeChange).toFixed(1)}%</div>
            <div class="subtitle">vs last week</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <h3>📊 End of Weekly Report</h3>
      <p>Report Period: ${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}</p>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <p style="margin-top: 20px;">
        For real-time monitoring, visit the <a href="https://lpai-backend-omega.vercel.app/api/analytics/dashboard-ui">LPai Dashboard</a>
      </p>
      <p>Questions? Contact <a href="mailto:support@leadprospecting.ai">support@leadprospecting.ai</a></p>
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
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }
  
  /**
   * Get action recommendation for issue type
   */
  private getActionForIssue(issue: string): string {
    const actions: Record<string, string> = {
      'OAuth needs refresh': 'Re-authenticate in marketplace',
      'Setup error': 'Review error logs and retry',
      'Setup incomplete > 3 days': 'Contact location admin',
      'Authentication Error': 'Verify API credentials',
      'Rate Limit Error': 'Implement request throttling',
      'Timeout Error': 'Optimize slow operations',
      'Network Error': 'Check API connectivity'
    };
    
    return actions[issue] || 'Investigate and resolve';
  }
  
  /**
   * Generate weekly recommendations based on data
   */
  private generateWeeklyRecommendations(data: any): string {
    const recommendations: string[] = [];
    const { weekComparison, performanceMetrics, locationAnalytics, insights } = data;
    
    // Performance recommendations
    if (weekComparison.changes.successRate.current < 99) {
      recommendations.push(`
        <div class="alert warning">
          <div class="alert-content">
            <strong>🎯 Improve Success Rate</strong>
            <p>Current success rate of ${weekComparison.changes.successRate.current.toFixed(1)}% is below the 99% target.</p>
            <ul style="margin-top: 10px; margin-left: 20px;">
              ${insights.errorPatterns.slice(0, 3).map(e => 
                `<li>Fix ${e._id.error} errors affecting ${e._id.type} webhooks (${e.count} occurrences)</li>`
              ).join('')}
            </ul>
          </div>
        </div>
      `);
    }
    
    // Volume insights
    if (weekComparison.changes.volume > 50) {
      recommendations.push(`
        <div class="alert info">
          <div class="alert-content">
            <strong>📈 High Growth Detected</strong>
            <p>Webhook volume increased by ${weekComparison.changes.volume.toFixed(1)}% this week.</p>
            <p>Consider scaling infrastructure to maintain performance.</p>
          </div>
        </div>
      `);
    }
    
    // Location health
    if (locationAnalytics.problemLocations.length > 5) {
      recommendations.push(`
        <div class="alert warning">
          <div class="alert-content">
            <strong>🏢 Location Health Check</strong>
            <p>${locationAnalytics.problemLocations.length} locations need attention.</p>
            <p>Schedule a review of OAuth tokens and incomplete setups.</p>
          </div>
        </div>
      `);
    }
    
    // Performance champions
    if (insights.performanceChampions.length > 0) {
      const topPerformer = insights.performanceChampions[0];
      recommendations.push(`
        <div class="alert success">
          <div class="alert-content">
            <strong>🏆 Performance Champion</strong>
            <p>${topPerformer._id.type} webhooks in ${topPerformer._id.queue} queue are performing exceptionally well.</p>
            <p>Average processing time: ${this.formatDuration(topPerformer.avgTime)}</p>
          </div>
        </div>
      `);
    }
    
    // Cost optimization
    if (weekComparison.changes.processingTime > 20) {
      recommendations.push(`
        <div class="alert info">
          <div class="alert-content">
            <strong>💰 Cost Optimization Opportunity</strong>
            <p>Processing times increased by ${weekComparison.changes.processingTime.toFixed(1)}% this week.</p>
            <p>Review slow operations to reduce compute costs.</p>
          </div>
        </div>
      `);
    }
    
    return recommendations.join('');
  }
}