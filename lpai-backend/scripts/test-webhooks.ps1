# Test script for GHL webhooks - PowerShell version
# Save this as test-webhooks.ps1 in lpai-backend/scripts

$BASE_URL = "http://localhost:3000"
# For production: $BASE_URL = "https://lpai-backend-omega.vercel.app"

Write-Host "🚀 Testing GHL Webhook System" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

# Test 1: Contact Created/Changed
Write-Host "`n📧 Test 1: Contact webhook" -ForegroundColor Yellow
$contactPayload = @{
    first_name = "John"
    last_name = "Doe"
    email = "john.doe@example.com"
    phone = "+1234567890"
    tags = @("new-lead", "plumbing")
    address1 = "123 Main St"
    city = "Denver"
    state = "CO"
    postal_code = "80202"
    contact_source = "Website Form"
    company_name = "ABC Company"
    date_created = "2025-05-30T10:00:00Z"
    location = @{
        id = "JMtlZzwrNOUmLpJk2eCE"
        name = "Test Location"
        address = "456 Business Ave"
        city = "Denver"
        state = "CO"
        country = "US"
        postalCode = "80202"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$BASE_URL/api/webhooks/ghl/unified" -Method POST -Body $contactPayload -ContentType "application/json"
Write-Host "✓ Contact webhook sent" -ForegroundColor Green

# Test 2: Appointment Booked
Write-Host "`n📅 Test 2: Appointment booked webhook" -ForegroundColor Yellow
$appointmentPayload = @{
    contact_id = "ghl_contact_123"
    first_name = "John"
    last_name = "Doe"
    email = "john.doe@example.com"
    phone = "+1234567890"
    location = @{
        id = "JMtlZzwrNOUmLpJk2eCE"
        name = "Test Location"
    }
    calendar = @{
        id = "cal_123"
        calendarName = "Service Appointments"
        title = "Plumbing Consultation"
        selectedTimezone = "America/Denver"
        appointmentId = "apt_123"
        startTime = "2025-05-31T10:00:00"
        endTime = "2025-05-31T11:00:00"
        status = "booked"
        appointmentStatus = "confirmed"
        address = "123 Main St, Denver, CO 80202"
        notes = "Check kitchen sink leak"
        date_created = "2025-05-30T15:00:00Z"
        created_by = "John Smith"
        created_by_user_id = "user_123"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$BASE_URL/api/webhooks/ghl/unified" -Method POST -Body $appointmentPayload -ContentType "application/json"
Write-Host "✓ Appointment webhook sent" -ForegroundColor Green

# Test 3: Opportunity Created/Changed
Write-Host "`n💼 Test 3: Opportunity webhook" -ForegroundColor Yellow
$opportunityPayload = @{
    contact_id = "ghl_contact_123"
    opportunity_id = "opp_456"
    opportunity_name = "Kitchen Remodel - John Doe"
    status = "open"
    lead_value = 5000
    opportunity_source = "Website"
    pipeline_stage = "Initial Contact"
    pipeline_id = "pipe_789"
    pipeline_name = "Sales Pipeline"
    location = @{
        id = "JMtlZzwrNOUmLpJk2eCE"
        name = "Test Location"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$BASE_URL/api/webhooks/ghl/unified" -Method POST -Body $opportunityPayload -ContentType "application/json"
Write-Host "✓ Opportunity webhook sent" -ForegroundColor Green

# Test 4: Message Received (SMS)
Write-Host "`n💬 Test 4: Inbound SMS webhook" -ForegroundColor Yellow
$messagePayload = @{
    contact_id = "ghl_contact_123"
    first_name = "John"
    last_name = "Doe"
    phone = "+1234567890"
    location = @{
        id = "JMtlZzwrNOUmLpJk2eCE"
    }
    message = @{
        type = "SMS"
        body = "Hi, I need to reschedule my appointment"
        direction = "inbound"
        status = "delivered"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$BASE_URL/api/webhooks/ghl/unified" -Method POST -Body $messagePayload -ContentType "application/json"
Write-Host "✓ Message webhook sent" -ForegroundColor Green

# Test 5: Invoice Changed
Write-Host "`n💰 Test 5: Invoice webhook" -ForegroundColor Yellow
$invoicePayload = @{
    contact_id = "ghl_contact_123"
    location = @{
        id = "JMtlZzwrNOUmLpJk2eCE"
    }
    invoice = @{
        id = "inv_789"
        status = "paid"
        amount = 1500
        invoice_number = "INV-2025-001"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$BASE_URL/api/webhooks/ghl/unified" -Method POST -Body $invoicePayload -ContentType "application/json"
Write-Host "✓ Invoice webhook sent" -ForegroundColor Green

Write-Host "`n✅ All test webhooks sent!" -ForegroundColor Green
Write-Host "Check MongoDB webhook_queue collection to see pending webhooks" -ForegroundColor Cyan

# Test the processor
Write-Host "`n🔄 Testing webhook processor..." -ForegroundColor Yellow
$cronSecret = if ($env:CRON_SECRET) { $env:CRON_SECRET } else { "your-super-secret-cron-key-123456" }
$headers = @{
    "Authorization" = "Bearer $cronSecret"
}

try {
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/cron/process-webhooks" -Method GET -Headers $headers
    Write-Host "Processor result:" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "Error calling processor: $_" -ForegroundColor Red
}

Write-Host "`n✅ Test complete!" -ForegroundColor Green