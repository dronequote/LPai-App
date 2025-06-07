// pages/api/sync/progress/[id].ts - CLEAN OBSERVATION-ONLY VERSION

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

    // If UI requested, render the interface
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

        .neon-glow {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5),
                        inset 0 0 30px rgba(59, 130, 246, 0.1);
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

        .location-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3);
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
                <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    ${locations.map((location, index) => generateLocationCard(location, index)).join('')}
                </div>
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
                        <p class="text-lg mb-8">You can now close this window and return to GoHighLevel</p>
                        <div class="text-sm text-gray-500">
                            Need help? Contact support at support@leadprospecting.ai
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Footer -->
            <div class="mt-16 text-center text-gray-500 text-sm">
                <p>Having issues? Contact support at support@leadprospecting.ai</p>
            </div>
        </div>
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

        // OBSERVATION ONLY - Just check progress, don't trigger anything
        const entityId = '${entityId}';
        const isCompany = ${isCompany};
        let pollInterval;
        let isComplete = ${allComplete};

        async function checkProgress() {
            try {
                const response = await fetch(\`/api/sync/progress/\${entityId}\`);
                const data = await response.json();
                
                if (data.allComplete && !isComplete) {
                    isComplete = true;
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else if (!isComplete) {
                    // Update progress displays
                    updateProgress(data);
                }
                
            } catch (error) {
                console.error('Failed to check progress:', error);
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
            const progressRing = card.querySelector('.progress-ring-fill');
            
            if (progressBar) progressBar.style.width = \`\${progress}%\`;
            if (progressText) progressText.textContent = \`\${progress}%\`;
            if (progressRing) progressRing.setAttribute('stroke-dasharray', \`\${progress * 5.52} 552\`);

            // Update step statuses
            if (location.syncProgress) {
                Object.keys(location.syncProgress).forEach(stepKey => {
                    if (stepKey === 'overall') return;
                    
                    const stepElement = card.querySelector(\`[data-step="\${stepKey}"]\`);
                    if (stepElement) {
                        const step = location.syncProgress[stepKey];
                        const statusIcon = stepElement.querySelector('.status-icon');
                        const statusText = stepElement.querySelector('.status-text');
                        
                        if (statusIcon) {
                            statusIcon.textContent = 
                                step.status === 'complete' ? '✓' : 
                                step.status === 'syncing' ? '⟳' : 
                                step.status === 'failed' ? '✗' : '○';
                        }
                        
                        if (statusText) {
                            statusText.textContent = 
                                step.status === 'complete' ? 'Complete' : 
                                step.status === 'syncing' ? 'Syncing...' : 
                                step.status === 'failed' ? 'Failed' : 'Pending';
                        }
                    }
                });
            }
        }

        function calculateOverallProgress(syncProgress) {
            if (!syncProgress) return 0;
            
            const steps = Object.keys(syncProgress).filter(k => k !== 'overall');
            if (steps.length === 0) return 0;
            
            const completed = steps.filter(k => syncProgress[k]?.status === 'complete').length;
            return Math.round((completed / steps.length) * 100);
        }

        // Click handler for location cards in company view
        function viewLocationDetails(locationId) {
            window.location.href = \`/api/sync/progress/\${locationId}?ui=true\`;
        }

        // Start polling if not complete (observation only)
        if (!isComplete) {
            // Check immediately
            checkProgress();
            
            // Then check every 3 seconds (less aggressive than before)
            pollInterval = setInterval(checkProgress, 3000);
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (pollInterval) clearInterval(pollInterval);
        });
    </script>
</body>
</html>
`;
}

function generateLocationCard(location: any, index: number): string {
  const progress = calculateProgress(location.syncProgress, location.setupResults);
  const isUninstalled = location.appInstalled === false; // Check current install status
  const hasStarted = location.setupResults?.startedAt || location.syncProgress?.overall?.startedAt;
  const status = isUninstalled ? 'uninstalled' :
                 location.setupCompleted ? 'complete' : 
                 location.setupError ? 'error' : 
                 hasStarted ? 'syncing' : 'pending'; // Only show syncing if actually started
  
  // Get started time from setupResults or syncProgress
  const startedAt = location.setupResults?.startedAt || location.syncProgress?.overall?.startedAt;
  const startedTime = startedAt ? new Date(startedAt).toLocaleString() : 'Not started';
  
  // Parse duration
  let duration = 'N/A';
  if (location.setupResults?.duration) {
    duration = location.setupResults.duration;
  } else if (location.syncProgress?.overall?.duration) {
    duration = location.syncProgress.overall.duration;
  }
  
  // Get counts from setupResults
  const counts = {
    contacts: location.setupResults?.steps?.contacts?.processed || location.contactCount || 0,
    customFields: location.customFieldsByModel ? 
      (location.customFieldsByModel.contact?.length || 0) + (location.customFieldsByModel.opportunity?.length || 0) : 
      location.setupResults?.steps?.customFields?.totalFields || 0,
    pipelines: location.setupResults?.steps?.pipelines?.pipelineCount || location.pipelineCount || 0,
    calendars: location.setupResults?.steps?.calendars?.calendarCount || location.calendarCount || 0,
    users: location.setupResults?.steps?.users?.total || location.userCount || 0,
    appointments: location.setupResults?.steps?.appointments?.processed || location.appointmentCount || 0
  };
  
  return `
    <div id="location-${location.locationId}" 
         class="location-card glass rounded-2xl p-6 slide-in neon-glow ${isUninstalled ? 'opacity-60' : ''}" 
         style="animation-delay: ${index * 0.1}s"
         onclick="viewLocationDetails('${location.locationId}')">
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h3 class="text-xl font-semibold mb-1">${location.name || 'Unknown Location'}</h3>
          <p class="text-sm text-gray-400">${location.locationId}</p>
          ${isUninstalled ? `<p class="text-xs text-red-400 mt-1">Uninstalled ${new Date(location.uninstalledAt).toLocaleDateString()}</p>` : ''}
        </div>
        <div class="status-indicator text-right">
          ${status === 'uninstalled' ?
            '<span class="text-gray-500 text-2xl">🚫</span>' :
            status === 'complete' ? 
            '<span class="text-green-500 text-2xl">✓</span>' :
            status === 'error' ? 
            '<span class="text-red-500 text-2xl">✗</span>' :
            status === 'syncing' ?
            '<div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full spin"></div>' :
            '<span class="text-gray-500 text-sm">Pending</span>'
          }
        </div>
      </div>

      <!-- Progress Circle -->
      <div class="relative w-32 h-32 mx-auto mb-6">
        <svg class="progress-ring w-32 h-32">
          <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="none" />
          <circle class="progress-ring-fill" cx="64" cy="64" r="58" 
              stroke="${isUninstalled ? '#6b7280' : 'url(#gradient-' + location.locationId + ')'}" 
              stroke-width="8" 
              fill="none"
              stroke-dasharray="${progress * 3.65} 365"
              stroke-linecap="round" />
          <defs>
            <linearGradient id="gradient-${location.locationId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6" />
              <stop offset="50%" stop-color="#8b5cf6" />
              <stop offset="100%" stop-color="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="progress-text text-3xl font-bold">${progress}%</span>
          <span class="text-xs text-gray-400">${isUninstalled ? 'Uninstalled' : 'Complete'}</span>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p class="text-gray-400">Status</p>
          <p class="font-semibold capitalize">${status === 'pending' ? 'Not started' : status}</p>
        </div>
        <div>
          <p class="text-gray-400">Started</p>
          <p class="font-semibold text-xs">${hasStarted ? startedTime : 'Not started'}</p>
        </div>
      </div>
      
      ${duration !== 'N/A' ? `
        <div class="mb-4 text-center">
          <p class="text-sm text-gray-400">Duration</p>
          <p class="font-bold text-lg">${duration}</p>
        </div>
      ` : ''}

      <!-- Sync Stats -->
      ${location.setupCompleted && !isUninstalled ? `
        <div class="mt-4 pt-4 border-t border-gray-700 grid grid-cols-3 gap-2 text-xs">
          ${counts.contacts > 0 ? `<div class="text-center"><p class="font-bold">${counts.contacts}</p><p class="text-gray-400">Contacts</p></div>` : ''}
          ${counts.customFields > 0 ? `<div class="text-center"><p class="font-bold">${counts.customFields}</p><p class="text-gray-400">Fields</p></div>` : ''}
          ${counts.pipelines > 0 ? `<div class="text-center"><p class="font-bold">${counts.pipelines}</p><p class="text-gray-400">Pipelines</p></div>` : ''}
          ${counts.calendars > 0 ? `<div class="text-center"><p class="font-bold">${counts.calendars}</p><p class="text-gray-400">Calendars</p></div>` : ''}
          ${counts.users > 0 ? `<div class="text-center"><p class="font-bold">${counts.users}</p><p class="text-gray-400">Users</p></div>` : ''}
          ${counts.appointments > 0 ? `<div class="text-center"><p class="font-bold">${counts.appointments}</p><p class="text-gray-400">Appts</p></div>` : ''}
        </div>
      ` : ''}

      ${location.setupError && !isUninstalled ? `
        <div class="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p class="text-sm text-red-400">${location.setupError}</p>
        </div>
      ` : ''}

      <!-- View Details -->
      <div class="mt-6 pt-6 border-t border-gray-700 text-center">
        <span class="text-blue-400 text-sm font-medium">View Details →</span>
      </div>
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
  const isUninstalled = location.uninstalledAt;

  // Calculate total time and format start time
  let totalTime = 0;
  let formattedStartTime = 'Not started';
  if (setupResults.startedAt) {
    formattedStartTime = new Date(setupResults.startedAt).toLocaleString();
  }
  if (setupResults.duration) {
    const match = setupResults.duration.match(/(\d+\.?\d*)s/);
    if (match) {
      totalTime = parseFloat(match[1]);
    }
  }

  return `
    <div class="glass rounded-2xl p-8 slide-in ${isUninstalled ? 'opacity-60' : ''}">
      <!-- Location Header -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold mb-2">${location.name || 'Location Setup'}</h2>
        <p class="text-gray-400">${location.locationId}</p>
        ${isUninstalled ? `
          <p class="text-red-400 mt-2">⚠️ This location was uninstalled on ${new Date(location.uninstalledAt).toLocaleString()}</p>
        ` : ''}
      </div>

      <!-- Overall Progress -->
      <div class="mb-8">
        <div class="relative w-48 h-48 mx-auto mb-6 float">
          <svg class="progress-ring w-48 h-48">
            <circle cx="96" cy="96" r="88" stroke="rgba(255,255,255,0.1)" stroke-width="12" fill="none" />
            <circle class="progress-ring-fill" cx="96" cy="96" r="88" 
                stroke="${isUninstalled ? '#6b7280' : 'url(#gradient)'}" 
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
            <span class="progress-text text-5xl font-bold">${overallProgress}%</span>
            <span class="text-sm text-gray-400">${isUninstalled ? 'Uninstalled' : 'Complete'}</span>
          </div>
        </div>
        ${totalTime > 0 || formattedStartTime !== 'Not started' ? `
          <div class="text-center space-y-2">
            ${totalTime > 0 ? `<p class="text-lg text-gray-400">Total time: <span class="font-bold text-white">${totalTime.toFixed(1)}s</span></p>` : ''}
            <p class="text-sm text-gray-500">Started: ${formattedStartTime}</p>
          </div>
        ` : ''}
      </div>

      <!-- Progress Steps -->
      <div class="space-y-4">
        ${steps.map(step => {
          const stepResult = setupResults.steps?.[step.key] || {};
          const syncProgressStep = syncProgress[step.key];
          
          // Follow analytics page logic - check success from setupResults
          const isComplete = stepResult.success === true;
          const isFailed = stepResult.success === false;
          const isSyncing = !isComplete && !isFailed && syncProgressStep?.status === 'syncing';
          
          // Parse duration and counts
          let durationStr = '';
          let countStr = '';
          
          if (stepResult.duration) {
            durationStr = stepResult.duration;
          }
          
          // Build count string based on step type
          switch(step.key) {
            case 'contacts':
              if (stepResult.processed) countStr = `${stepResult.processed} contacts`;
              break;
            case 'customFields':
              if (stepResult.totalFields) countStr = `${stepResult.totalFields} fields`;
              break;
            case 'pipelines':
              if (stepResult.pipelineCount) countStr = `${stepResult.pipelineCount} pipelines, ${stepResult.totalStages || 0} stages`;
              break;
            case 'calendars':
              if (stepResult.calendarCount) countStr = `${stepResult.calendarCount} calendars`;
              break;
            case 'users':
              if (stepResult.total) countStr = `${stepResult.total} users`;
              break;
            case 'tags':
              if (stepResult.totalTags) countStr = `${stepResult.totalTags} tags`;
              break;
            case 'customValues':
              if (stepResult.count) countStr = `${stepResult.count} values`;
              break;
            case 'tasks':
              if (stepResult.processed) countStr = `${stepResult.processed} tasks`;
              break;
            case 'opportunities':
              if (stepResult.processed) countStr = `${stepResult.processed} opportunities`;
              break;
            case 'appointments':
              if (stepResult.processed) countStr = `${stepResult.processed} appointments`;
              break;
            case 'conversations':
              if (stepResult.processed !== undefined) countStr = `${stepResult.processed} conversations`;
              break;
            case 'invoices':
              if (stepResult.processed) countStr = `${stepResult.processed} invoices`;
              break;
          }
          
          return `
            <div data-step="${step.key}" class="step-item p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <span class="text-2xl">${step.icon}</span>
                  <div>
                    <h4 class="font-semibold">${step.name}</h4>
                    ${isComplete && (durationStr || countStr) ? 
                      `<p class="text-sm text-gray-400 mt-1">
                        ${durationStr ? `Completed in ${durationStr}` : ''}
                        ${durationStr && countStr ? ' • ' : ''}
                        ${countStr}
                      </p>` :
                      isSyncing ? 
                      `<p class="text-sm text-blue-400 mt-1">Processing...</p>` :
                      isFailed && stepResult.error ? 
                      `<p class="text-sm text-red-400 mt-1">${stepResult.error}</p>` :
                      ''
                    }
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="status-text text-sm text-gray-400">
                    ${isComplete ? 'Complete' : isSyncing ? 'Syncing...' : isFailed ? 'Failed' : 'Pending'}
                  </span>
                  <span class="status-icon text-xl">
                    ${isComplete ? '✓' : isSyncing ? '⟳' : isFailed ? '✗' : '○'}
                  </span>
                </div>
              </div>
              
              ${isSyncing ? `
                <div class="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden progress-bar">
                  <div class="h-full bg-blue-500 rounded-full" style="width: 50%"></div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      ${location.setupError && !isUninstalled ? `
        <div class="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <h4 class="font-semibold text-red-500 mb-2">Setup Error</h4>
          <p class="text-sm text-gray-300">${location.setupError}</p>
        </div>
      ` : ''}
      
      ${location.setupCompleted && setupResults.completedAt ? `
        <div class="mt-6 text-center text-sm text-gray-500">
          <p>Completed: ${new Date(setupResults.completedAt).toLocaleString()}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function calculateProgress(syncProgress: any, setupResults?: any): number {
  // If we have setupResults with steps, use that for accuracy
  if (setupResults?.steps) {
    const steps = Object.keys(setupResults.steps);
    const completed = steps.filter(k => setupResults.steps[k]?.success === true).length;
    return steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  }
  
  // Fallback to syncProgress if no setupResults
  if (!syncProgress) return 0;
  
  const steps = Object.keys(syncProgress).filter(k => k !== 'overall');
  if (steps.length === 0) return 0;
  
  const completed = steps.filter(k => syncProgress[k]?.status === 'complete').length;
  return Math.round((completed / steps.length) * 100);
}