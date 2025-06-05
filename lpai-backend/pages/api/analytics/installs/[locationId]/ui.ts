// pages/api/analytics/installs/[locationId]/ui.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Location ID required' });
  }

  // Fetch install data
  const installResponse = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/analytics/installs/${locationId}`
  );
  const installData = await installResponse.json();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${installData.locationName} - Install Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * { font-family: 'Inter', sans-serif; }
        
        body {
            background: #000;
            background-image: 
                radial-gradient(at 27% 37%, hsla(215, 98%, 15%, 1) 0px, transparent 50%),
                radial-gradient(at 97% 21%, hsla(300, 98%, 15%, 1) 0px, transparent 50%),
                radial-gradient(at 52% 99%, hsla(150, 98%, 15%, 1) 0px, transparent 50%);
        }
        
        .glass {
            background: rgba(17, 25, 40, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.125);
        }

        .grade-badge {
            background: ${installData.performanceAnalysis.grade === 'A' ? 'linear-gradient(135deg, #10b981, #34d399)' :
                         installData.performanceAnalysis.grade === 'B' ? 'linear-gradient(135deg, #3b82f6, #60a5fa)' :
                         installData.performanceAnalysis.grade === 'C' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' :
                         'linear-gradient(135deg, #ef4444, #f87171)'};
            width: 120px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 4rem;
            font-weight: 800;
            border-radius: 20px;
            box-shadow: 0 0 40px ${installData.performanceAnalysis.grade === 'A' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.5)'};
        }

        .step-progress {
            position: relative;
            padding-left: 40px;
        }

        .step-progress::before {
            content: '';
            position: absolute;
            left: 15px;
            top: 30px;
            bottom: 0;
            width: 2px;
            background: rgba(255, 255, 255, 0.1);
        }

        .step-item {
            position: relative;
            margin-bottom: 30px;
            animation: slideIn 0.5s ease-out;
        }

        .step-dot {
            position: absolute;
            left: -25px;
            top: 8px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid;
        }

        .step-dot.success {
            background: #10b981;
            border-color: #10b981;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
        }

        .step-dot.failed {
            background: #ef4444;
            border-color: #ef4444;
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .progress-bar {
            position: relative;
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            border-radius: 4px;
            transition: width 1s ease-out;
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
        }

        .metric-ring {
            position: relative;
            width: 150px;
            height: 150px;
        }

        .metric-ring svg {
            transform: rotate(-90deg);
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body class="text-white min-h-screen p-6">
    <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-4xl font-bold mb-2">${installData.locationName}</h1>
            <p class="text-gray-400">Installation Performance Analytics</p>
        </div>

        <!-- Performance Overview -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Grade Card -->
            <div class="glass rounded-xl p-6">
                <h3 class="text-sm text-gray-400 mb-4">Performance Grade</h3>
                <div class="flex items-center justify-between">
                    <div class="grade-badge">
                        ${installData.performanceAnalysis.grade}
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold">${installData.performanceAnalysis.score}/100</p>
                        <p class="text-sm text-gray-400">Top ${installData.performanceAnalysis.percentile}%</p>
                        <p class="text-sm mt-2 ${installData.performanceAnalysis.grade === 'A' ? 'text-green-500' : 'text-blue-500'}">
                            ${installData.performanceAnalysis.comparison}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Install Stats -->
            <div class="glass rounded-xl p-6">
                <h3 class="text-sm text-gray-400 mb-4">Installation History</h3>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-400">Total Installs</span>
                        <span class="font-medium">${installData.installHistory.totalInstalls}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Success Rate</span>
                        <span class="font-medium text-green-500">
                            ${installData.installHistory.totalInstalls > 0 
                              ? Math.round((installData.installHistory.successfulInstalls / installData.installHistory.totalInstalls) * 100)
                              : 100}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">Avg Duration</span>
                        <span class="font-medium">${Math.round(installData.installHistory.averageDuration / 1000)}s</span>
                    </div>
                </div>
            </div>

            <!-- Comparison Metrics -->
            <div class="glass rounded-xl p-6">
                <h3 class="text-sm text-gray-400 mb-4">Performance Comparison</h3>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-sm mb-1">
                            <span>vs Average</span>
                            <span class="${installData.comparisonMetrics.vsAverage < 0 ? 'text-green-500' : 'text-red-500'}">
                                ${installData.comparisonMetrics.vsAverage > 0 ? '+' : ''}${installData.comparisonMetrics.vsAverage}%
                            </span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${50 + (installData.comparisonMetrics.vsAverage / 2)}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-sm mb-1">
                            <span>vs Last Week</span>
                            <span class="${installData.comparisonMetrics.vsLastWeek < 0 ? 'text-green-500' : 'text-red-500'}">
                                ${installData.comparisonMetrics.vsLastWeek > 0 ? '+' : ''}${installData.comparisonMetrics.vsLastWeek}%
                            </span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${50 + (installData.comparisonMetrics.vsLastWeek / 2)}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Installation Steps -->
        ${installData.currentInstall ? `
        <div class="glass rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold mb-6">Installation Progress</h2>
            <div class="step-progress">
                ${installData.currentInstall.steps.map((step, index) => `
                    <div class="step-item" style="animation-delay: ${index * 0.1}s">
                        <div class="step-dot ${step.status}"></div>
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="font-medium">${step.name}</h4>
                                <p class="text-sm text-gray-400">${step.status === 'success' ? `Completed in ${Math.round(step.duration / 1000)}s` : step.error || 'Failed'}</p>
                            </div>
                            <div class="text-right">
                                ${step.status === 'success' 
                                  ? '<span class="text-green-500">✓</span>' 
                                  : '<span class="text-red-500">✗</span>'}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- Recommendations -->
        ${installData.recommendations.length > 0 ? `
        <div class="glass rounded-xl p-6">
            <h2 class="text-xl font-semibold mb-4">Recommendations</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${installData.recommendations.map(rec => `
                    <div class="flex items-start gap-3 p-4 rounded-lg bg-white/5">
                        <span class="text-2xl">${rec.startsWith('🚀') ? '🚀' : rec.startsWith('📊') ? '📊' : rec.startsWith('🔑') ? '🔑' : '💡'}</span>
                        <p class="text-sm">${rec}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>

    <script>
        // Animate progress fills on load
        setTimeout(() => {
            document.querySelectorAll('.progress-fill').forEach(el => {
                el.style.width = el.style.width;
            });
        }, 100);

        // Auto-refresh
        setTimeout(() => location.reload(), 60000);
    </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}