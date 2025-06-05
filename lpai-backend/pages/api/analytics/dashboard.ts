// pages/api/analytics/dashboard.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

interface QueueMetrics {
  name: string;
  depth: number;
  processing: number;
  avgWaitTime: number;
  throughput: number;
  errorRate: number;
  slaCompliance: number;
  trend: 'improving' | 'stable' | 'degrading';
}

interface PerformanceMetrics {
  last5Minutes: {
    received: number;
    processed: number;
    failed: number;
    avgProcessingTime: number;
  };
  lastHour: {
    received: number;
    processed: number;
    failed: number;
    avgProcessingTime: number;
    peakThroughput: number;
  };
  last24Hours: {
    received: number;
    processed: number;
    failed: number;
    avgProcessingTime: number;
    peakThroughput: number;
    totalCost: number; // Estimated processing cost
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get current time markers
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Queue Health Metrics
    const queueStats = await db.collection('webhook_queue').aggregate([
      {
        $facet: {
          byQueue: [
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
                      { $subtract: [now, '$receivedAt'] },
                      null
                    ]
                  }
                }
              }
            },
            {
              $group: {
                _id: '$_id.queueType',
                pending: {
                  $sum: {
                    $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0]
                  }
                },
                processing: {
                  $sum: {
                    $cond: [{ $eq: ['$_id.status', 'processing'] }, '$count', 0]
                  }
                },
                completed: {
                  $sum: {
                    $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0]
                  }
                },
                failed: {
                  $sum: {
                    $cond: [{ $eq: ['$_id.status', 'failed'] }, '$count', 0]
                  }
                },
                avgWaitTime: { $avg: '$avgWaitTime' }
              }
            }
          ],
          oldestPending: [
            { $match: { status: 'pending' } },
            { $sort: { receivedAt: 1 } },
            { $limit: 1 },
            {
              $project: {
                queueType: 1,
                waitTime: { $subtract: [now, '$receivedAt'] }
              }
            }
          ]
        }
      }
    ]).toArray();

    // 2. Performance Metrics from webhook_metrics
    const performanceData = await db.collection('webhook_metrics').aggregate([
      {
        $facet: {
          last5Minutes: [
            { $match: { 'timestamps.routerReceived': { $gte: fiveMinutesAgo } } },
            {
              $group: {
                _id: null,
                received: { $sum: 1 },
                processed: { $sum: { $cond: ['$success', 1, 0] } },
                failed: { $sum: { $cond: ['$success', 0, 1] } },
                avgProcessingTime: { $avg: '$metrics.totalEndToEnd' }
              }
            }
          ],
          lastHour: [
            { $match: { 'timestamps.routerReceived': { $gte: oneHourAgo } } },
            {
              $group: {
                _id: {
                  minute: {
                    $dateToString: {
                      format: '%Y-%m-%d %H:%M',
                      date: '$timestamps.routerReceived'
                    }
                  }
                },
                count: { $sum: 1 },
                processed: { $sum: { $cond: ['$success', 1, 0] } },
                failed: { $sum: { $cond: ['$success', 0, 1] } },
                avgTime: { $avg: '$metrics.totalEndToEnd' }
              }
            },
            {
              $group: {
                _id: null,
                received: { $sum: '$count' },
                processed: { $sum: '$processed' },
                failed: { $sum: '$failed' },
                avgProcessingTime: { $avg: '$avgTime' },
                peakThroughput: { $max: '$count' }
              }
            }
          ],
          last24Hours: [
            { $match: { 'timestamps.routerReceived': { $gte: oneDayAgo } } },
            {
              $group: {
                _id: {
                  hour: {
                    $dateToString: {
                      format: '%Y-%m-%d %H:00',
                      date: '$timestamps.routerReceived'
                    }
                  }
                },
                count: { $sum: 1 },
                processed: { $sum: { $cond: ['$success', 1, 0] } },
                failed: { $sum: { $cond: ['$success', 0, 1] } },
                avgTime: { $avg: '$metrics.totalEndToEnd' }
              }
            },
            {
              $group: {
                _id: null,
                received: { $sum: '$count' },
                processed: { $sum: '$processed' },
                failed: { $sum: '$failed' },
                avgProcessingTime: { $avg: '$avgTime' },
                peakThroughput: { $max: '$count' }
              }
            }
          ]
        }
      }
    ]).toArray();

    // 3. Error Analysis
    const errorAnalysis = await db.collection('webhook_queue').aggregate([
      { $match: { status: 'failed', failedAt: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: {
            type: '$type',
            error: '$lastError'
          },
          count: { $sum: 1 },
          lastOccurrence: { $max: '$failedAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // 4. SLA Compliance (define your SLAs)
    const slaTargets = {
      messages: 2000, // 2 seconds
      appointments: 30000, // 30 seconds
      contacts: 60000, // 60 seconds
      financial: 30000, // 30 seconds
      general: 120000 // 2 minutes
    };

    const slaCompliance = await db.collection('webhook_metrics').aggregate([
      { $match: { 'timestamps.routerReceived': { $gte: oneHourAgo } } },
      {
        $group: {
          _id: '$queueType',
          total: { $sum: 1 },
          withinSLA: {
            $sum: {
              $cond: [
                {
                  $lte: [
                    '$metrics.totalEndToEnd',
                    { $ifNull: [slaTargets['$queueType'], 120000] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          queueType: '$_id',
          compliance: {
            $multiply: [{ $divide: ['$withinSLA', '$total'] }, 100]
          }
        }
      }
    ]).toArray();

    // 5. Build Queue Metrics
    const queueMetrics: QueueMetrics[] = queueStats[0].byQueue.map((queue: any) => {
      const sla = slaCompliance.find(s => s.queueType === queue._id) || { compliance: 100 };
      const throughput = performanceData[0].lastHour[0]?.received || 0;
      const errorRate = queue.failed / (queue.completed + queue.failed) * 100 || 0;

      return {
        name: queue._id,
        depth: queue.pending,
        processing: queue.processing,
        avgWaitTime: Math.round(queue.avgWaitTime || 0),
        throughput: Math.round(throughput / 60), // per minute
        errorRate: Math.round(errorRate * 100) / 100,
        slaCompliance: Math.round(sla.compliance * 100) / 100,
        trend: determineTrend(queue, errorRate)
      };
    });

    // 6. Calculate System Health
    const systemHealth = calculateSystemHealth(queueMetrics, errorAnalysis);

    // 7. Build Performance Metrics
    const performance: PerformanceMetrics = {
      last5Minutes: performanceData[0].last5Minutes[0] || {
        received: 0,
        processed: 0,
        failed: 0,
        avgProcessingTime: 0
      },
      lastHour: performanceData[0].lastHour[0] || {
        received: 0,
        processed: 0,
        failed: 0,
        avgProcessingTime: 0,
        peakThroughput: 0
      },
      last24Hours: {
        ...(performanceData[0].last24Hours[0] || {
          received: 0,
          processed: 0,
          failed: 0,
          avgProcessingTime: 0,
          peakThroughput: 0
        }),
        totalCost: calculateProcessingCost(performanceData[0].last24Hours[0]?.received || 0)
      }
    };

    // 8. Top Bottlenecks
    const bottlenecks = await identifyBottlenecks(db, oneHourAgo);

    // 9. Predictive Analytics
    const predictions = await generatePredictions(db, queueMetrics, performance);

    // Build the response
    const dashboard = {
      timestamp: new Date(),
      systemHealth,
      queues: queueMetrics,
      performance,
      errors: {
        topErrors: errorAnalysis.map(e => ({
          type: e._id.type,
          error: e._id.error,
          count: e.count,
          lastSeen: e.lastOccurrence
        })),
        errorRate: performance.lastHour.failed / performance.lastHour.received * 100 || 0
      },
      slaCompliance: {
        overall: queueMetrics.reduce((acc, q) => acc + q.slaCompliance, 0) / queueMetrics.length || 100,
        byQueue: Object.fromEntries(queueMetrics.map(q => [q.name, q.slaCompliance]))
      },
      bottlenecks,
      predictions,
      insights: generateInsights(systemHealth, queueMetrics, performance, errorAnalysis)
    };

    return res.status(200).json(dashboard);

  } catch (error: any) {
    console.error('[Analytics Dashboard] Error:', error);
    return res.status(500).json({ error: 'Failed to generate dashboard' });
  }
}

// Helper Functions

function calculateSystemHealth(queues: QueueMetrics[], errors: any[]): SystemHealth {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check queue depths
  queues.forEach(queue => {
    if (queue.depth > 1000) {
      score -= 10;
      issues.push(`${queue.name} queue has ${queue.depth} pending items`);
      recommendations.push(`Scale up ${queue.name} processors`);
    }
    if (queue.errorRate > 5) {
      score -= 15;
      issues.push(`${queue.name} error rate is ${queue.errorRate}%`);
    }
    if (queue.slaCompliance < 95) {
      score -= 5;
      issues.push(`${queue.name} SLA compliance is only ${queue.slaCompliance}%`);
    }
  });

  // Determine status
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (score < 70) status = 'critical';
  else if (score < 85) status = 'degraded';

  return {
    status,
    score: Math.max(0, score),
    issues,
    recommendations
  };
}

function determineTrend(queue: any, errorRate: number): 'improving' | 'stable' | 'degrading' {
  if (queue.pending > 500 || errorRate > 10) return 'degrading';
  if (queue.pending < 50 && errorRate < 2) return 'improving';
  return 'stable';
}

function calculateProcessingCost(webhooksProcessed: number): number {
  // Rough estimate: $0.001 per webhook (compute + database)
  return Math.round(webhooksProcessed * 0.001 * 100) / 100;
}

async function identifyBottlenecks(db: any, since: Date): Promise<any[]> {
  const slowWebhooks = await db.collection('webhook_metrics')
    .find({
      'timestamps.routerReceived': { $gte: since },
      'metrics.totalEndToEnd': { $gt: 10000 } // Over 10 seconds
    })
    .sort({ 'metrics.totalEndToEnd': -1 })
    .limit(5)
    .toArray();

  return slowWebhooks.map((w: any) => ({
    type: w.type,
    duration: w.metrics.totalEndToEnd,
    breakdown: w.metrics.stepDurations || {},
    webhookId: w.webhookId
  }));
}

async function generatePredictions(db: any, queues: QueueMetrics[], performance: PerformanceMetrics): Promise<any> {
  const currentRate = performance.lastHour.received / 60; // per minute
  const currentErrorRate = performance.lastHour.failed / performance.lastHour.received || 0;

  return {
    nextHour: {
      expectedWebhooks: Math.round(currentRate * 60),
      expectedFailures: Math.round(currentRate * 60 * currentErrorRate),
      queueGrowth: queues.map(q => ({
        queue: q.name,
        predictedDepth: Math.round(q.depth + (currentRate - q.throughput) * 60)
      }))
    },
    recommendations: [
      currentRate > 100 ? 'High load detected. Consider scaling processors.' : null,
      currentErrorRate > 0.05 ? 'Error rate above 5%. Investigate failures.' : null,
      queues.some(q => q.depth > 500) ? 'Queue backlog detected. Increase processing capacity.' : null
    ].filter(Boolean)
  };
}

function generateInsights(health: SystemHealth, queues: QueueMetrics[], performance: PerformanceMetrics, errors: any[]): string[] {
  const insights: string[] = [];

  // Performance insights
  if (performance.lastHour.avgProcessingTime < 1000) {
    insights.push('🚀 Excellent performance! Average processing under 1 second.');
  }

  // Queue insights
  const fastestQueue = queues.reduce((a, b) => a.avgWaitTime < b.avgWaitTime ? a : b);
  insights.push(`⚡ ${fastestQueue.name} is your fastest queue with ${fastestQueue.avgWaitTime}ms wait time.`);

  // Error insights
  if (errors.length > 0) {
    insights.push(`⚠️ Most common error: "${errors[0]._id.error}" (${errors[0].count} occurrences)`);
  }

  // Cost insights
  const dailyCost = performance.last24Hours.totalCost;
  const monthlyCost = dailyCost * 30;
  insights.push(`💰 Estimated monthly cost: $${monthlyCost.toFixed(2)} based on current usage.`);

  return insights;
}