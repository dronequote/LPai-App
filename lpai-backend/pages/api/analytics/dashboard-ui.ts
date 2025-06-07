// pages/api/analytics/dashboard-ui.ts - Complete updated UI

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

    // Get dashboard data with selected range
    const dashboardResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/analytics/dashboard?range=${range}`
    );
    const dashboardData = await dashboardResponse.json();

    // Get sample location for navigation
    const sampleLocation = await db.collection('locations')
      .findOne({ setupCompleted: true }, { projection: { locationId: 1 } });

    // Generate the sick UI
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LPai Webhook Analytics - The Shiznit Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * { font-family: 'Inter', sans-serif; }
        
        body {
            background: #0a0a0a;
            overflow-x: hidden;
        }

        #particles-js {
            position: fixed;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            z-index: 0;
        }

        .content-wrapper {
            position: relative;
            z-index: 1;
        }
        
        .glass {
            background: rgba(17, 25, 40, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.125);
        }
        
        .glass-dark {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .neon-text {
            text-shadow: 0 0 10px rgba(59, 130, 246, 0.5),
                         0 0 20px rgba(59, 130, 246, 0.5),
                         0 0 30px rgba(59, 130, 246, 0.5);
        }

        .neon-glow {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5),
                        inset 0 0 20px rgba(59, 130, 246, 0.1);
        }
        
        .health-ring {
            transform: rotate(-90deg);
            transform-origin: 50% 50%;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        .float {
            animation: float 3s ease-in-out infinite;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .slide-in {
            animation: slideIn 0.5s ease-out;
        }

        .metric-card {
            transition: all 0.3s ease;
        }
        
        .metric-card:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 10px 40px rgba(59, 130, 246, 0.3);
        }

        .health-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
        }

        .health-healthy { background: #10b981; box-shadow: 0 0 10px #10b981; }
        .health-warning { background: #f59e0b; box-shadow: 0 0 10px #f59e0b; }
        .health-critical { background: #ef4444; box-shadow: 0 0 10px #ef4444; }

        .sparkline {
            height: 30px;
            margin-top: 8px;
        }

        .activity-feed {
            max-height: 400px;
            overflow-y: auto;
        }

        .activity-feed::-webkit-scrollbar {
            width: 4px;
        }

        .activity-feed::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
        }

        .activity-feed::-webkit-scrollbar-thumb {
            background: rgba(59, 130, 246, 0.5);
            border-radius: 2px;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
        }

        ::-webkit-scrollbar-thumb {
            background: rgba(59, 130, 246, 0.5);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: rgba(59, 130, 246, 0.7);
        }

        .nav-link {
            transition: all 0.3s ease;
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .nav-link:hover {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(59, 130, 246, 0.5);
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(59, 130, 246, 0.3);
        }

        .chart-container {
            position: relative;
            height: 200px;
            max-height: 200px;
            overflow: hidden;
        }

        canvas {
            max-height: 200px !important;
        }

        .quick-stats {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
            border: 1px solid rgba(59, 130, 246, 0.3);
        }

        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }

        .shimmer {
            background: linear-gradient(90deg, 
                transparent 25%, 
                rgba(255, 255, 255, 0.1) 50%, 
                transparent 75%
            );
            background-size: 200% 100%;
            animation: shimmer 2s infinite;
        }
    </style>
</head>
<body class="text-white">
    <div id="particles-js"></div>
    
    <div class="content-wrapper min-h-screen p-6">
        <!-- Header with Date Range Selector -->
        <div class="mb-8 slide-in flex justify-between items-center">
            <div>
                <h1 class="text-5xl font-bold mb-2 neon-text">Webhook Analytics</h1>
                <p class="text-gray-400">Real-time system performance monitoring</p>
            </div>
            <div class="flex items-center gap-4">
                ${sampleLocation ? `
                <a href="/api/analytics/installs/${sampleLocation.locationId}/ui" 
                   class="nav-link px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Install Analytics
                </a>
                ` : ''}
                <div class="glass rounded-xl p-2 flex gap-2">
                    <button onclick="changeRange('hour')" class="px-4 py-2 rounded-lg transition-all ${range === 'hour' ? 'bg-blue-600' : 'hover:bg-white/10'}">Hour</button>
                    <button onclick="changeRange('today')" class="px-4 py-2 rounded-lg transition-all ${range === 'today' ? 'bg-blue-600' : 'hover:bg-white/10'}">Today</button>
                    <button onclick="changeRange('week')" class="px-4 py-2 rounded-lg transition-all ${range === 'week' ? 'bg-blue-600' : 'hover:bg-white/10'}">Week</button>
                    <button onclick="changeRange('month')" class="px-4 py-2 rounded-lg transition-all ${range === 'month' ? 'bg-blue-600' : 'hover:bg-white/10'}">Month</button>
                    <button onclick="changeRange('all')" class="px-4 py-2 rounded-lg transition-all ${range === 'all' ? 'bg-blue-600' : 'hover:bg-white/10'}">All Time</button>
                </div>
            </div>
        </div>

        <!-- Quick Stats Bar -->
        <div class="quick-stats rounded-xl p-4 mb-6 slide-in shimmer">
            <div class="flex items-center justify-around text-sm">
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">📨 Total:</span>
                    <span class="font-bold text-lg">${dashboardData.performance?.summary?.totalWebhooks || 0}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">✅ Success:</span>
                    <span class="font-bold text-lg text-green-500">${dashboardData.performance?.summary?.successCount || 0} (${dashboardData.performance?.summary?.successRate || 0}%)</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">❌ Failed:</span>
                    <span class="font-bold text-lg text-red-500">${dashboardData.performance?.summary?.failureCount || 0}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">⏱️ Avg:</span>
                    <span class="font-bold text-lg">${((dashboardData.performance?.summary?.avgProcessingTime || 0) / 1000).toFixed(1)}s</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">🔥 Fastest:</span>
                    <span class="font-bold text-lg">${((dashboardData.performance?.summary?.minProcessingTime || 0) / 1000).toFixed(2)}s</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400">📦 Backlog:</span>
                    <span class="font-bold text-lg ${dashboardData.performance?.summary?.currentBacklog > 100 ? 'text-yellow-500' : ''}">${dashboardData.performance?.summary?.currentBacklog || 0}</span>
                </div>
            </div>
        </div>

        <!-- System Health Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div class="glass rounded-xl p-6 metric-card slide-in neon-glow" style="animation-delay: 0.1s">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm text-gray-400 mb-1">System Health</h3>
                        <p class="text-3xl font-bold ${dashboardData.systemHealth?.status === 'healthy' ? 'text-green-500' : dashboardData.systemHealth?.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'}">
                            ${dashboardData.systemHealth?.status?.toUpperCase() || 'UNKNOWN'}
                        </p>
                    </div>
                    <div class="relative w-20 h-20 float">
                        <svg class="health-ring w-20 h-20">
                            <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="none" />
                            <circle cx="40" cy="40" r="36" 
                                stroke="${(dashboardData.systemHealth?.score || 0) > 85 ? '#10b981' : (dashboardData.systemHealth?.score || 0) > 70 ? '#f59e0b' : '#ef4444'}" 
                                stroke-width="8" 
                                fill="none"
                                stroke-dasharray="${(dashboardData.systemHealth?.score || 0) * 2.26} 226"
                                stroke-linecap="round" />
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-2xl font-bold">${dashboardData.systemHealth?.score || 0}</span>
                        </div>
                    </div>
                </div>
                ${dashboardData.systemHealth?.issues?.length > 0 ? `
                    <div class="mt-4 text-xs space-y-1">
                        ${dashboardData.systemHealth.issues.slice(0, 2).map(issue => `
                            <p class="text-yellow-400">⚠️ ${issue}</p>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.2s">
                <h3 class="text-sm text-gray-400 mb-1">Messages/Min</h3>
                <p class="text-3xl font-bold text-blue-500">${Math.round((dashboardData.performance?.summary?.totalWebhooks || 0) / 60) || 0}</p>
                <p class="text-sm text-gray-500 mt-2">
                    ${dashboardData.errors?.summary?.errorRate > 0 ? `${dashboardData.errors.summary.errorRate}% error rate` : 'No errors'}
                </p>
                <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full shimmer" style="width: 75%"></div>
                </div>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.3s">
                <h3 class="text-sm text-gray-400 mb-1">Success Rate</h3>
                <p class="text-3xl font-bold ${dashboardData.performance?.summary?.successRate >= 99 ? 'text-green-500' : dashboardData.performance?.summary?.successRate >= 95 ? 'text-yellow-500' : 'text-red-500'}">
                    ${dashboardData.performance?.summary?.successRate || 100}%
                </p>
                <p class="text-sm text-gray-500 mt-2">${dashboardData.performance?.summary?.failureCount || 0} failures</p>
                <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 rounded-full" style="width: ${dashboardData.performance?.summary?.successRate || 100}%"></div>
                </div>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.4s">
                <h3 class="text-sm text-gray-400 mb-1">Avg Processing</h3>
                <p class="text-3xl font-bold text-purple-500">${Math.round(dashboardData.performance?.summary?.avgProcessingTime || 0)}ms</p>
                <p class="text-sm text-gray-500 mt-2">SLA: < 2000ms</p>
                <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-purple-500 rounded-full" style="width: ${Math.min(100, ((dashboardData.performance?.summary?.avgProcessingTime || 0) / 2000) * 100)}%"></div>
                </div>
            </div>
        </div>

        <!-- Main Dashboard Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Enhanced Queue Status -->
            <div class="glass rounded-xl p-6 slide-in lg:col-span-2" style="animation-delay: 0.5s">
                <h2 class="text-xl font-semibold mb-4">Queue Status</h2>
                <div class="space-y-4 max-h-96 overflow-y-auto">
                    ${(dashboardData.queues || []).map((queue, index) => {
                        const healthClass = queue.health === 'critical' ? 'health-critical' : 
                                          queue.health === 'warning' ? 'health-warning' : 
                                          'health-healthy';
                        
                        return `
                            <div class="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-blue-500/30">
                                <div class="flex items-start justify-between mb-3">
                                    <div class="flex items-center">
                                        <span class="health-indicator ${healthClass}"></span>
                                        <h3 class="font-medium capitalize text-lg">${queue.name}</h3>
                                    </div>
                                    <div class="flex items-center gap-6 text-sm">
                                        <div class="text-center">
                                            <p class="text-gray-400">Pending</p>
                                            <p class="font-bold text-yellow-500">${queue.pending}</p>
                                        </div>
                                        <div class="text-center">
                                            <p class="text-gray-400">Processing</p>
                                            <p class="font-bold text-blue-500">${queue.processing}</p>
                                        </div>
                                        <div class="text-center">
                                            <p class="text-gray-400">Completed</p>
                                            <p class="font-bold text-green-500">${queue.completed}</p>
                                        </div>
                                        <div class="text-center">
                                            <p class="text-gray-400">Failed</p>
                                            <p class="font-bold text-red-500">${queue.failed}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="grid grid-cols-4 gap-4 text-xs mb-3">
                                    <div>
                                        <p class="text-gray-400">Success Rate</p>
                                        <p class="font-bold ${queue.successRate >= 98 ? 'text-green-500' : queue.successRate >= 95 ? 'text-yellow-500' : 'text-red-500'}">
                                            ${queue.successRate}%
                                        </p>
                                    </div>
                                    <div>
                                        <p class="text-gray-400">Avg Time</p>
                                        <p class="font-bold">${(queue.avgProcessingTime / 1000).toFixed(1)}s</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-400">Min/Max</p>
                                        <p class="font-bold">${(queue.minProcessingTime / 1000).toFixed(1)}s/${(queue.maxProcessingTime / 1000).toFixed(1)}s</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-400">Rate</p>
                                        <p class="font-bold">${queue.throughput}/hr</p>
                                    </div>
                                </div>
                                
                                <div class="sparkline">
                                    <canvas id="sparkline-${queue.name}" height="30"></canvas>
                                </div>
                                
                                <div class="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div class="h-full flex">
                                        ${queue.completed > 0 ? `<div class="bg-green-500" style="width: ${(queue.completed / (queue.total || 1)) * 100}%"></div>` : ''}
                                        ${queue.failed > 0 ? `<div class="bg-red-500" style="width: ${(queue.failed / (queue.total || 1)) * 100}%"></div>` : ''}
                                        ${queue.processing > 0 ? `<div class="bg-blue-500" style="width: ${(queue.processing / (queue.total || 1)) * 100}%"></div>` : ''}
                                        ${queue.pending > 0 ? `<div class="bg-yellow-500" style="width: ${(queue.pending / (queue.total || 1)) * 100}%"></div>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Live Activity Feed -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.6s">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-semibold">Live Activity</h2>
                    <span class="flex items-center gap-2">
                        <span class="w-2 h-2 bg-green-500 rounded-full pulse"></span>
                        <span class="text-sm text-gray-400">Live</span>
                    </span>
                </div>
                <div class="activity-feed space-y-2">
                    ${dashboardData.recentActivity?.length > 0 ? dashboardData.recentActivity.map(activity => {
                        const time = new Date(activity.completedAt).toLocaleTimeString();
                        const icon = activity.status === 'completed' ? '✅' : '❌';
                        const timeStr = activity.processingTime ? `${(activity.processingTime / 1000).toFixed(1)}s` : 'N/A';
                        
                        return `
                            <div class="flex items-start gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-xs">
                                <span class="text-lg">${icon}</span>
                                <div class="flex-1">
                                    <p class="font-medium">${activity.type}</p>
                                    <p class="text-gray-400">${time} • ${activity.queue} • ${timeStr}</p>
                                    ${activity.error ? `<p class="text-red-400 mt-1">${activity.error}</p>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('') : '<p class="text-gray-400 text-center py-8">No recent activity</p>'}
                </div>
            </div>
        </div>

        <!-- Performance and Error Tracking Row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Performance Trend -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.7s">
                <h2 class="text-xl font-semibold mb-4">Performance Trend</h2>
                <div class="chart-container">
                    <canvas id="performanceChart"></canvas>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-blue-500">${dashboardData.performance?.summary?.totalWebhooks || 0}</p>
                        <p class="text-sm text-gray-400">Total ${dashboardData.timeRange || 'Today'}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-green-500">$${((dashboardData.performance?.summary?.totalWebhooks || 0) * 0.0001).toFixed(2)}</p>
                        <p class="text-sm text-gray-400">Est. Cost</p>
                    </div>
                </div>
            </div>

            <!-- Error Tracking -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.8s">
                <h2 class="text-xl font-semibold mb-4">Error Tracking</h2>
                <div class="mb-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p class="text-2xl font-bold text-red-500">${dashboardData.errors?.summary?.totalErrors || 0}</p>
                        <p class="text-xs text-gray-400">Total</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-yellow-500">${dashboardData.errors?.summary?.uniqueErrors || 0}</p>
                        <p class="text-xs text-gray-400">Unique</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold ${(dashboardData.errors?.summary?.errorRate || 0) < 1 ? 'text-green-500' : 'text-red-500'}">
                            ${(dashboardData.errors?.summary?.errorRate || 0).toFixed(1)}%
                        </p>
                        <p class="text-xs text-gray-400">Rate</p>
                    </div>
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                    ${(dashboardData.errors?.topErrors || []).length > 0 ? dashboardData.errors.topErrors.map(error => `
                        <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <p class="font-medium text-sm">${error.type}</p>
                                    <p class="text-xs text-gray-400 mt-1">${error.error}</p>
                                    <p class="text-xs text-gray-500 mt-1">Avg ${error.avgRetries} retries • ${error.affectedQueues.join(', ')}</p>
                                </div>
                                <div class="text-right ml-4">
                                    <p class="text-lg font-bold text-red-500">${error.count}</p>
                                    <p class="text-xs text-gray-400">${new Date(error.lastSeen).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        </div>
                    `).join('') : '<p class="text-gray-400 text-center py-8">No errors! 🎉</p>'}
                </div>
            </div>

            <!-- Webhook Types -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.9s">
                <h2 class="text-xl font-semibold mb-4">Webhook Types (${dashboardData.timeRange || 'today'})</h2>
                <div class="chart-container">
                    <canvas id="webhookTypesChart"></canvas>
                </div>
                <div class="mt-4 max-h-40 overflow-y-auto">
                    ${(dashboardData.webhookTypes || []).slice(0, 5).map((type, index) => `
                        <div class="flex justify-between items-center py-2 border-b border-gray-700 text-sm">
                            <span>${type.type || 'Unknown'}</span>
                            <div class="flex items-center gap-3">
                                <span class="text-green-500">${type.completed}</span>
                                ${type.failed > 0 ? `<span class="text-red-500">${type.failed}</span>` : ''}
                                <span class="text-gray-400">${type.successRate.toFixed(0)}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Bottom Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <!-- 24 Hour Heatmap -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 1.0s">
                <h2 class="text-xl font-semibold mb-4">24 Hour Activity Heatmap</h2>
                <div class="chart-container">
                    <canvas id="heatmapChart"></canvas>
                </div>
            </div>

            <!-- Performance Insights -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 1.1s">
                <h2 class="text-xl font-semibold mb-4">AI Insights & Recommendations</h2>
                <div class="space-y-3">
                    ${(dashboardData.insights || []).map(insight => `
                        <div class="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                            <span class="text-2xl">${insight.startsWith('🚀') ? '🚀' : insight.startsWith('⚡') ? '⚡' : insight.startsWith('⚠️') ? '⚠️' : insight.startsWith('✨') ? '✨' : '💡'}</span>
                            <p class="text-sm">${insight}</p>
                        </div>
                    `).join('')}
                </div>
                ${dashboardData.systemHealth?.recommendations?.length > 0 ? `
                    <div class="mt-4 pt-4 border-t border-gray-700">
                        <p class="text-sm font-semibold mb-2">Recommendations:</p>
                        ${dashboardData.systemHealth.recommendations.map(rec => `
                            <p class="text-sm text-gray-400 mb-1">• ${rec}</p>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Footer -->
        <div class="mt-8 text-center text-gray-500 text-sm">
            <p>Last updated: ${new Date().toLocaleTimeString()} | Auto-refresh in <span id="countdown">30</span>s</p>
        </div>
    </div>

    <script>
        // Initialize particles
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: '#3b82f6' },
                shape: { type: 'circle' },
                opacity: { value: 0.5, random: false },
                size: { value: 3, random: true },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#3b82f6',
                    opacity: 0.2,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: { enable: true, mode: 'grab' },
                    onclick: { enable: true, mode: 'push' },
                    resize: true
                },
                modes: {
                    grab: { distance: 140, line_linked: { opacity: 0.5 } },
                    push: { particles_nb: 4 }
                }
            },
            retina_detect: true
        });

        // Sparklines for each queue
        ${(dashboardData.queues || []).map(queue => `
            const sparklineCtx${queue.name} = document.getElementById('sparkline-${queue.name}')?.getContext('2d');
            if (sparklineCtx${queue.name}) {
                new Chart(sparklineCtx${queue.name}, {
                    type: 'line',
                    data: {
                        labels: Array(24).fill(''),
                        datasets: [{
                            data: ${JSON.stringify(queue.sparklineData || Array(24).fill(0))},
                            borderColor: 'rgba(59, 130, 246, 0.8)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderWidth: 1,
                            pointRadius: 0,
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false }
                        },
                        scales: {
                            x: { display: false },
                            y: { display: false }
                        }
                    }
                });
            }
        `).join('')}

        // Performance Chart
        const perfCtx = document.getElementById('performanceChart').getContext('2d');
        const performanceData = ${JSON.stringify(dashboardData.performance?.timeSeries || [])};
        
        // Group by interval and queue type
        const intervals = [...new Set(performanceData.map(d => d._id.interval))].sort();
        const queueTypes = [...new Set(performanceData.map(d => d._id.queueType))];
        
        const datasets = queueTypes.map((queueType, index) => {
            const colors = [
                'rgba(59, 130, 246, 0.8)',
                'rgba(139, 92, 246, 0.8)',
                'rgba(236, 72, 153, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(245, 158, 11, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(107, 114, 128, 0.8)'
            ];
            
            return {
                label: queueType,
                data: intervals.map(interval => {
                    const point = performanceData.find(d => d._id.interval === interval && d._id.queueType === queueType);
                    return point ? point.count : 0;
                }),
                backgroundColor: colors[index % colors.length],
                borderColor: colors[index % colors.length],
                borderWidth: 1
            };
        });

        new Chart(perfCtx, {
            type: 'bar',
            data: {
                labels: intervals.slice(-20), // Last 20 intervals
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { 
                            color: 'rgba(255, 255, 255, 0.7)',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1,
                        padding: 10
                    }
                }
            }
        });

        // Webhook Types Chart
        const typesCtx = document.getElementById('webhookTypesChart').getContext('2d');
        const webhookTypesData = ${JSON.stringify(dashboardData.webhookTypes || [])};
        
        if (webhookTypesData.length > 0) {
            new Chart(typesCtx, {
                type: 'doughnut',
                data: {
                    labels: webhookTypesData.slice(0, 6).map(t => t.type || 'Unknown'),
                    datasets: [{
                        data: webhookTypesData.slice(0, 6).map(t => t.count),
                        backgroundColor: [
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(139, 92, 246, 0.8)',
                            'rgba(236, 72, 153, 0.8)',
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(245, 158, 11, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: 'rgb(59, 130, 246)',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const type = webhookTypesData[context.dataIndex];
                                    return [
                                        label + ': ' + value,
                                        'Success: ' + type.successRate.toFixed(0) + '%'
                                   ];
                               }
                           }
                       }
                   }
               }
           });
       }

       // 24 Hour Heatmap
       const heatmapCtx = document.getElementById('heatmapChart').getContext('2d');
       const heatmapData = ${JSON.stringify(dashboardData.heatmap || [])};
       
       // Generate 24 hours of data
       const hours = [];
       const heatmapValues = [];
       for (let i = 0; i < 24; i++) {
           hours.push(i.toString().padStart(2, '0') + ':00');
           const data = heatmapData.find(h => h._id === i);
           heatmapValues.push(data ? data.count : 0);
       }

       const maxHeatmapValue = Math.max(...heatmapValues) || 1;
       
       new Chart(heatmapCtx, {
           type: 'bar',
           data: {
               labels: hours,
               datasets: [{
                   label: 'Webhooks',
                   data: heatmapValues,
                   backgroundColor: heatmapValues.map(v => {
                       const intensity = v / maxHeatmapValue;
                       return \`rgba(59, 130, 246, \${0.2 + intensity * 0.8})\`;
                   }),
                   borderWidth: 0
               }]
           },
           options: {
               responsive: true,
               maintainAspectRatio: false,
               plugins: {
                   legend: {
                       display: false
                   },
                   tooltip: {
                       backgroundColor: 'rgba(0, 0, 0, 0.8)',
                       titleColor: '#fff',
                       bodyColor: '#fff',
                       borderColor: 'rgb(59, 130, 246)',
                       borderWidth: 1,
                       padding: 10,
                       callbacks: {
                           label: function(context) {
                               const hour = context.label;
                               const count = context.parsed.y;
                               const data = heatmapData.find(h => h._id === parseInt(hour));
                               const avgTime = data?.avgProcessingTime ? \` • Avg: \${(data.avgProcessingTime / 1000).toFixed(1)}s\` : '';
                               return count + ' webhooks' + avgTime;
                           }
                       }
                   }
               },
               scales: {
                   y: {
                       beginAtZero: true,
                       grid: {
                           color: 'rgba(255, 255, 255, 0.1)',
                           drawBorder: false
                       },
                       ticks: {
                           color: 'rgba(255, 255, 255, 0.7)'
                       }
                   },
                   x: {
                       grid: {
                           display: false,
                           drawBorder: false
                       },
                       ticks: {
                           color: 'rgba(255, 255, 255, 0.7)',
                           maxRotation: 45,
                           minRotation: 45
                       }
                   }
               }
           }
       });

       // Date range selector
       function changeRange(newRange) {
           window.location.href = \`?range=\${newRange}\`;
       }

       // Countdown timer
       let countdown = 30;
       setInterval(() => {
           countdown--;
           document.getElementById('countdown').textContent = countdown;
           if (countdown <= 0) {
               location.reload();
           }
       }, 1000);

       // Animate numbers on load
       document.querySelectorAll('.count-up').forEach(el => {
           const finalValue = el.textContent;
           const isFloat = finalValue.includes('.');
           const numericValue = parseFloat(finalValue.replace(/[^0-9.-]/g, ''));
           const suffix = finalValue.replace(/[0-9.-]/g, '');
           
           let current = 0;
           const increment = numericValue / 20;
           const timer = setInterval(() => {
               current += increment;
               if (current >= numericValue) {
                   current = numericValue;
                   clearInterval(timer);
               }
               el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
           }, 50);
       });

       // Add hover effect to queue cards
       document.querySelectorAll('.queue-card').forEach(card => {
           card.addEventListener('click', () => {
               // Future: Navigate to queue detail view
               console.log('Queue clicked:', card.dataset.queue);
           });
       });

       // Add hover effect to error cards
       document.querySelectorAll('.error-card').forEach(card => {
           card.addEventListener('click', () => {
               // Future: Show error detail modal
               console.log('Error clicked:', card.dataset.error);
           });
       });
   </script>
</body>
</html>
   `;

   res.setHeader('Content-Type', 'text/html');
   res.status(200).send(html);

 } catch (error: any) {
   console.error('[Dashboard UI] Error:', error);
   
   // Fallback UI if there's an error
   const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>Analytics Dashboard - Error</title>
   <script src="https://cdn.tailwindcss.com"></script>
   <style>
       body {
           background: #0a0a0a;
           color: white;
           font-family: 'Inter', sans-serif;
       }
       .glass {
           background: rgba(17, 25, 40, 0.75);
           backdrop-filter: blur(16px);
           border: 1px solid rgba(255, 255, 255, 0.125);
       }
   </style>
</head>
<body>
   <div class="min-h-screen p-6 flex items-center justify-center">
       <div class="glass rounded-xl p-8 max-w-md w-full text-center">
           <h1 class="text-2xl font-bold mb-4">Unable to Load Dashboard</h1>
           <p class="text-gray-400 mb-6">Error: ${error.message || 'Unknown error'}</p>
           <button onclick="location.reload()" 
                   class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
               Retry
           </button>
       </div>
   </div>
</body>
</html>
   `;
   
   res.setHeader('Content-Type', 'text/html');
   res.status(200).send(fallbackHtml);
 }
}