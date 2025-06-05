// pages/api/analytics/installs/[locationId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../../src/lib/mongodb';

interface InstallStep {
  name: string;
  duration: number;
  status: 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  error?: string;
  retries?: number;
}

interface InstallAnalytics {
  locationId: string;
  locationName: string;
  installHistory: {
    totalInstalls: number;
    successfulInstalls: number;
    failedInstalls: number;
    averageDuration: number;
    lastInstall: Date | null;
  };
  currentInstall?: {
    status: string;
    startTime: Date;
    duration: number;
    steps: InstallStep[];
    bottlenecks: string[];
    estimatedCompletion?: Date;
  };
  performanceAnalysis: {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    score: number;
    comparison: string;
    percentile: number;
  };
  recommendations: string[];
  historicalTrends: {
    date: string;
    duration: number;
    success: boolean;
  }[];
  comparisonMetrics: {
    vsAverage: number; // percentage
    vsLastWeek: number; // percentage
    vsSimilarLocations: number; // percentage
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId } = req.query;

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Location ID is required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // 1. Get location details
    const location = await db.collection('locations').findOne({ locationId });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // 2. Get install webhooks for this location
    const installWebhooks = await db.collection('webhook_metrics')
      .find({
        locationId,
        type: { $in: ['INSTALL', 'UNINSTALL', 'LocationUpdate'] }
      })
      .sort({ 'timestamps.routerReceived': -1 })
      .limit(50)
      .toArray();

    // 3. Get setup results if available
    const setupResults = location.setupResults || null;

    // 4. Calculate install history
    const installHistory = {
      totalInstalls: installWebhooks.filter(w => w.type === 'INSTALL').length,
      successfulInstalls: installWebhooks.filter(w => w.type === 'INSTALL' && w.success).length,
      failedInstalls: installWebhooks.filter(w => w.type === 'INSTALL' && !w.success).length,
      averageDuration: calculateAverageDuration(installWebhooks),
      lastInstall: location.installedAt || null
    };

    // 5. Analyze current/latest install
    let currentInstall;
    if (setupResults) {
      const steps = analyzeSetupSteps(setupResults);
      currentInstall = {
        status: location.setupCompleted ? 'completed' : 'in_progress',
        startTime: new Date(setupResults.startedAt),
        duration: setupResults.duration ? parseInt(setupResults.duration) : 0,
        steps: steps,
        bottlenecks: identifyInstallBottlenecks(steps),
        estimatedCompletion: estimateCompletion(steps, location)
      };
    }

    // 6. Get all installs across system for comparison
    const allInstalls = await db.collection('webhook_metrics')
      .aggregate([
        {
          $match: {
            type: 'INSTALL',
            'timestamps.processingCompleted': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$metrics.totalEndToEnd' },
            durations: { $push: '$metrics.totalEndToEnd' }
          }
        }
      ])
      .toArray();

    // 7. Calculate performance grade
    const performanceAnalysis = calculatePerformanceGrade(
      currentInstall?.duration || 0,
      allInstalls[0] || { avgDuration: 5000, durations: [] }
    );

    // 8. Generate recommendations
    const recommendations = generateInstallRecommendations(
      location,
      currentInstall,
      performanceAnalysis
    );

    // 9. Get historical trends
    const historicalTrends = await getHistoricalTrends(db, locationId);

    // 10. Calculate comparison metrics
    const comparisonMetrics = await calculateComparisonMetrics(
      db,
      locationId,
      currentInstall?.duration || 0,
      historicalTrends
    );

    // Build response
    const analytics: InstallAnalytics = {
      locationId,
      locationName: location.name || 'Unknown Location',
      installHistory,
      currentInstall,
      performanceAnalysis,
      recommendations,
      historicalTrends,
      comparisonMetrics
    };

    return res.status(200).json(analytics);

  } catch (error: any) {
    console.error('[Install Analytics] Error:', error);
    return res.status(500).json({ error: 'Failed to generate install analytics' });
  }
}

// Helper Functions

function calculateAverageDuration(webhooks: any[]): number {
  const installs = webhooks.filter(w => w.type === 'INSTALL' && w.metrics?.totalEndToEnd);
  if (installs.length === 0) return 0;
  
  const total = installs.reduce((sum, w) => sum + w.metrics.totalEndToEnd, 0);
  return Math.round(total / installs.length);
}

function analyzeSetupSteps(setupResults: any): InstallStep[] {
  const steps: InstallStep[] = [];
  
  const stepOrder = [
    'locationDetails',
    'pipelines',
    'calendars',
    'users',
    'customFields',
    'customValues',
    'contacts',
    'opportunities',
    'appointments',
    'conversations',
    'invoices',
    'defaults'
  ];

  const startTime = new Date(setupResults.startedAt);
  let cumulativeTime = 0;

  stepOrder.forEach(stepName => {
    const stepData = setupResults.steps[stepName];
    if (!stepData) return;

    const duration = stepData.duration || estimateStepDuration(stepName, stepData);
    const stepStart = new Date(startTime.getTime() + cumulativeTime);
    const stepEnd = new Date(stepStart.getTime() + duration);

    steps.push({
      name: formatStepName(stepName),
      duration: duration,
      status: stepData.success ? 'success' : 'failed',
      startTime: stepStart,
      endTime: stepEnd,
      error: stepData.error,
      retries: stepData.retries || 0
    });

    cumulativeTime += duration;
  });

  return steps;
}

function formatStepName(stepName: string): string {
  const nameMap: Record<string, string> = {
    locationDetails: 'Location Configuration',
    pipelines: 'Pipeline Sync',
    calendars: 'Calendar Integration',
    users: 'User Setup',
    customFields: 'Custom Field Mapping',
    customValues: 'Custom Values Import',
    contacts: 'Contact Import',
    opportunities: 'Opportunity Sync',
    appointments: 'Appointment Sync',
    conversations: 'Conversation History',
    invoices: 'Invoice Import',
    defaults: 'Default Settings'
  };
  
  return nameMap[stepName] || stepName;
}

function estimateStepDuration(stepName: string, stepData: any): number {
  // Estimate based on typical durations
  const estimates: Record<string, number> = {
    locationDetails: 500,
    pipelines: 1000,
    calendars: 800,
    users: 1200,
    customFields: 600,
    customValues: 400,
    contacts: 5000, // Usually the longest
    opportunities: 3000,
    appointments: 2000,
    conversations: 4000,
    invoices: 1500,
    defaults: 300
  };
  
  return estimates[stepName] || 1000;
}

function identifyInstallBottlenecks(steps: InstallStep[]): string[] {
  const bottlenecks: string[] = [];
  const avgDuration = steps.reduce((sum, s) => sum + s.duration, 0) / steps.length;
  
  // Find steps that took more than 2x average
  steps.forEach(step => {
    if (step.duration > avgDuration * 2) {
      bottlenecks.push(`${step.name} took ${Math.round(step.duration / 1000)}s (${Math.round(step.duration / avgDuration)}x average)`);
    }
  });
  
  // Find failed steps
  steps.filter(s => s.status === 'failed').forEach(step => {
    bottlenecks.push(`${step.name} failed: ${step.error || 'Unknown error'}`);
  });
  
  return bottlenecks;
}

function estimateCompletion(steps: InstallStep[], location: any): Date | undefined {
  if (location.setupCompleted) return undefined;
  
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const totalSteps = steps.length;
  const percentComplete = completedSteps / totalSteps;
  
  if (percentComplete === 0) return undefined;
  
  const elapsedTime = Date.now() - steps[0].startTime.getTime();
  const estimatedTotalTime = elapsedTime / percentComplete;
  const remainingTime = estimatedTotalTime - elapsedTime;
  
  return new Date(Date.now() + remainingTime);
}

function calculatePerformanceGrade(duration: number, allInstalls: any): any {
  const avgDuration = allInstalls.avgDuration || 5000;
  const durations = allInstalls.durations || [];
  
  // Calculate percentile
  const faster = durations.filter((d: number) => d > duration).length;
  const percentile = Math.round((faster / durations.length) * 100) || 50;
  
  // Calculate score (0-100)
  let score = 100;
  if (duration > avgDuration) {
    score = Math.max(0, 100 - ((duration - avgDuration) / avgDuration) * 50);
  }
  
  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  
  // Comparison text
  let comparison = '';
  if (duration < avgDuration * 0.5) {
    comparison = 'Exceptional! 2x faster than average';
  } else if (duration < avgDuration * 0.75) {
    comparison = 'Excellent! Significantly faster than average';
  } else if (duration < avgDuration) {
    comparison = 'Good! Faster than average';
  } else if (duration < avgDuration * 1.25) {
    comparison = 'Average performance';
  } else if (duration < avgDuration * 1.5) {
    comparison = 'Below average - room for improvement';
  } else {
    comparison = 'Significantly slower than average';
  }
  
  return {
    grade,
    score: Math.round(score),
    comparison,
    percentile
  };
}

function generateInstallRecommendations(location: any, currentInstall: any, performance: any): string[] {
  const recommendations: string[] = [];
  
  // Performance-based recommendations
  if (performance.score < 70) {
    recommendations.push('🚀 Consider running installs during off-peak hours for better performance');
  }
  
  // Bottleneck-based recommendations
  if (currentInstall?.bottlenecks.length > 0) {
    if (currentInstall.bottlenecks.some((b: string) => b.includes('Contact Import'))) {
      recommendations.push('📊 Contact import is slow. Consider batching contacts in smaller groups');
    }
    if (currentInstall.bottlenecks.some((b: string) => b.includes('Conversation History'))) {
      recommendations.push('💬 Conversation sync is taking long. You may want to limit historical data import');
    }
  }
  
  // Setup-based recommendations
  if (!location.termsAndConditions) {
    recommendations.push('📝 Add Terms & Conditions to complete your setup');
  }
  if (!location.branding) {
    recommendations.push('🎨 Configure branding for a professional appearance');
  }
  if (!location.emailTemplates?.contractSigned) {
    recommendations.push('✉️ Set up email templates for automated communications');
  }
  
  // OAuth recommendations
  if (location.ghlOAuth?.needsReauth) {
    recommendations.push('🔑 OAuth token needs refresh - re-authenticate to maintain sync');
  }
  
  return recommendations;
}

async function getHistoricalTrends(db: any, locationId: string): Promise<any[]> {
  const trends = await db.collection('webhook_metrics')
    .find({
      locationId,
      type: 'INSTALL',
      'timestamps.processingCompleted': { $exists: true }
    })
    .sort({ 'timestamps.routerReceived': -1 })
    .limit(10)
    .toArray();
  
  return trends.map(t => ({
    date: new Date(t.timestamps.routerReceived).toISOString().split('T')[0],
    duration: t.metrics.totalEndToEnd || 0,
    success: t.success
  }));
}

async function calculateComparisonMetrics(db: any, locationId: string, currentDuration: number, trends: any[]): Promise<any> {
  // vs Average
  const avgDuration = await db.collection('webhook_metrics')
    .aggregate([
      { $match: { type: 'INSTALL', success: true } },
      { $group: { _id: null, avg: { $avg: '$metrics.totalEndToEnd' } } }
    ])
    .toArray();
  
  const vsAverage = avgDuration[0] ? 
    Math.round(((currentDuration - avgDuration[0].avg) / avgDuration[0].avg) * 100) : 0;
  
  // vs Last Week
  const lastWeekTrends = trends.filter(t => {
    const date = new Date(t.date);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  });
  
  const lastWeekAvg = lastWeekTrends.length > 0 ?
    lastWeekTrends.reduce((sum, t) => sum + t.duration, 0) / lastWeekTrends.length : currentDuration;
  
  const vsLastWeek = Math.round(((currentDuration - lastWeekAvg) / lastWeekAvg) * 100);
  
  // vs Similar Locations (same company)
  const location = await db.collection('locations').findOne({ locationId });
  let vsSimilarLocations = 0;
  
  if (location?.companyId) {
    const similarInstalls = await db.collection('webhook_metrics')
      .aggregate([
        {
          $match: {
            type: 'INSTALL',
            success: true,
            locationId: { $ne: locationId }
          }
        },
        {
          $lookup: {
            from: 'locations',
            localField: 'locationId',
            foreignField: 'locationId',
            as: 'location'
          }
        },
        {
          $match: {
            'location.companyId': location.companyId
          }
        },
        {
          $group: {
            _id: null,
            avg: { $avg: '$metrics.totalEndToEnd' }
          }
        }
      ])
      .toArray();
    
    if (similarInstalls[0]) {
      vsSimilarLocations = Math.round(((currentDuration - similarInstalls[0].avg) / similarInstalls[0].avg) * 100);
    }
  }
  
  return {
    vsAverage,
    vsLastWeek,
    vsSimilarLocations
  };
}