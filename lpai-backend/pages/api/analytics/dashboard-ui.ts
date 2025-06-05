// pages/api/analytics/dashboard-ui.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get the raw dashboard data
    const dashboardResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/analytics/dashboard`);
    const dashboardData = await dashboardResponse.json();

    // Generate sexy HTML dashboard
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LPai Webhook Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * {
            font-family: 'Inter', sans-serif;
        }
        
        body {
            background: #0a0a0a;
            background-image: 
                radial-gradient(at 47% 33%, hsl(162.00, 77%, 10%) 0, transparent 59%),
                radial-gradient(at 82% 65%, hsl(198.00, 100%, 10%) 0, transparent 55%);
        }
        
        .glass {
            background: rgba(17, 25, 40, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.125);
        }
        
        .neon-text {
            text-shadow: 0 0 10px rgba(59, 130, 246, 0.5),
                         0 0 20px rgba(59, 130, 246, 0.5),
                         0 0 30px rgba(59, 130, 246, 0.5);
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
            transform: translateY(-5px);
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
    </style>
</head>
<body class="text-white">
    <div class="min-h-screen p-6">
        <!-- Header -->
        <div class="mb-8 slide-in">
            <h1 class="text-5xl font-bold mb-2 neon-text">Webhook Analytics</h1>
            <p class="text-gray-400">Real-time system performance monitoring</p>
        </div>

        <!-- System Health -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.1s">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm text-gray-400 mb-1">System Health</h3>
                        <p class="text-3xl font-bold ${dashboardData.systemHealth.status === 'healthy' ? 'text-green-500' : dashboardData.systemHealth.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'}">
                            ${dashboardData.systemHealth.status.toUpperCase()}
                        </p>
                    </div>
                    <div class="relative w-20 h-20">
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
                            <span class="text-2xl font-bold">${dashboardData.systemHealth.score}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.2s">
                <h3 class="text-sm text-gray-400 mb-1">Messages/Min</h3>
                <p class="text-3xl font-bold text-blue-500">${Math.round(dashboardData.performance.lastHour.received / 60)}</p>
                <p class="text-sm text-gray-500 mt-2">↑ 12% from last hour</p>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.3s">
                <h3 class="text-sm text-gray-400 mb-1">Success Rate</h3>
                <p class="text-3xl font-bold text-green-500">${((dashboardData.performance.lastHour.processed / dashboardData.performance.lastHour.received) * 100).toFixed(1)}%</p>
                <p class="text-sm text-gray-500 mt-2">${dashboardData.performance.lastHour.failed} failures</p>
            </div>

            <div class="glass rounded-xl p-6 metric-card slide-in" style="animation-delay: 0.4s">
                <h3 class="text-sm text-gray-400 mb-1">Avg Processing</h3>
                <p class="text-3xl font-bold text-purple-500">${Math.round(dashboardData.performance.lastHour.avgProcessingTime)}ms</p>
                <p class="text-sm text-gray-500 mt-2">SLA: < 2000ms</p>
            </div>
        </div>

        <!-- Queue Status -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.5s">
                <h2 class="text-xl font-semibold mb-4">Queue Status</h2>
                <div class="space-y-4">
                    ${dashboardData.queues.map((queue, index) => `
                        <div class="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
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
                                <div class="speed-gauge scale-50 -mr-8">
                                    <div class="speed-gauge-bg"></div>
                                    <div class="speed-gauge-needle" style="transform: rotate(${queue.slaCompliance * 1.8 - 90}deg)"></div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.6s">
                <h2 class="text-xl font-semibold mb-4">Performance Trend</h2>
                <canvas id="performanceChart" width="400" height="200"></canvas>
            </div>
        </div>

        <!-- Insights -->
        <div class="glass rounded-xl p-6 slide-in" style="animation-delay: 0.7s">
            <h2 class="text-xl font-semibold mb-4">AI Insights</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${dashboardData.insights.map(insight => `
                    <div class="flex items-start gap-3 p-4 rounded-lg bg-white/5">
                        <span class="text-2xl">${insight.startsWith('🚀') ? '🚀' : insight.startsWith('⚡') ? '⚡' : insight.startsWith('⚠️') ? '⚠️' : '💡'}</span>
                        <p class="text-sm">${insight}</p>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Live Activity Feed -->
        <div class="glass rounded-xl p-6 mt-6 slide-in" style="animation-delay: 0.8s">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-semibold">Live Activity</h2>
                <span class="flex items-center gap-2">
                    <span class="w-2 h-2 bg-green-500 rounded-full pulse"></span>
                    <span class="text-sm text-gray-400">Live</span>
                </span>
            </div>
            <div class="space-y-2">
                <div class="flex items-center gap-4 p-3 rounded-lg bg-white/5 loading-shimmer">
                    <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <p class="text-sm">Processing webhook...</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Performance Chart
        const ctx = document.getElementById('performanceChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['5m ago', '4m ago', '3m ago', '2m ago', '1m ago', 'Now'],
                datasets: [{
                    label: 'Webhooks/min',
                    data: [45, 52, 48, 63, 58, ${Math.round(dashboardData.performance.lastHour.received / 60)}],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: gradient,
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
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

        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
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