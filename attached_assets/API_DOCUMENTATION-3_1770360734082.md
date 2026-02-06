# WhatsApp Web Customer Manager - API Documentation

## Version 0.3 (Stable)

**Release Label:** Group Participants Endpoint

**What's Included:**
- WhatsApp Web connectivity (QR code authentication, session persistence)
- Group synchronization (sync WhatsApp groups as customers)
- Group creation with participant management
- Automatic promotion of added participants to admin
- Comprehensive error handling for failed member additions (with specific reasons and status codes per phone number)
- Detailed response structure including: groupId, requestedParticipants, results (added/failed), and summary counts
- **NEW:** Group participants endpoint - retrieve list of participants with names, phone numbers, admin status, and optional profile pictures

**Known Limitations:**
- External WhatsApp API may return incomplete participant data (handled by calculating counts locally)
- Promotion to admin may fail for participants with certain privacy settings
- Profile pictures may not be available for all participants due to privacy settings

**Phone Number Format:**
- Input: Phone numbers can be provided with or without "+" prefix (e.g., "+1234567890" or "1234567890")
- Output: Phone numbers in response are returned as digits only (no "+" prefix), e.g., "1234567890"
- WhatsApp IDs are returned in full format (e.g., "1234567890@c.us")

---

## Overview

This API provides programmatic access to WhatsApp Web functionality, allowing you to manage group-based customer conversations, send messages, and receive real-time updates.

---

## Quick Start: Connect & Retrieve Messages

Follow this step-by-step flow to connect your WhatsApp account and retrieve the 20 most recent messages from a group.

### Step 1: Check Current Connection Status

```http
GET /api/whatsapp/status
```

**Possible responses:**
| Status | Meaning | Next Step |
|--------|---------|-----------|
| `disconnected` | Not connected | Go to Step 2 |
| `connecting` | Connection in progress | Wait and poll again |
| `qr_ready` | QR code available | Go to Step 3 |
| `authenticated` | QR scanned, completing handshake | Wait 10-30 seconds, poll again |
| `ready` | Fully connected | Skip to Step 4 |

---

### Step 2: Initialize Connection

```http
POST /api/whatsapp/connect
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp connection initiated"
}
```

---

### Step 3: Scan QR Code

Poll the status endpoint every 3 seconds until you receive `qr_ready`:

```http
GET /api/whatsapp/status
```

**Response with QR code:**
```json
{
  "status": "qr_ready",
  "qrCode": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Instructions:**
1. Display the base64 `qrCode` as an image to the user
2. User opens WhatsApp on their phone → Settings → Linked Devices → Link a Device
3. User scans the QR code
4. Continue polling status every 3 seconds

**Status progression after scanning:**
- `authenticated` → Handshake in progress (wait 10-30 seconds)
- `ready` → Connection complete, proceed to Step 4

**Troubleshooting "authenticated" stuck:**
If status remains `authenticated` for more than 60 seconds:
- Ensure phone has stable internet connection
- Keep WhatsApp open on phone during handshake
- If still stuck, call `POST /api/whatsapp/disconnect` then restart from Step 2

---

### Step 4: Sync WhatsApp Groups

Import your WhatsApp groups as customers:

```http
POST /api/customers/sync
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 5 customers from WhatsApp groups",
  "count": 5
}
```

---

### Step 5: Get Customer List

Retrieve all synced customers (groups):

```http
GET /api/customers
```

**Response:**
```json
[
  {
    "id": "120363123456789@g.us",
    "name": "Sales Team",
    "participantCount": 12
  },
  {
    "id": "120363987654321@g.us", 
    "name": "Support Group",
    "participantCount": 8
  }
]
```

---

### Step 6: Get Recent 20 Messages

Retrieve the most recent messages from a specific group:

```http
GET /api/customers/{customerId}/messages?limit=20
```

Replace `{customerId}` with the group ID from Step 5.

**Example:**
```http
GET /api/customers/120363123456789@g.us/messages?limit=20
```

**Response:**
```json
{
  "messages": [
    {
      "id": "true_120363123456789@g.us_ABC123",
      "body": "Hello everyone!",
      "from": "1234567890@c.us",
      "fromName": "John Doe",
      "timestamp": 1706500000,
      "type": "chat"
    },
    ...
  ],
  "count": 20
}
```

---

### Complete Flow Summary

```
1. GET  /api/whatsapp/status          → Check if connected
2. POST /api/whatsapp/connect         → Start connection (if disconnected)
3. GET  /api/whatsapp/status          → Poll for QR code, scan with phone
4. POST /api/customers/sync           → Import WhatsApp groups
5. GET  /api/customers                → List all groups
6. GET  /api/customers/{id}/messages  → Retrieve messages
```

---

## Base URL

```
https://YOUR_REPLIT_APP_URL
```

Replace `YOUR_REPLIT_APP_URL` with your actual Replit app domain (e.g., `your-app-name.your-username.replit.app`).

---

## Authentication

All API requests require authentication using an API key.

### HTTP Requests

Include the API key in the `X-API-Key` header:

```
X-API-Key: YOUR_API_KEY
```

### WebSocket Connections

Include the API key as a query parameter:

```
wss://YOUR_REPLIT_APP_URL/ws?apiKey=YOUR_API_KEY
```

### Error Responses

| Status Code | Error Message |
|-------------|---------------|
| 401 | Missing API key. Include X-API-Key header. |
| 403 | Invalid API key |
| 500 | Server misconfigured - API key not set |

---

## Quick Start Guide

### Step 1: Initialize WhatsApp Client

```bash
curl -X POST https://YOUR_APP_URL/api/whatsapp/init \
  -H "X-API-Key: YOUR_API_KEY"
```

### Step 2: Get QR Code

```bash
curl https://YOUR_APP_URL/api/whatsapp/status \
  -H "X-API-Key: YOUR_API_KEY"
```

The response includes a `qrCode` field with a base64-encoded PNG image. Display this image and scan it with WhatsApp on your phone (Settings > Linked Devices > Link a Device).

### Step 3: Wait for Ready Status

Poll the status endpoint until `status` becomes `"ready"`.

### Step 4: Sync Groups

```bash
curl -X POST https://YOUR_APP_URL/api/whatsapp/sync-groups \
  -H "X-API-Key: YOUR_API_KEY"
```

This imports all your WhatsApp groups as customers.

### Step 5: Start Using the API

You can now list customers, send messages, and receive real-time updates via WebSocket.

---

## API Endpoints

### WhatsApp Management

#### GET /api/whatsapp/status

Get the current WhatsApp connection status and QR code (if available).

**Response:**
```json
{
  "status": "ready",
  "phoneNumber": "+1234567890",
  "accountName": "My WhatsApp"
}
```

**Status Values:**
- `disconnected` - Client not initialized
- `connecting` - Client is starting up
- `qr_ready` - QR code available for scanning
- `authenticated` - QR scanned, loading data
- `ready` - Fully connected and operational
- `failed` - Error occurred (check `error` field)

When `status` is `qr_ready`, the response includes:
```json
{
  "status": "qr_ready",
  "qrCode": "data:image/png;base64,..."
}
```

---

#### POST /api/whatsapp/init

Initialize the WhatsApp client and start the connection process.

**Response:**
```json
{
  "success": true,
  "status": {
    "status": "qr_ready",
    "qrCode": "data:image/png;base64,..."
  }
}
```

---

#### POST /api/whatsapp/disconnect

Disconnect the WhatsApp client.

**Response:**
```json
{
  "success": true,
  "message": "Disconnected"
}
```

---

#### POST /api/whatsapp/sync-groups

Sync all WhatsApp groups as customers in the database.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "customers": [
    {
      "id": "1234567890@g.us",
      "name": "Team Chat",
      "participantCount": 10,
      "isAdmin": true
    }
  ]
}
```

---

#### POST /api/whatsapp/diagnostics

Check if a phone number is registered on WhatsApp.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "isRegistered": true,
  "number": "1234567890@c.us"
}
```

---

#### POST /api/whatsapp/create-group

Create a new WhatsApp group with participants. Optionally configure group settings on creation.

**Request Body:**
```json
{
  "name": "New Group Name",
  "participants": ["+1234567890", "+0987654321"],
  "settings": {
    "membersCanEditSettings": false,
    "membersCanSendMessages": true,
    "membersCanAddMembers": false
  }
}
```

**Settings Fields (all optional):**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `membersCanEditSettings` | boolean | true | Whether non-admin members can edit group info (name, description, photo) |
| `membersCanSendMessages` | boolean | true | Whether non-admin members can send messages (false = admins only) |
| `membersCanAddMembers` | boolean | true | Whether non-admin members can add other members |

**Minimal Request (no settings):**
```json
{
  "name": "New Group Name",
  "participants": ["+1234567890", "+0987654321"]
}
```

**Response (Success - all participants added with settings):**
```json
{
  "success": true,
  "groupId": "120363123456789@g.us",
  "groupName": "New Group Name",
  "results": {
    "added": [
      { "number": "1234567890", "whatsappId": "1234567890@c.us" },
      { "number": "0987654321", "whatsappId": "0987654321@c.us" }
    ],
    "failed": []
  },
  "summary": {
    "totalRequested": 2,
    "successfullyAdded": 2,
    "failedToAdd": 0
  },
  "customer": {
    "id": "120363123456789@g.us",
    "name": "New Group Name",
    "participantCount": 3
  },
  "appliedSettings": {
    "membersCanEditSettings": false,
    "membersCanSendMessages": true,
    "membersCanAddMembers": false
  }
}
```

**Response (Partial success - some participants failed):**
```json
{
  "success": true,
  "groupId": "120363123456789@g.us",
  "groupName": "New Group Name",
  "results": {
    "added": [
      { "number": "1234567890", "whatsappId": "1234567890@c.us" }
    ],
    "failed": [
      { 
        "number": "0987654321", 
        "whatsappId": "0987654321@c.us",
        "reason": "Privacy settings prevent adding to groups",
        "statusCode": 403
      },
      { 
        "number": "13612615421", 
        "whatsappId": "13612615421@c.us",
        "reason": "The phone number is not registered on WhatsApp",
        "statusCode": 404
      }
    ]
  },
  "summary": {
    "totalRequested": 3,
    "successfullyAdded": 1,
    "failedToAdd": 2
  },
  "customer": {
    "id": "120363123456789@g.us",
    "name": "New Group Name",
    "participantCount": 2
  },
  "appliedSettings": {
    "membersCanEditSettings": false,
    "membersCanSendMessages": true,
    "membersCanAddMembers": false
  }
}
```

**Response (Complete failure - all participants failed):**
```json
{
  "success": false,
  "error": "ALL_PARTICIPANTS_FAILED",
  "message": "None of the requested participants could be added to the group. The group was created but contains only the bot.",
  "groupId": "120363123456789@g.us",
  "groupName": "New Group Name",
  "results": {
    "added": [],
    "failed": [
      { 
        "number": "0987654321", 
        "whatsappId": "0987654321@c.us",
        "reason": "Privacy settings prevent adding to groups",
        "statusCode": 403
      },
      { 
        "number": "13612615421", 
        "whatsappId": "13612615421@c.us",
        "reason": "The phone number is not registered on WhatsApp",
        "statusCode": 404
      }
    ]
  },
  "summary": {
    "totalRequested": 2,
    "successfullyAdded": 0,
    "failedToAdd": 2
  },
  "suggestion": "Verify that all phone numbers are registered on WhatsApp and have privacy settings that allow being added to groups."
}
```
HTTP Status: 422 Unprocessable Entity

**Response Fields:**
- `groupId` - The unique identifier of the created WhatsApp group
- `groupName` - The name of the created group
- `results.added` - Array of successfully added participants with their phone number and WhatsApp ID
- `results.failed` - Array of failed participants with:
  - `number` - The phone number
  - `whatsappId` - The formatted WhatsApp ID
  - `reason` - Human-readable failure reason
  - `statusCode` - Machine-readable status code (404 = not registered, 403 = privacy, etc.)
- `summary` - Quick counts for easier processing:
  - `totalRequested` - Number of participants requested
  - `successfullyAdded` - Number successfully added to group
  - `failedToAdd` - Number that failed to be added
- `customer` - The customer record stored in the database
- `appliedSettings` - The group settings that were applied after creation (only present if settings were requested):
  - `membersCanEditSettings` - Whether members can edit group info
  - `membersCanSendMessages` - Whether members can send messages
  - `membersCanAddMembers` - Whether members can add other members

**Status Codes in `results.failed`:**
| Code | Meaning |
|------|---------|
| 403 | Privacy settings prevent adding to groups |
| 404 | The phone number is not registered on WhatsApp |
| 408 | Request timed out |
| 409 | Already in group |
| 500 | Server error or participant not found after creation |

**Client Error Handling Guide:**
1. **Check `success` field first**: If `false`, the operation failed completely.
2. **Use `summary` for quick counts**: Get an overview of what succeeded/failed.
3. **Iterate `results.failed`**: Each entry has the phone number, reason, and statusCode.
4. **Use `statusCode` for programmatic handling**: e.g., prompt user to verify unregistered numbers (404).
5. **Display `reason` to users**: Human-readable explanation of why each number failed.

---

### Customers

#### GET /api/customers

Get all customers (synced WhatsApp groups).

**Response:**
```json
[
  {
    "id": "1234567890@g.us",
    "name": "Team Chat",
    "description": "Group description",
    "participantCount": 10,
    "lastMessage": "Hello everyone!",
    "lastMessageTime": "2025-01-27T10:30:00Z",
    "unreadCount": 5,
    "isAdmin": true
  }
]
```

---

#### GET /api/customers/:id

Get a single customer by ID.

**Response:**
```json
{
  "id": "1234567890@g.us",
  "name": "Team Chat",
  "description": "Group description",
  "participantCount": 10,
  "lastMessage": "Hello everyone!",
  "lastMessageTime": "2025-01-27T10:30:00Z",
  "unreadCount": 5,
  "isAdmin": true
}
```

---

#### GET /api/customers/:id/participants

Get the list of participants for a specific WhatsApp group, including their names, phone numbers, admin status, and optionally profile pictures.

**Query Parameters:**
- `includePhotos` (optional): Set to `true` to include profile picture URLs. Default is `false`. Note: Including photos will make the request slower as it fetches each participant's profile picture.

**Example Request (without photos - fast):**
```http
GET /api/customers/120363123456789@g.us/participants
```

**Example Request (with photos - slower):**
```http
GET /api/customers/120363123456789@g.us/participants?includePhotos=true
```

**Response (without photos):**
```json
{
  "participants": [
    {
      "id": "1234567890@c.us",
      "name": "John Doe",
      "phone": "1234567890",
      "isAdmin": true,
      "isSuperAdmin": false
    },
    {
      "id": "0987654321@c.us",
      "name": "Jane Smith",
      "phone": "0987654321",
      "isAdmin": false,
      "isSuperAdmin": false
    }
  ]
}
```

**Response (with photos):**
```json
{
  "participants": [
    {
      "id": "1234567890@c.us",
      "name": "John Doe",
      "phone": "1234567890",
      "isAdmin": true,
      "isSuperAdmin": false,
      "profilePicUrl": "https://pps.whatsapp.net/v/..."
    },
    {
      "id": "0987654321@c.us",
      "name": "Jane Smith",
      "phone": "0987654321",
      "isAdmin": false,
      "isSuperAdmin": false,
      "profilePicUrl": null
    }
  ]
}
```

**Response Fields:**
- `id` - The participant's WhatsApp ID (phone@c.us format)
- `name` - The participant's display name (prefers WhatsApp pushname, then saved contact name, then phone number)
- `phone` - The participant's phone number (digits only)
- `isAdmin` - Whether the participant is a group admin
- `isSuperAdmin` - Whether the participant is the group creator/super admin
- `profilePicUrl` - Profile picture URL (only included when `includePhotos=true`, may be `null` if unavailable)

**Error Responses:**

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 503 | SERVICE_UNAVAILABLE | WhatsApp client not connected |
| 404 | GROUP_NOT_FOUND | The specified group ID does not exist |
| 400 | NOT_A_GROUP | The specified ID is an individual chat, not a group |
| 500 | (varies) | Other server errors |

**Example Error Response (Group Not Found):**
```json
{
  "error": "GROUP_NOT_FOUND",
  "message": "Group not found"
}
```

**Example Error Response (Not A Group):**
```json
{
  "error": "NOT_A_GROUP",
  "message": "The specified chat is not a group"
}
```

**Notes:**
- Profile pictures may not be available for all participants due to privacy settings
- The `name` field gracefully falls back to phone number if contact information is unavailable
- Failed participant lookups are handled gracefully (participant is skipped, others still returned)

---

#### DELETE /api/customers/:id

Delete a customer from the database (does not leave the WhatsApp group).

**Response:**
```json
{
  "success": true
}
```

---

### Messages

#### GET /api/customers/:id/messages

Get message history for a customer.

**Query Parameters:**
- `limit` (optional): Maximum number of messages to return (default: 100)

**Response:**
```json
[
  {
    "id": "true_1234567890@g.us_ABC123",
    "customerId": "1234567890@g.us",
    "body": "Hello everyone!",
    "fromPhone": "+1234567890",
    "fromName": "John Doe",
    "timestamp": "2025-01-27T10:30:00Z",
    "isFromMe": false,
    "hasMedia": false,
    "messageType": "text"
  }
]
```

---

#### POST /api/customers/:id/messages

Send a message to a customer (WhatsApp group).

**Request Body:**
```json
{
  "message": "Hello from the API!"
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "true_1234567890@g.us_XYZ789",
    "customerId": "1234567890@g.us",
    "body": "Hello from the API!",
    "isFromMe": true,
    "timestamp": "2025-01-27T10:35:00Z"
  }
}
```

---

### Polls

#### POST /api/customers/:id/poll

Send a poll to a customer (WhatsApp group). Polls allow group members to vote on options.

**Request Body:**
```json
{
  "question": "What time works best for our meeting?",
  "options": ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"],
  "allowMultipleAnswers": false
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The poll question (max 255 characters) |
| `options` | string[] | Yes | Array of poll options (2-12 options, each max 100 characters) |
| `allowMultipleAnswers` | boolean | No | Whether voters can select multiple options (default: `false`) |

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "true_120363123456789@g.us_POLL123",
    "customerId": "120363123456789@g.us",
    "body": "[Poll] What time works best for our meeting?",
    "isFromMe": true,
    "hasMedia": false,
    "messageType": "poll",
    "pollQuestion": "What time works best for our meeting?",
    "pollOptions": ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"],
    "allowMultipleAnswers": false,
    "timestamp": "2026-02-05T10:35:00Z"
  }
}
```

**Error Responses:**

Invalid options count (HTTP 400):
```json
{
  "error": "Polls must have between 2 and 12 options"
}
```

Missing question (HTTP 400):
```json
{
  "error": "Poll question is required"
}
```

Option too long (HTTP 400):
```json
{
  "error": "Poll options must be 100 characters or less"
}
```

---

### Health Check

#### GET /api/health

Check server health status. **Does not require authentication.**

**Response:**
```json
{
  "status": "ok",
  "whatsapp": "ready",
  "websocket": {
    "clients": 2
  }
}
```

---

## WebSocket API

### Connection

Connect to receive real-time updates:

```
wss://YOUR_APP_URL/ws?apiKey=YOUR_API_KEY
```

### Message Types

#### Connected

Sent immediately upon successful connection.

```json
{
  "type": "connected",
  "data": {
    "message": "Connected to WhatsApp manager"
  }
}
```

#### New Message

Received when a new message is sent or received.

```json
{
  "type": "message",
  "data": {
    "id": "true_1234567890@g.us_ABC123",
    "customerId": "1234567890@g.us",
    "body": "Hello!",
    "fromPhone": "+1234567890",
    "fromName": "John Doe",
    "timestamp": "2025-01-27T10:30:00Z",
    "isFromMe": false,
    "hasMedia": false,
    "messageType": "text"
  },
  "customer": {
    "id": "1234567890@g.us",
    "name": "Team Chat"
  }
}
```

#### Status Change

Received when the WhatsApp connection status changes.

```json
{
  "type": "status",
  "data": {
    "status": "ready",
    "qrCode": null,
    "error": null
  }
}
```

#### Customer Update

Received when a customer's data is updated.

```json
{
  "type": "customer_update",
  "data": {
    "id": "1234567890@g.us",
    "name": "Team Chat",
    "lastMessage": "New message",
    "lastMessageTime": "2025-01-27T10:30:00Z"
  }
}
```

#### Customers Synced

Received after calling sync-groups endpoint.

```json
{
  "type": "customers_synced",
  "data": [
    {
      "id": "1234567890@g.us",
      "name": "Team Chat"
    }
  ]
}
```

#### Poll Vote

Received when a group member votes on a poll.

```json
{
  "type": "poll_vote",
  "data": {
    "pollMessageId": "true_120363123456789@g.us_POLL123",
    "customerId": "120363123456789@g.us",
    "voter": "+1234567890",
    "voterName": "John Doe",
    "selectedOptions": ["11:00 AM"],
    "timestamp": "2026-02-05T10:40:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `pollMessageId` | string | ID of the original poll message |
| `customerId` | string | Group ID where the poll was sent |
| `voter` | string | Phone number of the voter |
| `voterName` | string | Display name of the voter |
| `selectedOptions` | string[] | Array of options the voter selected |
| `timestamp` | string | ISO timestamp of when the vote was cast |

---

## Code Examples

### JavaScript/Node.js

```javascript
const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'https://YOUR_APP_URL';

// Initialize WhatsApp
async function initWhatsApp() {
  const response = await fetch(`${BASE_URL}/api/whatsapp/init`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY }
  });
  return response.json();
}

// Get status
async function getStatus() {
  const response = await fetch(`${BASE_URL}/api/whatsapp/status`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return response.json();
}

// Send message
async function sendMessage(customerId, message) {
  const response = await fetch(`${BASE_URL}/api/customers/${customerId}/messages`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  });
  return response.json();
}

// WebSocket connection
const ws = new WebSocket(`wss://YOUR_APP_URL/ws?apiKey=${API_KEY}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data.type, data.data);
};
```

### Python

```python
import requests
import websocket
import json

API_KEY = 'YOUR_API_KEY'
BASE_URL = 'https://YOUR_APP_URL'
HEADERS = {'X-API-Key': API_KEY}

# Initialize WhatsApp
def init_whatsapp():
    response = requests.post(f'{BASE_URL}/api/whatsapp/init', headers=HEADERS)
    return response.json()

# Get status
def get_status():
    response = requests.get(f'{BASE_URL}/api/whatsapp/status', headers=HEADERS)
    return response.json()

# Send message
def send_message(customer_id, message):
    response = requests.post(
        f'{BASE_URL}/api/customers/{customer_id}/messages',
        headers={**HEADERS, 'Content-Type': 'application/json'},
        json={'message': message}
    )
    return response.json()

# WebSocket connection
def on_message(ws, message):
    data = json.loads(message)
    print(f"Received: {data['type']}", data.get('data'))

ws = websocket.WebSocketApp(
    f"wss://YOUR_APP_URL/ws?apiKey={API_KEY}",
    on_message=on_message
)
ws.run_forever()
```

### cURL

```bash
# Initialize WhatsApp
curl -X POST https://YOUR_APP_URL/api/whatsapp/init \
  -H "X-API-Key: YOUR_API_KEY"

# Get status
curl https://YOUR_APP_URL/api/whatsapp/status \
  -H "X-API-Key: YOUR_API_KEY"

# Get all customers
curl https://YOUR_APP_URL/api/customers \
  -H "X-API-Key: YOUR_API_KEY"

# Send a message
curl -X POST https://YOUR_APP_URL/api/customers/1234567890@g.us/messages \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from the API!"}'

# Get group participants (without photos)
curl https://YOUR_APP_URL/api/customers/1234567890@g.us/participants \
  -H "X-API-Key: YOUR_API_KEY"

# Get group participants (with photos - slower)
curl https://YOUR_APP_URL/api/customers/1234567890@g.us/participants?includePhotos=true \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message here"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (invalid input) |
| 401 | Unauthorized (missing API key) |
| 403 | Forbidden (invalid API key) |
| 404 | Resource not found |
| 500 | Server error |

### WhatsApp-Specific Errors

| Error | Description |
|-------|-------------|
| WhatsApp client not ready | Client hasn't been initialized or QR hasn't been scanned |
| WhatsApp client not authenticated | QR code needs to be scanned |
| Failed to send message | Message couldn't be delivered |

---

## Rate Limits

There are no explicit rate limits, but WhatsApp may temporarily block accounts that send too many messages too quickly. Recommended limits:

- Messages: Max 1 message per second per group
- Group creation: Max 1 group per minute
- Sync operations: Max 1 sync per 5 minutes

---

## Support

For issues with this API, please contact the system administrator.
