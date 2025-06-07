// pages/api/sync/progress/[id].ts - COMPLETE FILE

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: entityId, ui } = req.query;

  if (!entityId || typeof entityId !== 'string') {
    return res.status(400).json({ error: 'ID is required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Check if this is a company or location ID
    let isCompany = false;
    let locations = [];
    let primaryLocation = null;

    // First, check if it's a company
    const companyCheck = await db.collection('locations').findOne({
      companyId: entityId,
      isCompanyLevel: true
    });

    if (companyCheck) {
      isCompany = true;
      // Get all locations under this company
      locations = await db.collection('locations')
        .find({ 
          companyId: entityId,
          locationId: { $ne: null }
        })
        .sort({ createdAt: -1 })
        .toArray();
    } else {
      // It's a location ID
      primaryLocation = await db.collection('locations').findOne({ 
        locationId: entityId 
      });
      
      if (primaryLocation) {
        locations = [primaryLocation];
      }
    }

    // If UI requested, render the sexy interface
    if (ui === 'true') {
      const html = generateProgressUI(entityId, isCompany, locations);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // API response for polling
    const progressData = locations.map(loc => ({
      locationId: loc.locationId,
      locationName: loc.name || 'Unknown Location',
      setupCompleted: loc.setupCompleted || false,
      syncProgress: loc.syncProgress || {},
      setupResults: loc.setupResults || null,
      error: loc.setupError || null
    }));

    return res.status(200).json({
      entityId,
      isCompany,
      companyName: companyCheck?.name || null,
      locations: progressData,
      allComplete: locations.every(loc => loc.setupCompleted),
      anyErrors: locations.some(loc => loc.setupError)
    });

  } catch (error: any) {
    console.error('[Sync Progress] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
}

function generateProgressUI(entityId: string, isCompany: boolean, locations: any[]): string {
  const hasLocations = locations.length > 0;
  
  // Separate active/syncing locations from inactive ones
  const activeLocations = locations.filter(loc => 
    loc.syncProgress?.overall?.status === 'syncing' || 
    loc.syncProgress?.overall?.status === 'complete' ||
    loc.setupCompleted ||
    loc.appInstalled // Locations where app is installed
  );
  
  const inactiveLocations = locations.filter(loc => 
    !loc.setupCompleted && 
    !loc.appInstalled &&
    (!loc.syncProgress || loc.syncProgress?.overall?.status === 'pending')
  );
  
  const allComplete = locations.every(loc => loc.setupCompleted);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LPai Installation Progress</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * { font-family: 'Inter', sans-serif; }
        
        body {
            background: #0a0a0a;
            overflow-x: hidden;
            position: relative;
            min-height: 100vh;
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
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .glass-inactive {
            background: rgba(17, 25, 40, 0.4);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            opacity: 0.6;
        }

        .neon-glow {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5),
                        inset 0 0 30px rgba(59, 130, 246, 0.1);
        }

        .sync-indicator {
            width: 12px;
            height: 12px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse 2s infinite;
            display: inline-block;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        .float {
            animation: float 3s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }

        .pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .spin {
            animation: spin 1s linear infinite;
        }

        .progress-ring {
            transform: rotate(-90deg);
            transform-origin: 50% 50%;
        }

        .progress-bar {
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
                rgba(255, 255, 255, 0.2),
                transparent
            );
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .step-item {
            transition: all 0.3s ease;
        }

        .step-item:hover {
            transform: translateX(5px);
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

        .location-card {
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .location-card:hover:not(.inactive) {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3);
        }

        .location-card.inactive {
            cursor: default;
        }

        .success-animation {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
        }

        @keyframes checkmark {
            0% {
                stroke-dashoffset: 100;
            }
            100% {
                stroke-dashoffset: 0;
            }
        }

        .checkmark {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: checkmark 0.5s ease-out forwards;
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
    </style>
</head>
<body class="text-white">
    <div id="particles-js"></div>
    
    <div class="content-wrapper min-h-screen p-6">
        <div class="max-w-6xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-12 slide-in">
                <h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    ${allComplete ? '🎉 Installation Complete!' : '⚡ Installing LPai'}
                </h1>
                <p class="text-xl text-gray-400">
                    ${isCompany ? 'Setting up your agency and locations' : 'Configuring your location'}
                </p>
            </div>

            ${!hasLocations ? `
                <!-- Waiting State -->
                <div class="glass rounded-2xl p-12 text-center slide-in">
                    <div class="w-24 h-24 mx-auto mb-8 relative">
                        <div class="absolute inset-0 bg-blue-500 rounded-full opacity-20 pulse"></div>
                        <div class="absolute inset-2 bg-blue-500 rounded-full opacity-40 pulse" style="animation-delay: 0.5s"></div>
                        <div class="absolute inset-4 bg-blue-500 rounded-full opacity-60 pulse" style="animation-delay: 1s"></div>
                        <div class="absolute inset-6 bg-blue-500 rounded-full"></div>
                    </div>
                    <h2 class="text-2xl font-semibold mb-4">Initializing Installation...</h2>
                    <p class="text-gray-400 mb-8">Please wait while we set up your workspace</p>
                    <div class="flex justify-center items-center gap-2 text-sm text-gray-500">
                        <div class="w-2 h-2 bg-blue-500 rounded-full pulse"></div>
                        <span>Connecting to services</span>
                    </div>
                </div>
            ` : isCompany ? `
                <!-- Company View with Multiple Locations -->
                
                ${activeLocations.length > 0 ? `
                    <div class="mb-12">
                        <h2 class="text-2xl font-semibold mb-6 flex items-center gap-3">
                            <span class="sync-indicator"></span>
                            Installing Locations
                        </h2>
                        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            ${activeLocations.map((location, index) => generateLocationCard(location, index, false)).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${inactiveLocations.length > 0 ? `
                    <div class="mb-8">
                        <h2 class="text-xl font-semibold mb-4 text-gray-400">Other Locations</h2>
                        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            ${inactiveLocations.map((location, index) => generateLocationCard(location, index, true)).join('')}
                        </div>
                    </div>
                ` : ''}
                
            ` : `
                <!-- Single Location View -->
                ${generateDetailedProgress(locations[0])}
            `}

            ${allComplete && hasLocations ? `
                <!-- Success State -->
                <div class="mt-12 text-center slide-in" style="animation-delay: 0.5s">
                    <div class="glass rounded-2xl p-8 inline-block">
                        <h2 class="text-3xl font-bold mb-4">🚀 You're All Set!</h2>
                        <p class="text-gray-400 mb-8">Your LPai installation is complete and ready to use</p>
                        <a href="https://leadprospecting.ai/dashboard" 
                           class="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-semibold text-lg hover:scale-105 transition-transform">
                            <span>Check Out Your New Dashboard</span>
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                            </svg>
                        </a>
                    </div>
                </div>
            ` : ''}

            <!-- Footer -->
            <div class="mt-16 text-center text-gray-500 text-sm">
                <p>Having issues? Contact support at support@leadprospecting.ai</p>
            </div>
        </div>
    </div>

    <!-- Success Animation Overlay -->
    <div class="success-animation">
        <svg class="w-32 h-32" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="#10b981" stroke-width="4" fill="none" />
            <path class="checkmark" d="M25 50 L40 65 L75 30" stroke="#10b981" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    </div>

    <script>
        // Initialize particles
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: '#3b82f6' },
                shape: { type: 'circle' },
                opacity: { value: 0.3, random: true },
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
                    speed: 1,
                    direction: 'none',
                    random: true,
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

        // Polling for updates
        const entityId = '${entityId}';
        const isCompany = ${isCompany};
        let pollInterval;
        let isComplete = ${allComplete};

        async function checkProgress() {
            try {
                const response = await fetch(\`/api/sync/progress/\${entityId}\`);
                const data = await response.json();
                
                // Check if any locations need setup to be triggered
                data.locations.forEach(location => {
                    if (!location.syncProgress || 
                        (!location.setupCompleted && location.syncProgress?.overall?.status !== 'syncing')) {
                        // Trigger setup for this location
                        triggerSetup(location.locationId);
                    }
                });
                
                if (data.allComplete && !isComplete) {
                    isComplete = true;
                    showSuccessAnimation();
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else if (!isComplete) {
                    // Update progress dynamically
                    updateProgress(data);
                }
                
            } catch (error) {
                console.error('Failed to check progress:', error);
            }
        }

        async function triggerSetup(locationId) {
            try {
                const response = await fetch('/api/locations/setup-location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locationId, fullSync: true })
                });
                
                if (response.ok) {
                    console.log(\`Setup triggered for location \${locationId}\`);
                }
            } catch (error) {
                console.error(\`Failed to trigger setup for \${locationId}:\`, error);
            }
        }

        function updateProgress(data) {
            // Update each location's progress
            data.locations.forEach(location => {
                updateLocationProgress(location);
            });
        }

        function updateLocationProgress(location) {
            const card = document.getElementById(\`location-\${location.locationId}\`);
            if (!card) return;

            // Update overall progress
            const progress = calculateOverallProgress(location.syncProgress);
            const progressBar = card.querySelector('.progress-bar');
            const progressText = card.querySelector('.progress-text');
            
            if (progressBar) progressBar.style.width = \`\${progress}%\`;
            if (progressText) progressText.textContent = \`\${progress}%\`;

            // Update status
            const statusElement = card.querySelector('.status-indicator');
            if (statusElement) {
                const status = location.setupCompleted ? 'complete' : 
                              location.syncProgress?.overall?.status || 'pending';
                
                if (status === 'complete') {
                    statusElement.innerHTML = '<span class="text-green-500 text-2xl">✓</span>';
                } else if (status === 'syncing') {
                    statusElement.innerHTML = '<div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full spin"></div>';
                }
            }
        }

        function calculateOverallProgress(syncProgress) {
            if (!syncProgress) return 0;
            
            const steps = Object.keys(syncProgress).filter(k => k !== 'overall');
            if (steps.length === 0) return 0;
            
            const completed = steps.filter(k => syncProgress[k]?.status === 'complete').length;
            return Math.round((completed / steps.length) * 100);
        }

        function showSuccessAnimation() {
            const animation = document.querySelector('.success-animation');
            animation.style.display = 'block';
        }

        // Start polling if not complete
        if (!isComplete) {
            pollInterval = setInterval(checkProgress, 2000);
            
            // Also check immediately
            checkProgress();
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (pollInterval) clearInterval(pollInterval);
        });

        // Click handler for location cards in company view
        function viewLocationDetails(locationId) {
            window.location.href = \`/api/sync/progress/\${locationId}?ui=true\`;
        }
    </script>
</body>
</html>
`;
}

function generateLocationCard(location: any, index: number, isInactive: boolean = false): string {
  const progress = calculateProgress(location.syncProgress);
  const status = location.setupCompleted ? 'complete' : 
                 location.setupError ? 'error' : 
                 location.syncProgress?.overall?.status || 'pending';
  
  return `
    <div id="location-${location.locationId}" 
         class="location-card ${isInactive ? 'glass-inactive inactive' : 'glass'} rounded-2xl p-6 slide-in" 
         style="animation-delay: ${index * 0.1}s"
         ${!isInactive ? `onclick="viewLocationDetails('${location.locationId}')"` : ''}>
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h3 class="text-xl font-semibold mb-1">${location.name || 'Unknown Location'}</h3>
          <p class="text-sm text-gray-400">${location.locationId}</p>
        </div>
        <div class="status-indicator text-right">
          ${status === 'complete' ? 
            '<span class="text-green-500 text-2xl">✓</span>' :
            status === 'error' ? 
            '<span class="text-red-500 text-2xl">✗</span>' :
            status === 'syncing' ?
            '<div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full spin"></div>' :
            isInactive ? 
            '<span class="text-gray-500 text-sm">Not installed</span>' :
            '<span class="text-gray-500 text-sm">Pending</span>'
          }
        </div>
      </div>

      ${!isInactive ? `
        <!-- Progress -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm text-gray-400">Overall Progress</span>
            <span class="progress-text text-sm font-semibold">${progress}%</span>
          </div>
          <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div class="progress-bar h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                 style="width: ${progress}%"></div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-gray-400">Status</p>
            <p class="font-semibold capitalize">${status}</p>
          </div>
          <div>
            <p class="text-gray-400">Started</p>
            <p class="font-semibold">${location.syncProgress?.overall?.startedAt ? 
              new Date(location.syncProgress.overall.startedAt).toLocaleTimeString() : 
              'Not started'}</p>
          </div>
        </div>

        <!-- View Details -->
        <div class="mt-6 pt-6 border-t border-gray-700 text-center">
          <span class="text-blue-400 text-sm font-medium">View Details →</span>
        </div>
      ` : ''}
    </div>
  `;
}

function generateDetailedProgress(location: any): string {
  const steps = [
    { key: 'locationDetails', name: 'Location Configuration', icon: '🏢' },
    { key: 'pipelines', name: 'Sales Pipelines', icon: '📊' },
    { key: 'calendars', name: 'Calendar Integration', icon: '📅' },
    { key: 'users', name: 'User Accounts', icon: '👥' },
    { key: 'customFields', name: 'Custom Fields', icon: '⚙️' },
    { key: 'tags', name: 'Tags & Labels', icon: '🏷️' },
    { key: 'customValues', name: 'Custom Values', icon: '📝' },
    { key: 'contacts', name: 'Contact Import', icon: '👤' },
    { key: 'tasks', name: 'Tasks & Activities', icon: '✅' },
    { key: 'opportunities', name: 'Projects & Opportunities', icon: '💼' },
    { key: 'appointments', name: 'Appointments', icon: '🗓️' },
    { key: 'conversations', name: 'Message History', icon: '💬' },
    { key: 'invoices', name: 'Invoices & Payments', icon: '💰' },
    { key: 'defaults', name: 'Default Settings', icon: '🔧' }
  ];

  const syncProgress = location.syncProgress || {};
  const setupResults = location.setupResults || {};
  const overallProgress = calculateProgress(syncProgress);

  // Calculate total time
  let totalTime = 0;
  if (setupResults.duration) {
    const match = setupResults.duration.match(/(\d+\.?\d*)s/);
    if (match) {
      totalTime = parseFloat(match[1]);
    }
  }

  return `
    <div class="glass rounded-2xl p-8 slide-in">
      <!-- Location Header -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold mb-2">${location.name || 'Location Setup'}</h2>
        <p class="text-gray-400">${location.locationId}</p>
      </div>

      <!-- Overall Progress -->
      <div class="mb-8">
        <div class="relative w-48 h-48 mx-auto mb-6">
          <svg class="progress-ring w-48 h-48">
            <circle cx="96" cy="96" r="88" stroke="rgba(255,255,255,0.1)" stroke-width="12" fill="none" />
            <circle cx="96" cy="96" r="88" 
                stroke="url(#gradient)" 
                stroke-width="12" 
                fill="none"
                stroke-dasharray="${overallProgress * 5.52} 552"
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
            <span class="text-5xl font-bold">${overallProgress}%</span>
            <span class="text-sm text-gray-400">Complete</span>
          </div>
        </div>
        ${totalTime > 0 ? `
          <div class="text-center">
            <p class="text-lg text-gray-400">Total time: <span class="font-bold text-white">${totalTime.toFixed(1)}s</span></p>
          </div>
        ` : ''}
      </div>

      <!-- Progress Steps with Analytics-style tracking -->
      <div class="space-y-4">
        ${steps.map(step => {
          const stepData = syncProgress[step.key] || { status: 'pending' };
          const stepResult = setupResults.steps?.[step.key] || {};
          const isComplete = stepData.status === 'complete';
          const isSyncing = stepData.status === 'syncing';
          const isFailed = stepData.status === 'failed';
          
          // Parse duration from setupResults (like analytics)
          let duration = 0;
          let durationStr = '0s';
          if (stepResult.duration) {
            if (typeof stepResult.duration === 'string') {
              const match = stepResult.duration.match(/(\d+\.?\d*)(\w+)/);
              if (match) {
                const value = parseFloat(match[1]);
                const unit = match[2];
                if (unit === 'ms') {
                  duration = value / 1000;
                  durationStr = duration < 1 ? `${value.toFixed(0)}ms` : `${duration.toFixed(1)}s`;
                } else if (unit === 's') {
                  duration = value;
                  durationStr = `${duration.toFixed(1)}s`;
                }
              }
            }
          }
          
          // Calculate percentage of total time
          const percentage = totalTime > 0 && duration > 0 ? (duration / totalTime) * 100 : 0;
          
          // Get current progress for syncing items
          let currentProgress = 0;
          let progressText = '';
          if (isSyncing) {
            if (stepData.percent) {
              currentProgress = stepData.percent;
              progressText = `${currentProgress}%`;
            } else if (stepData.current && stepData.total) {
              currentProgress = Math.round((stepData.current / stepData.total) * 100);
              progressText = `${stepData.current} / ${stepData.total}`;
            } else {
              currentProgress = 50; // Default for unknown progress
              progressText = 'Processing...';
            }
          }
          
          return `
            <div data-step="${step.key}" class="step-item p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-4">
                  <span class="text-2xl">${step.icon}</span>
                  <div>
                    <h4 class="font-semibold">${step.name}</h4>
                    ${isComplete && durationStr !== '0s' ? 
                      `<p class="text-sm text-gray-400 mt-1">Completed in ${durationStr}</p>` :
                      isSyncing && progressText ? 
                      `<p class="text-sm text-blue-400 mt-1">${progressText}</p>` :
                      isFailed && stepData.error ? 
                      `<p class="text-sm text-red-400 mt-1">${stepData.error}</p>` :
                      ''
                    }
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  ${isComplete && percentage > 0 ? 
                    `<span class="text-sm text-gray-400">${percentage.toFixed(1)}% of total</span>` : 
                    ''
                  }
                  <span class="status-text text-sm text-gray-400">
                    ${isComplete ? 'Complete' : isSyncing ? 'Syncing...' : isFailed ? 'Failed' : 'Pending'}
                  </span>
                  <span class="status-icon text-xl">
                    ${isComplete ? '✓' : isSyncing ? '⟳' : isFailed ? '✗' : '○'}
                  </span>
                </div>
              </div>
              
              ${isSyncing || (isComplete && percentage > 0) ? `
                <div class="h-2 bg-gray-700 rounded-full overflow-hidden progress-bar">
                  <div class="h-full rounded-full transition-all duration-1000 ${
                    isComplete ? 'bg-green-500' : 
                    isSyncing ? 'bg-blue-500' : 
                    'bg-gray-600'
                  }" style="width: ${isComplete ? '100' : currentProgress}%"></div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Error Summary -->
      ${location.setupError ? `
        <div class="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <h4 class="font-semibold text-red-500 mb-2">Setup Error</h4>
          <p class="text-sm text-gray-300">${location.setupError}</p>
          <button onclick="retrySetup('${location.locationId}')" 
                  class="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors">
            Retry Setup
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function calculateProgress(syncProgress: any): number {
  if (!syncProgress) return 0;
  
  const steps = Object.keys(syncProgress).filter(k => k !== 'overall');
  if (steps.length === 0) return 0;
  
  const completed = steps.filter(k => syncProgress[k]?.status === 'complete').length;
  return Math.round((completed / steps.length) * 100);
}