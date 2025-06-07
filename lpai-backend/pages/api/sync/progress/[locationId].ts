// pages/api/sync/progress/[locationId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  
  if (req.method === 'GET' && locationId && typeof locationId === 'string') {
    // Return current sync progress data
    try {
      const client = await clientPromise;
      const db = client.db('lpai');
      
      const location = await db.collection('locations').findOne(
        { locationId },
        { 
          projection: { 
            name: 1,
            setupCompleted: 1,
            setupCompletedAt: 1,
            setupResults: 1,
            syncProgress: 1,
            contactCount: 1,
            conversationCount: 1,
            appointmentCount: 1,
            projectCount: 1,
            invoiceCount: 1,
            tagCount: 1,
            userCount: 1
          } 
        }
      );
      
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      // Calculate overall progress
      const steps = location.setupResults?.steps || {};
      const totalSteps = Object.keys(steps).length || 12;
      const completedSteps = Object.values(steps).filter((s: any) => s.success).length;
      const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      
      return res.status(200).json({
        locationId,
        locationName: location.name || 'Unknown Location',
        setupCompleted: location.setupCompleted || false,
        setupCompletedAt: location.setupCompletedAt,
        overallProgress,
        currentStep: getCurrentStep(steps),
        syncProgress: location.syncProgress || {},
        counts: {
          contacts: location.contactCount || 0,
          conversations: location.conversationCount || 0,
          appointments: location.appointmentCount || 0,
          projects: location.projectCount || 0,
          invoices: location.invoiceCount || 0,
          tags: location.tagCount || 0,
          users: location.userCount || 0
        },
        steps: formatSteps(steps),
        setupDuration: location.setupResults?.duration
      });
      
    } catch (error: any) {
      console.error('[Sync Progress API] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }
  }
  
  // HTML UI for viewing progress
  if (req.method === 'GET' && req.query.ui === 'true') {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LPai Sync Progress</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            width: 100%;
            max-width: 900px;
            background: rgba(17, 25, 40, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.125);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.3);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: bold;
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
            color: #9ca3af;
            font-size: 1.1em;
        }
        
        .overall-progress {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            position: relative;
            overflow: hidden;
        }
        
        .overall-progress::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
            animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .progress-circle {
            width: 150px;
            height: 150px;
            margin: 0 auto 20px;
            position: relative;
        }
        
        .progress-ring {
            transform: rotate(-90deg);
        }
        
        .progress-value {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 3em;
            font-weight: bold;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
            border-color: rgba(59, 130, 246, 0.5);
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 0.9em;
            color: #9ca3af;
        }
        
        .steps-container {
            margin-top: 30px;
        }
        
        .step {
            display: flex;
            align-items: center;
            padding: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            margin-bottom: 15px;
            border: 1px solid transparent;
            transition: all 0.3s ease;
        }
        
        .step.active {
            background: rgba(59, 130, 246, 0.1);
            border-color: rgba(59, 130, 246, 0.3);
        }
        
        .step.completed {
            background: rgba(16, 185, 129, 0.1);
            border-color: rgba(16, 185, 129, 0.3);
        }
        
        .step.failed {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.3);
        }
        
        .step-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20px;
            font-size: 20px;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .step.active .step-icon {
            background: #3b82f6;
            animation: pulse 2s infinite;
        }
        
        .step.completed .step-icon {
            background: #10b981;
        }
        
        .step.failed .step-icon {
            background: #ef4444;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        .step-content {
            flex: 1;
        }
        
        .step-name {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .step-details {
            font-size: 0.9em;
            color: #9ca3af;
        }
        
        .step-progress {
            margin-left: auto;
            text-align: right;
        }
        
        .step-time {
            font-size: 0.9em;
            color: #6b7280;
        }
        
        .progress-bar {
            width: 100px;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 5px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            border-radius: 2px;
            transition: width 0.5s ease;
        }
        
        .loading {
            animation: rotate 1s linear infinite;
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .complete-message {
            text-align: center;
            padding: 40px;
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1));
            border-radius: 16px;
            margin-top: 30px;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        
        .complete-icon {
            font-size: 4em;
            margin-bottom: 20px;
        }
        
        .error-message {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">LP</div>
            <h1>Sync Progress</h1>
            <p class="subtitle" id="location-name">Loading...</p>
        </div>
        
        <div class="overall-progress">
            <div class="progress-circle">
                <svg width="150" height="150">
                    <circle cx="75" cy="75" r="65" stroke="rgba(255,255,255,0.1)" stroke-width="10" fill="none" />
                    <circle cx="75" cy="75" r="65" 
                        stroke="url(#gradient)" 
                        stroke-width="10" 
                        fill="none"
                        stroke-dasharray="408"
                        stroke-dashoffset="408"
                        stroke-linecap="round"
                        class="progress-ring"
                        id="progress-ring" />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#3b82f6" />
                            <stop offset="50%" stop-color="#8b5cf6" />
                            <stop offset="100%" stop-color="#ec4899" />
                        </linearGradient>
                    </defs>
                </svg>
                <div class="progress-value" id="progress-percent">0%</div>
            </div>
            <p style="text-align: center; color: #9ca3af;" id="current-status">Initializing sync...</p>
        </div>
        
        <div class="stats-grid" id="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="contacts-count">0</div>
                <div class="stat-label">Contacts</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="conversations-count">0</div>
                <div class="stat-label">Conversations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="appointments-count">0</div>
                <div class="stat-label">Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="projects-count">0</div>
                <div class="stat-label">Projects</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="invoices-count">0</div>
                <div class="stat-label">Invoices</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="users-count">0</div>
                <div class="stat-label">Users</div>
            </div>
        </div>
        
        <div class="steps-container" id="steps-container">
            <!-- Steps will be dynamically inserted here -->
        </div>
        
        <div id="complete-message" style="display: none;" class="complete-message">
            <div class="complete-icon">🎉</div>
            <h2>Sync Complete!</h2>
            <p style="margin-top: 10px; color: #9ca3af;">Your LPai App is ready to use.</p>
        </div>
        
        <div id="error-message" style="display: none;" class="error-message">
            <p>⚠️ <span id="error-text">An error occurred during sync</span></p>
        </div>
    </div>
    
    <script>
        const locationId = window.location.pathname.split('/').pop();
        let pollInterval;
        
        async function fetchProgress() {
            try {
                const response = await fetch(\`/api/sync/progress/\${locationId}\`);
                if (!response.ok) throw new Error('Failed to fetch progress');
                
                const data = await response.json();
                updateUI(data);
                
                if (data.setupCompleted) {
                    clearInterval(pollInterval);
                    showComplete();
                }
            } catch (error) {
                console.error('Error fetching progress:', error);
                showError(error.message);
            }
        }
        
        function updateUI(data) {
            // Update location name
            document.getElementById('location-name').textContent = data.locationName;
            
            // Update overall progress
            const percent = data.overallProgress || 0;
            document.getElementById('progress-percent').textContent = percent + '%';
            const circumference = 2 * Math.PI * 65; // radius = 65
            const offset = circumference - (percent / 100 * circumference);
            document.getElementById('progress-ring').style.strokeDashoffset = offset;
            
            // Update current status
            document.getElementById('current-status').textContent = data.currentStep || 'Processing...';
            
            // Update counts
            document.getElementById('contacts-count').textContent = formatNumber(data.counts.contacts);
            document.getElementById('conversations-count').textContent = formatNumber(data.counts.conversations);
            document.getElementById('appointments-count').textContent = formatNumber(data.counts.appointments);
            document.getElementById('projects-count').textContent = formatNumber(data.counts.projects);
            document.getElementById('invoices-count').textContent = formatNumber(data.counts.invoices);
            document.getElementById('users-count').textContent = formatNumber(data.counts.users);
            
            // Update steps
            const stepsContainer = document.getElementById('steps-container');
            stepsContainer.innerHTML = '';
            
            data.steps.forEach(step => {
                const stepEl = createStepElement(step, data.syncProgress);
                stepsContainer.appendChild(stepEl);
            });
        }
        
        function createStepElement(step, syncProgress) {
            const div = document.createElement('div');
            div.className = \`step \${step.status}\`;
            
            const icon = step.status === 'completed' ? '✓' : 
                        step.status === 'failed' ? '✗' : 
                        step.status === 'active' ? '<span class="loading">⟳</span>' : '○';
            
            // Get real-time progress for active steps
            let progressInfo = '';
            if (step.key === 'contacts' && syncProgress.contacts) {
                const p = syncProgress.contacts;
                progressInfo = \`\${p.current || 0} of \${p.total || '?'} (\${p.percent || 0}%)\`;
            } else if (step.key === 'conversations' && syncProgress.conversations) {
                const p = syncProgress.conversations;
                progressInfo = \`\${p.current || 0} of \${p.total || '?'} (\${p.percent || 0}%)\`;
            } else if (step.key === 'appointments' && syncProgress.appointments) {
                const p = syncProgress.appointments;
                progressInfo = \`\${p.current || 0} synced\`;
            } else if (step.key === 'opportunities' && syncProgress.opportunities) {
                const p = syncProgress.opportunities;
                progressInfo = \`\${p.created || 0} created, \${p.updated || 0} updated\`;
            } else if (step.result) {
                progressInfo = step.result;
            }
            
            div.innerHTML = \`
                <div class="step-icon">\${icon}</div>
                <div class="step-content">
                    <div class="step-name">\${step.name}</div>
                    <div class="step-details">\${step.details || 'Waiting...'}</div>
                </div>
                <div class="step-progress">
                    <div class="step-time">\${step.time || ''}</div>
                    \${progressInfo ? \`<div style="color: #3b82f6; font-size: 0.9em;">\${progressInfo}</div>\` : ''}
                    \${step.status === 'active' && step.percent !== undefined ? \`
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${step.percent}%"></div>
                        </div>
                    \` : ''}
                </div>
            \`;
            
            return div;
        }
        
        function formatNumber(num) {
            return num.toLocaleString();
        }
        
        function showComplete() {
            document.getElementById('current-status').textContent = 'Sync completed successfully!';
            document.getElementById('complete-message').style.display = 'block';
        }
        
        function showError(message) {
            document.getElementById('error-text').textContent = message;
            document.getElementById('error-message').style.display = 'block';
        }
        
        // Start polling
        fetchProgress();
        pollInterval = setInterval(fetchProgress, 2000); // Poll every 2 seconds
    </script>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper functions
function getCurrentStep(steps: any): string {
  const stepOrder = [
    'locationDetails',
    'pipelines',
    'calendars',
    'users',
    'customFields',
    'customValues',
    'tags',
    'contacts',
    'tasks',
    'opportunities',
    'appointments',
    'conversations',
    'invoices',
    'defaults'
  ];
  
  for (const stepName of stepOrder) {
    if (steps[stepName] && !steps[stepName].success) {
      return formatStepName(stepName) + '...';
    }
  }
  
  return 'Setup complete!';
}

function formatStepName(stepName: string): string {
  const nameMap: Record<string, string> = {
    locationDetails: 'Syncing location configuration',
    pipelines: 'Importing pipelines',
    calendars: 'Setting up calendars',
    users: 'Creating user accounts',
    customFields: 'Mapping custom fields',
    customValues: 'Importing custom values',
    tags: 'Syncing tags',
    contacts: 'Importing contacts',
    tasks: 'Syncing tasks',
    opportunities: 'Importing projects',
    appointments: 'Syncing appointments',
    conversations: 'Importing conversation history',
    invoices: 'Processing invoices',
    defaults: 'Configuring defaults'
  };
  
  return nameMap[stepName] || stepName;
}

function formatSteps(steps: any): any[] {
  const stepOrder = [
    'locationDetails',
    'pipelines',
    'calendars',
    'users',
    'customFields',
    'customValues',
    'tags',
    'contacts',
    'tasks',
    'opportunities',
    'appointments',
    'conversations',
    'invoices',
    'defaults'
  ];
  
  return stepOrder.map(key => {
    const step = steps[key] || {};
    let status = 'pending';
    if (step.success) status = 'completed';
    else if (step.success === false) status = 'failed';
    else if (step.processing) status = 'active';
    
    let result = '';
    if (step.created) result += `${step.created} created`;
    if (step.updated) result += `${result ? ', ' : ''}${step.updated} updated`;
    if (step.count) result = `${step.count} items`;
    if (step.totalFields) result = `${step.totalFields} fields`;
    if (step.pipelineCount) result = `${step.pipelineCount} pipelines`;
    if (step.calendarCount) result = `${step.calendarCount} calendars`;
    
    return {
      key,
      name: formatStepName(key),
      status,
      details: step.error || (status === 'completed' ? 'Completed successfully' : ''),
      time: step.duration,
      result,
      percent: step.percent
    };
  });
}