// pages/api/analytics/dashboard.ts - Enhanced version with all features

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { range = 'today' } = req.query;

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    
    switch (range) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    // 1. Enhanced Queue Statistics with Complete Metrics
    const queueStats = await db.collection('webhook_queue').aggregate([
      {
        $facet: {
          current: [
            {
              $match: {
                status: { $in: ['pending', 'processing'] }
              }
            },
            {
              $group: {
                _id: {
                  queueType: '$queueType',
                  status: '$status'
                },
                count: { $sum: 1 },
                avgWaitTime: {
                  $avg: {
                    $cond: [
                      { $eq: ['$status', 'pending'] },
                      { $subtract: [now, '$queuedAt'] },
                      null
                    ]
                  }
                },
                oldestItem: { $min: '$queuedAt' }
              }
            }
          ],
          historical: [
            {
              $match: {
                status: { $in: ['completed', 'failed'] },
                processingCompleted: { $gte: startDate }
              }
            },
            {
              $group: {
                _id: {
                  queueType: '$queueType',
                  status: '$status'
                },
                count: { $sum: 1 },
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
          sparklineData: [
            {
              $match: {
                processingCompleted: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
              }
            },
            {
              $group: {
                _id: {
                  queueType: '$queueType',
                  hour: {
                    $hour: '$processingCompleted'
                  }
                },
                count: { $sum: 1 }
              }
            },
            {
              $sort: { '_id.hour': 1 }
            }
          ]
        }
      }
    ]).toArray();

    // 2. Recent Activity Feed (last 20 items)
    const recentActivity = await db.collection('webhook_queue')
      .find({
        status: { $in: ['completed', 'failed'] },
        processingCompleted: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } // Last hour
      })
      .sort({ processingCompleted: -1 })
      .limit(20)
      .project({
        type: 1,
        status: 1,
        processingCompleted: 1,
        processingStarted: 1,
        queueType: 1,
        lastError: 1
      })
      .toArray();

    // 3. Performance Metrics from webhook_metrics
    const performanceData = await db.collection('webhook_metrics').aggregate([
      {
        $facet: {
          summary: [
            {
              $match: {
                'timestamps.processingCompleted': { $gte: startDate }
              }
            },
            {
              $group: {
                _id: null,
                totalProcessed: { $sum: 1 },
                successCount: { $sum: { $cond: ['$success', 1, 0] } },
                failureCount: { $sum: { $cond: ['$success', 0, 1] } },
                avgProcessingTime: { $avg: '$metrics.processingDuration' },
                minProcessingTime: { $min: '$metrics.processingDuration' },
                maxProcessingTime: { $max: '$metrics.processingDuration' },
                avgTotalLatency: { $avg: '$metrics.totalEndToEnd' }
              }
            }
          ],
          timeSeries: [
            {
              $match: {
                'timestamps.processingCompleted': { $gte: startDate }
              }
            },
            {
              $group: {
                _id: {
                  interval: {
                    $dateToString: {
                      format: range === 'hour' ? '%Y-%m-%d %H:%M' : 
                              range === 'today' ? '%H:00' :
                              range === 'week' ? '%Y-%m-%d' :
                              '%Y-%m-%d',
                      date: '$timestamps.processingCompleted'
                    }
                  },
                  queueType: '$queueType'
                },
                count: { $sum: 1 },
                avgLatency: { $avg: '$metrics.totalEndToEnd' },
                successCount: { $sum: { $cond: ['$success', 1, 0] } }
              }
            },
            {
              $sort: { '_id.interval': 1 }
            }
          ]
        }
      }
    ]).toArray();

    // 4. Error Analysis with sanitization
    const errorAnalysis = await db.collection('webhook_queue').aggregate([
      {
        $match: {
          status: 'failed',
          processingCompleted: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            error: {
              $switch: {
                branches: [
                  { case: { $regexMatch: { input: '$lastError', regex: /timeout/i } }, then: 'Timeout Error' },
                  { case: { $regexMatch: { input: '$lastError', regex: /network/i } }, then: 'Network Error' },
                  { case: { $regexMatch: { input: '$lastError', regex: /auth/i } }, then: 'Authentication Error' },
                  { case: { $regexMatch: { input: '$lastError', regex: /validation/i } }, then: 'Validation Error' },
                  { case: { $regexMatch: { input: '$lastError', regex: /rate limit/i } }, then: 'Rate Limit Error' }
                ],
                default: 'Processing Error'
              }
            }
          },
          count: { $sum: 1 },
          queueTypes: { $addToSet: '$queueType' },
          lastOccurrence: { $max: '$processingCompleted' },
          avgRetries: { $avg: '$attempts' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]).toArray();

    // 5. Webhook Type Distribution
    const webhookTypes = await db.collection('webhook_queue').aggregate([
      {
        $match: {
          queuedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          completed: 1,
          failed: 1,
          pending: 1,
          successRate: {
            $cond: [
              { $gt: [{ $add: ['$completed', '$failed'] }, 0] },
              { $multiply: [{ $divide: ['$completed', { $add: ['$completed', '$failed'] }] }, 100] },
              100
            ]
          }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]).toArray();

    // 6. 24-hour heatmap data
    const heatmapData = await db.collection('webhook_queue').aggregate([
      {
        $match: {
          queuedAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $hour: '$queuedAt'
          },
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
      {
        $sort: { _id: 1 }
      }
    ]).toArray();

    // 7. Calculate system health
    const currentBacklog = await db.collection('webhook_queue').countDocuments({ 
      status: 'pending' 
    });
    
    const stuckWebhooks = await db.collection('webhook_queue').countDocuments({
      status: 'pending',
      queuedAt: { $lte: new Date(now.getTime() - 5 * 60 * 1000) }
    });

    const performanceSummary = performanceData[0].summary[0] || {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      avgProcessingTime: 0
    };

    const successRate = performanceSummary.totalProcessed > 0 
      ? (performanceSummary.successCount / performanceSummary.totalProcessed) * 100 
      : 100;

    let healthScore = 100;
    const issues = [];
    const recommendations = [];

    if (successRate < 99) {
      healthScore -= 10;
      issues.push(`Success rate below 99% (${successRate.toFixed(1)}%)`);
    }
    if (successRate < 95) {
      healthScore -= 15;
      recommendations.push('Investigate failing webhooks - check error logs');
    }
    if (currentBacklog > 100) {
      healthScore -= 10;
      issues.push(`${currentBacklog} webhooks in backlog`);
    }
    if (currentBacklog > 500) {
      healthScore -= 15;
      recommendations.push('High backlog detected - scale up processors');
    }
    if (stuckWebhooks > 0) {
      healthScore -= 20;
      issues.push(`${stuckWebhooks} stuck webhooks detected`);
      recommendations.push('Clear stuck webhooks - check for processing errors');
    }

    const systemHealth = {
      status: healthScore >= 85 ? 'healthy' : healthScore >= 70 ? 'degraded' : 'critical',
      score: Math.max(0, healthScore),
      issues,
      recommendations
    };

    // 8. Build enhanced queue metrics
    const queueTypes = ['critical', 'messages', 'appointments', 'contacts', 'projects', 'financial', 'general'];
    const queueMetrics = queueTypes.map(queueType => {
      const currentStats = queueStats[0].current.filter(s => s._id.queueType === queueType);
      const historicalStats = queueStats[0].historical.filter(s => s._id.queueType === queueType);
      const sparkline = queueStats[0].sparklineData.filter(s => s._id.queueType === queueType);
      
      const pending = currentStats.find(s => s._id.status === 'pending')?.count || 0;
      const processing = currentStats.find(s => s._id.status === 'processing')?.count || 0;
      const completed = historicalStats.find(s => s._id.status === 'completed')?.count || 0;
      const failed = historicalStats.find(s => s._id.status === 'failed')?.count || 0;
      
      const completedStats = historicalStats.find(s => s._id.status === 'completed') || {};
      const total = completed + failed;
      const successRate = total > 0 ? (completed / total) * 100 : 100;
      
      // Build sparkline data (24 hours)
      const sparklineArray = [];
      for (let i = 0; i < 24; i++) {
        const dataPoint = sparkline.find(s => s._id.hour === i);
        sparklineArray.push(dataPoint?.count || 0);
      }
      
      return {
        name: queueType,
        pending,
        processing,
        completed,
        failed,
        total,
        successRate: Math.round(successRate * 100) / 100,
        avgProcessingTime: completedStats.avgProcessingTime || 0,
        minProcessingTime: completedStats.minProcessingTime || 0,
        maxProcessingTime: completedStats.maxProcessingTime || 0,
        avgWaitTime: currentStats.find(s => s._id.status === 'pending')?.avgWaitTime || 0,
        oldestPending: currentStats.find(s => s._id.status === 'pending')?.oldestItem || null,
        throughput: Math.round((total / ((now.getTime() - startDate.getTime()) / (1000 * 60 * 60))) || 0),
        sparklineData: sparklineArray,
        trend: pending > 50 || failed > total * 0.1 ? 'degrading' : 
               pending < 10 && successRate > 98 ? 'improving' : 'stable',
        health: pending > 100 || failed > total * 0.1 ? 'critical' :
                pending > 50 || failed > total * 0.05 ? 'warning' : 'healthy'
      };
    });

    // 9. Generate performance insights
    const insights = [];
    const fastestQueue = queueMetrics.reduce((a, b) => 
      (a.avgProcessingTime > 0 && a.avgProcessingTime < b.avgProcessingTime) ? a : b
    );
    const slowestQueue = queueMetrics.reduce((a, b) => 
      a.avgProcessingTime > b.avgProcessingTime ? a : b
    );
    
    // Performance insights
    if (performanceSummary.avgProcessingTime < 1000) {
      insights.push('🚀 Excellent performance! Average processing under 1 second.');
    }
    if (fastestQueue.avgProcessingTime > 0) {
      insights.push(`⚡ ${fastestQueue.name} is your fastest queue at ${Math.round(fastestQueue.avgProcessingTime)}ms average.`);
    }
    if (slowestQueue.avgProcessingTime > 5000) {
      insights.push(`🐌 ${slowestQueue.name} queue is slow at ${(slowestQueue.avgProcessingTime / 1000).toFixed(1)}s - investigate bottlenecks.`);
    }
    
    // Volume insights
    const totalWebhooksToday = queueMetrics.reduce((sum, q) => sum + q.total, 0);
    if (totalWebhooksToday > 1000) {
      insights.push(`📈 High volume day! ${totalWebhooksToday.toLocaleString()} webhooks processed.`);
    }
    
    // Error insights
    if (errorAnalysis.length > 0) {
      insights.push(`⚠️ Most common error: ${errorAnalysis[0]._id.error} (${errorAnalysis[0].count} times)`);
    } else if (successRate === 100) {
      insights.push('✨ Perfect score! 100% success rate!');
    }
    
    // Cost estimate (rough calculation)
    const estimatedCost = (totalWebhooksToday * 0.0001).toFixed(2);
    insights.push(`💰 Estimated cost: $${estimatedCost} for ${range} period.`);

    // 10. Build complete response
    const response = {
      timestamp: new Date(),
      timeRange: range,
      systemHealth,
      queues: queueMetrics,
      performance: {
        timeRange: {
          start: startDate,
          end: now,
          label: range
        },
        summary: {
          totalWebhooks: performanceSummary.totalProcessed,
          successCount: performanceSummary.successCount,
          failureCount: performanceSummary.failureCount,
          successRate: Math.round(successRate * 100) / 100,
          avgProcessingTime: Math.round(performanceSummary.avgProcessingTime || 0),
          minProcessingTime: Math.round(performanceSummary.minProcessingTime || 0),
          maxProcessingTime: Math.round(performanceSummary.maxProcessingTime || 0),
          currentBacklog,
          stuckWebhooks
        },
        timeSeries: performanceData[0].timeSeries
      },
      errors: {
        summary: {
          totalErrors: errorAnalysis.reduce((sum, e) => sum + e.count, 0),
          uniqueErrors: errorAnalysis.length,
          errorRate: performanceSummary.totalProcessed > 0 
            ? Math.round((performanceSummary.failureCount / performanceSummary.totalProcessed) * 10000) / 100
            : 0
        },
        topErrors: errorAnalysis.map(e => ({
          type: e._id.type,
          error: e._id.error,
          count: e.count,
          affectedQueues: e.queueTypes,
          lastSeen: e.lastOccurrence,
          avgRetries: Math.round(e.avgRetries * 10) / 10
        }))
      },
      webhookTypes: webhookTypes.map(t => ({
        type: t._id,
        count: t.count,
        completed: t.completed,
        failed: t.failed,
        pending: t.pending,
        successRate: Math.round(t.successRate * 100) / 100
      })),
      recentActivity: recentActivity.map(a => ({
        type: a.type,
        status: a.status,
        queue: a.queueType,
        processingTime: a.processingStarted && a.processingCompleted 
          ? new Date(a.processingCompleted).getTime() - new Date(a.processingStarted).getTime()
          : null,
        completedAt: a.processingCompleted,
        error: a.status === 'failed' ? (a.lastError || 'Unknown error') : null
      })),
      heatmap: heatmapData,
      insights,
      slaCompliance: {
        overall: Math.round(queueMetrics.reduce((sum, q) => {
          const slaTarget = {
            critical: 30000,
            messages: 2000,
            appointments: 60000,
            contacts: 60000,
            projects: 60000,
            financial: 30000,
            general: 120000
          }[q.name] || 120000;
          
          const compliance = q.avgProcessingTime > 0 
            ? Math.min(100, (slaTarget / q.avgProcessingTime) * 100)
            : 100;
          
          return sum + compliance;
        }, 0) / queueMetrics.length)
      }
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[Analytics Dashboard] Error:', error);
    return res.status(500).json({ error: 'Failed to generate analytics' });
  }
}