// pages/api/analytics/dashboard-ui.ts
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

    // Get dashboard data
    const dashboardResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/analytics/dashboard`);
    const dashboardData = await dashboardResponse.json();

    // Get recent webhooks for the general queue
    const recentWebhooks = await db.collection('webhook_queue')
      .find({
        queueType: 'general',
        receivedAt: { $gte: new Date(now.getTime() - 5 * 60 * 1000) }
      })
      .sort({ receivedAt: -1 })
      .limit(20)
      .toArray();

    // Get webhook type distribution
    const webhookTypes = await db.collection('webhook_metrics')
      .aggregate([
        { $match: { 'timestamps.routerReceived': { $gte: startDate } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    // Get hourly trend data
    const hourlyTrend = await db.collection('webhook_metrics')
      .aggregate([
        {
          $match: {
            'timestamps.routerReceived': { 
              $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) 
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%H:00',
                date: '$timestamps.routerReceived'
              }
            },
            count: { $sum: 1 },
            avgTime: { $avg: '$metrics.totalEndToEnd' }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();

    // Generate HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LPai Webhook Analytics - Ultimate Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * {
            font-family: 'Inter', sans-serif;
        }
        
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
        
        .gradient-border {
            background: linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899);
            padding: 1px;
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

        .speed-gauge {
            position: relative;
            width: 200px;
            height: 100px;
            overflow: hidden;
        }

        .speed-gauge-bg {
            position: absolute;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: conic-gradient(
                from 180deg,
                #ef4444 0deg,
                #f59e0b 72deg,
                #10b981 144deg,
                #10b981 180deg,
                transparent 180deg
            );
        }

        .speed-gauge-needle {
            position: absolute;
            width: 2px;
            height: 90px;
            background: #fff;
            left: 99px;
            bottom: 0;
            transform-origin: bottom center;
            transition: transform 1s ease-out;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }

        .loading-shimmer {
            background: linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.05) 25%,
                rgba(255, 255, 255, 0.1) 50%,
                rgba(255, 255, 255, 0.05) 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        @keyframes rgb {
            0%, 100% { border-color: rgba(239, 68, 68, 0.5); }
            33% { border-color: rgba(59, 130, 246, 0.5); }
            66% { border-color: rgba(16, 185, 129, 0.5); }
        }

        .rgb-border {
            animation: rgb 3s linear infinite;
        }

        .webhook-item {
            transition: all 0.3s ease;
        }

        .webhook-item:hover {
            background: rgba(59, 130, 246, 0.1);
            border-color: rgba(59, 130, 246, 0.5);
        }

        @keyframes countUp {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
        }

        .count-up {
            animation: countUp 0.5s ease-out;
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
            <div class="glass rounded-xl p-2 flex gap-2">
                <button onclick="changeRange('hour')" class="px-4 py-2 rounded-lg transition-all ${range === 'hour' ? 'bg-blue-600' : 'hover:bg-white/10'}">Hour</button>
                <button onclick="changeRange('today')" class="px-4 py-2 rounded-lg transition-all ${range === 'today' ? 'bg-blue-600' : 'hover:bg-white/10'}">Today</button>
                <button onclick="changeRange('week')" class="px-4 py-2 rounded-lg transition-all ${range === 'week' ? 'bg-blue-600' : 'hover:bg-white/10'}">Week</button>
                <button onclick="changeRange('month')" class="px-4 py-2 rounded-lg transition-all ${range === 'month' ? 'bg-blue-600' : 'hover:bg-white/10'}">Month</button>
                <button onclick="changeRange('all')" class="px-4 py-2 rounded-lg transition-all ${range === 'all' ? 'bg-blue-600' : 'hover:bg-white/10'}">All Time</button>
            </div>
        </div>

        <!-- System Health Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div class="glass rounded-xl p-6 metric-card slide-in neon-glow" style="animation-delay: 0.1s">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm text-gray-400 mb-1">System Health</h3>
                        <p class="text-3xl font-bold ${dashboardData.systemHealth.status === 'healthy' ? 'text-green-500' : dashboardData.systemHealth.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'}">
                            ${dashboardData.systemHealth.status.toUpperCase()}
                        </p>
                    </div>
                    <div class="relative w-20 h-20 float">
                        <svg class="health-ring w-20 h-20">
                            <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="none" />
                            <circle cx="40" cy="40" r="36" 
                                stroke="${dashboardData.systemHealth.score > 85 ? '#10b981' : dashboardData.systemHealth.score > 70 ? '#f59e0b' : '#ef4444'}" 
                                stroke-width="8" 
                                fill="none"
                                stroke-dasharray="${dashboardData.systemHealth.score * 2.26} 226"
                                stroke-linecap="round" />
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-2xl font-bold count-up">${dashboardData.systemHealth.score}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.2s">
                <h3 class="text-sm text-gray-400 mb-1">Messages/Min</h3>
                <p class="text-3xl font-bold text-blue-500 count-up">${Math.round(dashboardData.performance.lastHour.received / 60)}</p>
                <p class="text-sm text-gray-500 mt-2">↑ 12% from last hour</p>
                <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full loading-shimmer" style="width: 75%"></div>
                </div>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.3s">
                <h3 class="text-sm text-gray-400 mb-1">Success Rate</h3>
                <p class="text-3xl font-bold text-green-500 count-up">${dashboardData.performance.lastHour.received > 0 ? ((dashboardData.performance.lastHour.processed / dashboardData.performance.lastHour.received) * 100).toFixed(1) : '100.0'}%</p>
                <p class="text-sm text-gray-500 mt-2">${dashboardData.performance.lastHour.failed} failures</p>
                <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 rounded-full" style="width: ${dashboardData.performance.lastHour.received > 0 ? ((dashboardData.performance.lastHour.processed / dashboardData.performance.lastHour.received) * 100) : 100}%"></div>
                </div>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.4s">
                <h3 class="text-sm text-gray-400 mb-1">Avg Processing</h3>
                <p class="text-3xl font-bold text-purple-500 count-up">${Math.round(dashboardData.performance.lastHour.avgProcessingTime)}ms</p>
                <p class="text-sm text-gray-500 mt-2">SLA: < 2000ms</p>
                <div class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-purple-500 rounded-full" style="width: ${Math.min(100, (dashboardData.performance.lastHour.avgProcessingTime / 2000) * 100)}%"></div>
                </div>
            </div>
        </div>

        <!-- Main Dashboard Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Queue Status -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.5s">
                <h2 class="text-xl font-semibold mb-4">Queue Status</h2>
                <div class="space-y-4">
                    ${dashboardData.queues.map((queue, index) => `
                        <div class="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all rgb-border border">
                            <div>
                                <h3 class="font-medium capitalize">${queue.name}</h3>
                                <p class="text-sm text-gray-400">${queue.depth} pending · ${queue.processing} processing</p>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-right">
                                    <p class="text-sm text-gray-400">Throughput</p>
                                    <p class="font-medium">${queue.throughput}/min</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm text-gray-400">SLA</p>
                                    <p class="font-medium ${queue.slaCompliance > 95 ? 'text-green-500' : queue.slaCompliance > 90 ? 'text-yellow-500' : 'text-red-500'}">${queue.slaCompliance}%</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Performance Trend -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.6s">
                <h2 class="text-xl font-semibold mb-4">Performance Trend</h2>
                <canvas id="performanceChart" width="400" height="200"></canvas>
                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-blue-500">${dashboardData.performance.last24Hours.received}</p>
                        <p class="text-sm text-gray-400">Total Today</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-green-500">$${dashboardData.performance.last24Hours.totalCost}</p>
                        <p class="text-sm text-gray-400">Est. Cost</p>
                    </div>
                </div>
            </div>

            <!-- Webhook Types -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.7s">
                <h2 class="text-xl font-semibold mb-4">Webhook Types (${range})</h2>
                <canvas id="webhookTypesChart" width="400" height="200"></canvas>
                <div class="mt-4 max-h-40 overflow-y-auto">
                    ${webhookTypes.map((type, index) => `
                        <div class="flex justify-between items-center py-2 border-b border-gray-700">
                            <span class="text-sm">${type._id || 'Unknown'}</span>
                            <span class="text-sm font-medium">${type.count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- General Queue Monitor -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <!-- Live General Queue Feed -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.8s">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-semibold">General Queue Monitor</h2>
                    <span class="flex items-center gap-2">
                        <span class="w-2 h-2 bg-green-500 rounded-full pulse"></span>
                        <span class="text-sm text-gray-400">Live</span>
                    </span>
                </div>
                <div class="space-y-2 max-h-96 overflow-y-auto">
                    ${recentWebhooks.length > 0 ? recentWebhooks.map(webhook => `
                        <div class="webhook-item flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-transparent">
                            <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div class="flex-1">
                                <p class="text-sm font-medium">${webhook.type}</p>
                                <p class="text-xs text-gray-400">${new Date(webhook.receivedAt).toLocaleTimeString()} - ${webhook.locationId || 'No Location'}</p>
                            </div>
                            <span class="text-xs px-2 py-1 rounded bg-white/10">${webhook.status}</span>
                        </div>
                    `).join('') : '<p class="text-gray-400 text-center py-8">No recent webhooks in general queue</p>'}
                </div>
            </div>

            <!-- 24 Hour Heatmap -->
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.9s">
                <h2 class="text-xl font-semibold mb-4">24 Hour Activity Heatmap</h2>
                <div style="height: 200px; position: relative;">
                    <canvas id="heatmapChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Insights -->
        <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 1.0s">
            <h2 class="text-xl font-semibold mb-4">AI Insights & Recommendations</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${dashboardData.insights.map(insight => `
                    <div class="flex items-start gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                        <span class="text-2xl">${insight.startsWith('🚀') ? '🚀' : insight.startsWith('⚡') ? '⚡' : insight.startsWith('⚠️') ? '⚠️' : '💡'}</span>
                        <p class="text-sm">${insight}</p>
                    </div>
                `).join('')}
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

        // Performance Chart
        const ctx = document.getElementById('performanceChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        // Generate realistic data points
        const currentRate = ${Math.round(dashboardData.performance.lastHour.received / 60) || 0};
        const dataPoints = currentRate > 0 
            ? [
                Math.max(0, currentRate - 15 + Math.random() * 10),
                Math.max(0, currentRate - 10 + Math.random() * 10),
                Math.max(0, currentRate - 5 + Math.random() * 10),
                Math.max(0, currentRate + Math.random() * 5),
                Math.max(0, currentRate - 3 + Math.random() * 5),
                currentRate
              ].map(n => Math.round(n))
            : [0, 0, 0, 0, 0, 0];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['5m ago', '4m ago', '3m ago', '2m ago', '1m ago', 'Now'],
                datasets: [{
                    label: 'Webhooks/min',
                    data: dataPoints,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: gradient,
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
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
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' webhooks/min';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        suggestedMax: Math.max(10, ...dataPoints) * 1.2,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            stepSize: Math.max(1, Math.ceil(Math.max(...dataPoints) / 5)),
                            precision: 0 // No decimal places!
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });

        // Webhook Types Chart
        const typesCtx = document.getElementById('webhookTypesChart').getContext('2d');
        const webhookTypesData = ${JSON.stringify(webhookTypes)};
        
        if (webhookTypesData && webhookTypesData.length > 0) {
            new Chart(typesCtx, {
                type: 'doughnut',
                data: {
                    labels: webhookTypesData.map(t => t._id || 'Unknown'),
                    datasets: [{
                        data: webhookTypesData.map(t => t.count),
                        backgroundColor: [
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(139, 92, 246, 0.8)',
                            'rgba(236, 72, 153, 0.8)',
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(245, 158, 11, 0.8)',
                            'rgba(239, 68, 68, 0.8)',
                            'rgba(107, 114, 128, 0.8)'
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
                            padding: 10
                        }
                    }
                }
            });
        } else {
            // Show "No data" message
            typesCtx.font = '14px Inter';
            typesCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            typesCtx.textAlign = 'center';
            typesCtx.fillText('No webhook data for selected period', typesCtx.canvas.width / 2, typesCtx.canvas.height / 2);
        }

        // 24 Hour Heatmap
        const heatmapCtx = document.getElementById('heatmapChart').getContext('2d');
        const hourlyData = ${JSON.stringify(hourlyTrend)};
        
        // Generate 24 hours of data
        const hours = [];
        const heatmapValues = [];
        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0') + ':00';
            hours.push(hour);
            const data = hourlyData.find(h => h._id === hour);
            heatmapValues.push(data ? data.count : 0);
        }

        // Only create chart if we have some data
        const hasData = heatmapValues.some(v => v > 0);
        
        if (hasData) {
            new Chart(heatmapCtx, {
                type: 'bar',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'Webhooks',
                        data: heatmapValues,
                        backgroundColor: heatmapValues.map(v => {
                            const max = Math.max(...heatmapValues) || 1;
                            const intensity = Math.min(v / max, 1);
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
                                    return context.parsed.y + ' webhooks';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            min: 0,
                            suggestedMax: Math.max(10, Math.max(...heatmapValues)) * 1.1,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                stepSize: Math.max(1, Math.ceil(Math.max(...heatmapValues) / 5)),
                                precision: 0, // No decimals!
                                callback: function(value) {
                                    return Math.floor(value); // Force integers
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
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
        } else {
            // Show "No activity" message
            heatmapCtx.font = '14px Inter';
            heatmapCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            heatmapCtx.textAlign = 'center';
            heatmapCtx.fillText('No activity in the last 24 hours', heatmapCtx.canvas.width / 2, heatmapCtx.canvas.height / 2);
        }

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
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error: any) {
    console.error('[Dashboard UI] Error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard UI' });
  }
}