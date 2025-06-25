🚀 LPai WebSocket Implementation & Build Guide
Save this file for reference!
📋 Current Status:

✅ WebSocket code implemented (Ably replacing SSE)
✅ Backend updated (messages.ts & directProcessor.ts)
✅ Frontend updated (ConversationsList.tsx)
❌ Local Android build failing (missing resources)
⏳ Ready for EAS cloud build

🔧 What We've Done:
1. Backend Changes:
typescript// Added Ably to: lpai-backend/src/utils/webhooks/processors/messages.ts
// Added Ably to: lpai-backend/src/utils/webhooks/directProcessor.ts
// Both now emit real-time events when messages arrive
2. Frontend Changes:
typescript// Updated: src/components/ConversationsList.tsx
// - Removed SSE/EventSource
// - Added Ably WebSocket connection
// - Messages now appear instantly
3. Environment Variables:
env# Already set in both .env files:
ABLY_API_KEY=vL_QGw.wgR5wg:8n2Gst6H2I2rpNGe4O3YtXKFqNyiBBm6FLK17E5OBv8
EXPO_PUBLIC_ABLY_KEY=vL_QGw.wgR5wg:8n2Gst6H2I2rpNGe4O3YtXKFqNyiBBm6FLK17E5OBv8
📦 Dependencies Analysis:
KEEP THESE (Already installed):
bashexpo-notifications     # Push notifications ✅
expo-haptics          # Vibration feedback ✅
expo-file-system      # Read/write files ✅
expo-document-picker  # Upload documents ✅
expo-image-picker     # Upload photos ✅
expo-location         # GPS for field workers ✅
expo-device          # Device info ✅
expo-constants       # App constants ✅
ADD THESE (Definitely needed):
bashexpo-updates         # OTA updates (MUST HAVE!)
expo-print           # Generate PDFs properly
expo-media-library   # Save PDFs to phone
expo-clipboard       # Copy quote details
expo-network         # Check if online/offline
DON'T NEED:

❌ expo-sharing (you're right - all through GHL)
❌ expo-barcode-scanner (not needed)
❌ expo-calendar (using GHL calendar)
❌ expo-contacts (GHL handles contacts)
❌ expo-sms (GHL sends SMS)
❌ expo-camera (unless you want photo capture?)

🏗️ Build Process:
1. Install Only What We Need:
powershell# Add the essential missing packages
npx expo install expo-updates expo-print expo-media-library expo-clipboard expo-network
2. Configure EAS (if not done):
powershell# Check if eas.json exists
Get-Content eas.json

# If not, create it:
eas build:configure
3. Update eas.json for APK:
json{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
4. Build the APK:
powershell# Clean everything first
Remove-Item -Recurse -Force android
Remove-Item -Recurse -Force ios

# Build on EAS cloud
eas build --platform android --profile preview
5. Setup OTA Updates:
powershell# After build succeeds, configure updates
eas update:configure

# Future updates without rebuilding:
eas update --branch preview --message "Fixed XYZ feature"
🧪 Testing Plan:

Download APK from EAS (takes ~15 min to build)
Install on test devices (your phone, team phones)
Test WebSocket messaging:

Send SMS to test number
Should appear instantly (no 2-sec delay)
Check console for "[Ably] Connected"


Test OTA updates:

Make a small change
Run eas update
Restart app - changes appear!



🚨 Troubleshooting:
If build fails on EAS:

Check build logs on expo.dev
Usually missing assets or colors.xml
May need to add environment variables:

powershelleas secret:push
If WebSockets don't work:

Check Ably key is correct
Verify backend is deployed to Vercel
Check contact has assignedTo field
Look for errors in Metro logs

🎯 Next Steps:

Install minimal dependencies (5 packages above)
Run EAS build
Test APK on real devices
Setup OTA updates
Deploy to team!