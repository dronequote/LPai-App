// pages/api/analytics/installs/[locationId]/ui.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Location ID required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get all locations with install history for dropdown
    const allLocations = await db.collection('locations')
      .find({ 
        setupCompleted: true 
      })
      .project({
        locationId: 1,
        name: 1,
        installedAt: 1,
        companyId: 1
      })
      .sort({ installedAt: -1 })
      .limit(50)
      .toArray();

    // Fetch install data
    const installResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/analytics/installs/${locationId}`
    );
    const installData = await installResponse.json();

    // Calculate total time and percentages
    let totalDuration = 0;
    let completedSteps = 0;
    const validSteps = [];
    
    if (installData.currentInstall?.steps) {
      installData.currentInstall.steps.forEach(step => {
        const duration = step.duration && !isNaN(step.duration) ? step.duration : 0;
        if (duration > 0) {
          validSteps.push({ ...step, duration });
          totalDuration += duration;
        }
        if (step.status === 'success') completedSteps++;
      });
    }
    
    const completionPercentage = installData.currentInstall?.steps?.length > 0 
      ? Math.round((completedSteps / installData.currentInstall.steps.length) * 100)
      : 0;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${installData.locationName} - Install Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * { font-family: 'Inter', sans-serif; }
        
        body {
            background: #000;
            background-image: 
                radial-gradient(at 27% 37%, hsla(215, 98%, 15%, 1) 0px, transparent 50%),
                radial-gradient(at 97% 21%, hsla(300, 98%, 15%, 1) 0px, transparent 50%),
                radial-gradient(at 52% 99%, hsla(150, 98%, 15%, 1) 0px, transparent 50%);
            min-height: 100vh;
            position: relative;
            overflow-x: hidden;
        }

        /* Animated background grid */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: grid 20s linear infinite;
            z-index: 0;
        }

        @keyframes grid {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
        }

        .content {
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
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .neon-glow {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5),
                        inset 0 0 30px rgba(59, 130, 246, 0.1);
        }

        .grade-badge {
            background: ${installData.performanceAnalysis?.grade === 'A' ? 'linear-gradient(135deg, #10b981, #34d399)' :
                         installData.performanceAnalysis?.grade === 'B' ? 'linear-gradient(135deg, #3b82f6, #60a5fa)' :
                         installData.performanceAnalysis?.grade === 'C' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' :
                         'linear-gradient(135deg, #ef4444, #f87171)'};
            width: 150px;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 5rem;
            font-weight: 800;
            border-radius: 30px;
            box-shadow: 0 0 60px ${installData.performanceAnalysis?.grade === 'A' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(59, 130, 246, 0.6)'},
                        inset 0 0 60px rgba(255, 255, 255, 0.1);
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-10px) scale(1.05); }
        }

        .step-progress {
            position: relative;
            padding-left: 50px;
        }

        .step-progress::before {
            content: '';
            position: absolute;
            left: 20px;
            top: 30px;
            bottom: 0;
            width: 2px;
            background: linear-gradient(to bottom, 
                rgba(59, 130, 246, 0.5), 
                rgba(139, 92, 246, 0.5));
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
        }

        .step-item {
            position: relative;
            margin-bottom: 40px;
            animation: slideIn 0.5s ease-out;
            transition: all 0.3s ease;
        }

        .step-item:hover {
            transform: translateX(10px);
        }

        .step-dot {
            position: absolute;
            left: -30px;
            top: 12px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: white;
            z-index: 1;
        }

        .step-dot.success {
            background: #10b981;
            border-color: #10b981;
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.8),
                        inset 0 0 10px rgba(255, 255, 255, 0.5);
        }

        .step-dot.failed {
            background: #ef4444;
            border-color: #ef4444;
            box-shadow: 0 0 30px rgba(239, 68, 68, 0.8),
                        inset 0 0 10px rgba(255, 255, 255, 0.5);
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-30px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .progress-ring {
            transform: rotate(-90deg);
        }

        .time-bar {
            position: relative;
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 8px;
        }

        .time-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
            border-radius: 4px;
            transition: width 1s ease-out;
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.8);
            position: relative;
            overflow: hidden;
        }

        .time-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.4),
                transparent
            );
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .metric-card {
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .metric-card:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 20px 40px rgba(59, 130, 246, 0.4);
        }

        .metric-card::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
            border-radius: inherit;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: -1;
            background-size: 400% 400%;
            animation: gradient 15s ease infinite;
        }

        .metric-card:hover::before {
            opacity: 1;
        }

        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .live-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 4px 12px;
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid rgba(16, 185, 129, 0.5);
            border-radius: 20px;
            font-size: 12px;
            color: #10b981;
        }

        .live-dot {
            width: 6px;
            height: 6px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
        }
        ::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
            border-radius: 4px;
        }

        .countdown-ring {
            position: relative;
            width: 60px;
            height: 60px;
        }

        .countdown-ring svg {
            transform: rotate(-90deg);
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

        .location-dropdown {
            background: rgba(17, 25, 40, 0.95);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .location-dropdown:hover {
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }

        .location-dropdown option {
            background: #111827;
            color: white;
            padding: 8px;
        }
    </style>
</head>
<body class="text-white">
    <div class="content min-h-screen p-6">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8 flex justify-between items-center">
                <div>
                    <h1 class="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        ${installData.locationName || 'Unknown Location'}
                    </h1>
                    <p class="text-gray-400">Installation Performance Analytics</p>
                </div>
                <div class="flex items-center gap-4">
                    <!-- Location Dropdown -->
                    <select 
                        class="location-dropdown"
                        onchange="window.location.href = '/api/analytics/installs/' + this.value + '/ui'"
                    >
                        <option value="${locationId}">${installData.locationName || 'Current Location'}</option>
                        <option disabled>──────────────</option>
                        ${allLocations
                          .filter(loc => loc.locationId !== locationId)
                          .map(loc => `
                            <option value="${loc.locationId}">
                                ${loc.name || 'Unnamed'} - ${loc.installedAt ? new Date(loc.installedAt).toLocaleDateString() : 'No date'}
                            </option>
                          `).join('')}
                    </select>
                    
                    <!-- Dashboard Link -->
                    <a href="/api/analytics/dashboard-ui" 
                       class="nav-link px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Dashboard
                    </a>
                    
                    <div class="live-indicator">
                        <span class="live-dot"></span>
                        <span>Live Monitoring</span>
                    </div>
                </div>
            </div>

            <!-- Performance Overview -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <!-- Grade Card -->
                <div class="glass rounded-2xl p-8 metric-card neon-glow">
                    <h3 class="text-sm text-gray-400 mb-6 uppercase tracking-wider">Performance Grade</h3>
                    <div class="flex items-center justify-center">
                        <div class="grade-badge">
                            ${installData.performanceAnalysis?.grade || 'N/A'}
                        </div>
                    </div>
                    <div class="text-center mt-6">
                        <p class="text-3xl font-bold">${installData.performanceAnalysis?.score || 0}/100</p>
                        <p class="text-sm text-gray-400 mt-1">Top ${installData.performanceAnalysis?.percentile || 0}%</p>
                        <p class="text-sm mt-3 ${installData.performanceAnalysis?.grade === 'A' ? 'text-green-500' : 'text-blue-500'}">
                            ${installData.performanceAnalysis?.comparison || 'No comparison data'}
                        </p>
                    </div>
                </div>

                <!-- Total Time Card -->
                <div class="glass rounded-2xl p-8 metric-card">
                    <h3 class="text-sm text-gray-400 mb-6 uppercase tracking-wider">Total Install Time</h3>
                    <div class="relative w-40 h-40 mx-auto mb-4">
                        <svg class="progress-ring w-40 h-40">
                            <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.1)" stroke-width="12" fill="none" />
                            <circle cx="80" cy="80" r="70" 
                                stroke="url(#gradient)" 
                                stroke-width="12" 
                                fill="none"
                                stroke-dasharray="${completionPercentage * 4.4} 440"
                                stroke-linecap="round" />
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#3b82f6" />
                                    <stop offset="50%" stop-color="#8b5cf6" />
                                    <stop offset="100%" stop-color="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="text-4xl font-bold">${Math.round(totalDuration / 1000)}s</span>
                            <span class="text-sm text-gray-400">${completionPercentage}% complete</span>
                        </div>
                    </div>
                </div>

                <!-- Install Stats -->
                <div class="glass rounded-2xl p-8 metric-card">
                    <h3 class="text-sm text-gray-400 mb-6 uppercase tracking-wider">Installation History</h3>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-400">Total Installs</span>
                                <span class="text-2xl font-bold">${installData.installHistory?.totalInstalls || 0}</span>
                            </div>
                            <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" 
                                     style="width: ${Math.min((installData.installHistory?.totalInstalls || 0) * 10, 100)}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-400">Success Rate</span>
                                <span class="text-2xl font-bold text-green-500">
                                    ${installData.installHistory?.totalInstalls > 0 
                                      ? Math.round((installData.installHistory.successfulInstalls / installData.installHistory.totalInstalls) * 100)
                                      : 0}%
                                </span>
                            </div>
                            <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div class="h-full bg-green-500 rounded-full" 
                                     style="width: ${installData.installHistory?.totalInstalls > 0 
                                       ? (installData.installHistory.successfulInstalls / installData.installHistory.totalInstalls) * 100
                                       : 0}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400">Avg Duration</span>
                                <span class="text-2xl font-bold">${Math.round((installData.installHistory?.averageDuration || 0) / 1000)}s</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Comparison Metrics -->
                <div class="glass rounded-2xl p-8 metric-card">
                    <h3 class="text-sm text-gray-400 mb-6 uppercase tracking-wider">Performance Comparison</h3>
                    <div class="space-y-6">
                        <div>
                            <div class="flex justify-between text-sm mb-2">
                                <span>vs Average</span>
                                <span class="${(installData.comparisonMetrics?.vsAverage || 0) < 0 ? 'text-green-500' : 'text-red-500'} font-bold">
                                    ${(installData.comparisonMetrics?.vsAverage || 0) > 0 ? '+' : ''}${installData.comparisonMetrics?.vsAverage || 0}%
                                </span>
                            </div>
                            <div class="time-bar">
                                <div class="time-fill" style="width: ${50 + ((installData.comparisonMetrics?.vsAverage || 0) / 2)}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-sm mb-2">
                                <span>vs Last Week</span>
                                <span class="${(installData.comparisonMetrics?.vsLastWeek || 0) < 0 ? 'text-green-500' : 'text-red-500'} font-bold">
                                    ${(installData.comparisonMetrics?.vsLastWeek || 0) > 0 ? '+' : ''}${installData.comparisonMetrics?.vsLastWeek || 0}%
                                </span>
                            </div>
                            <div class="time-bar">
                                <div class="time-fill" style="width: ${50 + ((installData.comparisonMetrics?.vsLastWeek || 0) / 2)}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-sm mb-2">
                                <span>vs Similar</span>
                                <span class="${(installData.comparisonMetrics?.vsSimilarLocations || 0) < 0 ? 'text-green-500' : 'text-red-500'} font-bold">
                                    ${(installData.comparisonMetrics?.vsSimilarLocations || 0) > 0 ? '+' : ''}${installData.comparisonMetrics?.vsSimilarLocations || 0}%
                                </span>
                            </div>
                            <div class="time-bar">
                                <div class="time-fill" style="width: ${50 + ((installData.comparisonMetrics?.vsSimilarLocations || 0) / 2)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Installation Steps Timeline -->
            ${installData.currentInstall ? `
            <div class="glass-dark rounded-2xl p-8 mb-8">
                <div class="flex justify-between items-center mb-8">
                    <h2 class="text-2xl font-bold">Installation Progress</h2>
                    <div class="text-right">
                        <p class="text-sm text-gray-400">Started ${new Date(installData.currentInstall.startTime).toLocaleString()}</p>
                        <p class="text-lg font-bold">Total: ${Math.round(totalDuration / 1000)}s</p>
                    </div>
                </div>
                
                <div class="step-progress">
                    ${installData.currentInstall.steps.map((step, index) => {
                        const duration = step.duration && !isNaN(step.duration) ? step.duration : 0;
                        const stepPercentage = totalDuration > 0 && duration > 0 ? (duration / totalDuration) * 100 : 0;
                        const icon = step.status === 'success' ? '✓' : '✗';
                        const durationSeconds = duration > 0 ? (duration / 1000).toFixed(1) : '0.0';
                        return `
                        <div class="step-item" style="animation-delay: ${index * 0.1}s">
                            <div class="step-dot ${step.status}">
                                ${icon}
                            </div>
                            <div class="glass rounded-xl p-6 hover:bg-white/5 transition-all">
                                <div class="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 class="font-semibold text-lg">${step.name}</h4>
                                        <p class="text-sm text-gray-400">
                                            ${step.status === 'success' 
                                              ? `Completed in ${durationSeconds}s` 
                                              : step.error || 'Failed'}
                                        </p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-2xl font-bold ${step.status === 'success' ? 'text-green-500' : 'text-red-500'}">
                                            ${durationSeconds}s
                                        </p>
                                        <p class="text-sm text-gray-400">${stepPercentage.toFixed(1)}% of total</p>
                                    </div>
                                </div>
                                <div class="time-bar">
                                    <div class="time-fill" style="width: ${stepPercentage}%; animation-delay: ${index * 0.1 + 0.5}s"></div>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Timing Breakdown Chart -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div class="glass rounded-2xl p-8">
                    <h2 class="text-xl font-semibold mb-6">Time Distribution</h2>
                    <canvas id="timeChart" width="400" height="300"></canvas>
                </div>
                
                <div class="glass rounded-2xl p-8">
                    <h2 class="text-xl font-semibold mb-6">Historical Performance</h2>
                    <canvas id="historyChart" width="400" height="300"></canvas>
                </div>
            </div>

            <!-- Recommendations -->
            ${(installData.recommendations || []).length > 0 ? `
            <div class="glass rounded-2xl p-8">
                <h2 class="text-2xl font-bold mb-6">AI Recommendations</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${installData.recommendations.map((rec, index) => `
                        <div class="flex items-start gap-4 p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                             style="animation: slideIn 0.5s ease-out ${index * 0.1}s both">
                            <span class="text-3xl">${rec.startsWith('🚀') ? '🚀' : rec.startsWith('📊') ? '📊' : rec.startsWith('🔑') ? '🔑' : '💡'}</span>
                            <p class="text-sm leading-relaxed">${rec}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Footer -->
            <div class="mt-12 text-center text-gray-500 text-sm">
                <p>Auto-refresh in <span id="countdown">60</span>s | Last updated: ${new Date().toLocaleTimeString()}</p>
            </div>
        </div>
    </div>

    <script>
        // Time Distribution Chart
        const timeCtx = document.getElementById('timeChart')?.getContext('2d');
        if (timeCtx && ${installData.currentInstall ? 'true' : 'false'}) {
            const stepData = ${JSON.stringify(installData.currentInstall?.steps || [])};
            // Filter out invalid data
            const validStepData = stepData.filter(s => s.duration && !isNaN(s.duration) && s.duration > 0);
            
            if (validStepData.length > 0) {
                new Chart(timeCtx, {
                    type: 'doughnut',
                    data: {
                        labels: validStepData.map(s => s.name),
                        datasets: [{
                            data: validStepData.map(s => Math.round(s.duration / 1000)),
                            backgroundColor: [
                                'rgba(59, 130, 246, 0.8)',
                                'rgba(139, 92, 246, 0.8)',
                                'rgba(236, 72, 153, 0.8)',
                                'rgba(16, 185, 129, 0.8)',
                                'rgba(245, 158, 11, 0.8)',
                                'rgba(239, 68, 68, 0.8)',
                                'rgba(107, 114, 128, 0.8)',
                                'rgba(99, 102, 241, 0.8)',
                                'rgba(168, 85, 247, 0.8)',
                                'rgba(236, 72, 153, 0.8)',
                                'rgba(248, 113, 113, 0.8)',
                                'rgba(251, 191, 36, 0.8)'
                            ],
                            borderWidth: 0,
                            borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    padding: 15,
                                    font: { size: 11 }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: 'rgba(59, 130, 246, 0.5)',
                                borderWidth: 1,
                                padding: 12,
                                callbacks: {
                                    label: function(context) {
                                        return context.label + ': ' + context.parsed + 's';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        // Historical Performance Chart with proper bounds
        const historyCtx = document.getElementById('historyChart')?.getContext('2d');
        if (historyCtx) {
            const historicalData = ${JSON.stringify(installData.historicalTrends || [])};
            
            // Filter out invalid data and ensure we have numbers
            const validHistoricalData = historicalData
                .filter(h => h.duration && !isNaN(h.duration) && h.duration > 0)
                .map(h => ({
                    ...h,
                    duration: Math.max(0, h.duration) // Ensure non-negative
                }));
            
            if (validHistoricalData.length > 0) {
                const gradient = historyCtx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                
                // Calculate sensible Y-axis bounds
                const durations = validHistoricalData.map(h => Math.round(h.duration / 1000));
                const maxDuration = Math.max(...durations);
                const minDuration = Math.min(...durations);
                
                // Set Y-axis max with some padding
                const yAxisMax = maxDuration > 0 ? Math.ceil(maxDuration * 1.2) : 30;
                const yAxisMin = 0; // Always start at 0
                
                new Chart(historyCtx, {
                    type: 'line',
                    data: {
                        labels: validHistoricalData.map(h => h.date),
                        datasets: [{
                            label: 'Install Duration',
                            data: durations,
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
                                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: 'rgba(59, 130, 246, 0.5)',
                                borderWidth: 1,
                                padding: 12,
                                callbacks: {
                                    label: function(context) {
                                        return context.parsed.y + ' seconds';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                min: yAxisMin,
                                max: yAxisMax,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    stepSize: Math.max(5, Math.ceil(yAxisMax / 6)),
                                    precision: 0,
                                    callback: function(value) {
                                        return Math.floor(value) + 's';
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
                // Show placeholder text if no data
                historyCtx.font = '14px Inter';
                historyCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                historyCtx.textAlign = 'center';
                historyCtx.fillText('No historical data available', historyCtx.canvas.width / 2, historyCtx.canvas.height / 2);
            }
        }

        // Animate progress fills on load
        setTimeout(() => {
            document.querySelectorAll('.time-fill').forEach(el => {
                el.style.width = el.style.width;
            });
        }, 100);

        // Countdown timer
        let countdown = 60;
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            setInterval(() => {
                countdown--;
                countdownEl.textContent = countdown;
                if (countdown <= 0) {
                    location.reload();
                }
            }, 1000);
        }

        // Add some interactive hover effects
        document.querySelectorAll('.metric-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                card.style.background = \`
                    radial-gradient(circle at \${x}px \${y}px, 
                        rgba(59, 130, 246, 0.1) 0%, 
                        rgba(17, 25, 40, 0.75) 50%)
                \`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.background = '';
            });
        });
    </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
  
  } catch (error: any) {
    console.error('[Install Analytics UI] Error:', error);
    
    // If we can't fetch data, still show the page with navigation
    const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install Analytics - Error</title>
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
            <h1 class="text-2xl font-bold mb-4">Unable to Load Analytics</h1>
            <p class="text-gray-400 mb-6">There was an error loading the analytics data.</p>
            <a href="/api/analytics/dashboard-ui" 
               class="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Return to Dashboard
            </a>
        </div>
    </div>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(fallbackHtml);
  }
}