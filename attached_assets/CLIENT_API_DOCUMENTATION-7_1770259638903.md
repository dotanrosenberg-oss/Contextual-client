# WhatsApp Server - Client API Documentation

## Version 1.6

**Architecture Overview:**
This API provides access to a WhatsApp Server instance. Each server maintains a persistent connection to a single WhatsApp identity (phone number). Clients authenticate with the server using an API key and consume WhatsApp resources through this abstraction layer.

**Key Principles:**
- The server owns and manages the WhatsApp connection
- Clients authenticate with the server, not with WhatsApp
- If the server is not connected to WhatsApp, all data endpoints return a service unavailable error
- Clients receive data and real-time updates without knowledge of WhatsApp internals

---

## Base URL

```
https://YOUR_SERVER_URL
```

---

## Authentication

All API requests require an API key in the `X-API-Key` header:

```
X-API-Key: YOUR_API_KEY
```

### WebSocket Connections

Include the API key as a query parameter:

```
wss://YOUR_SERVER_URL/ws?apiKey=YOUR_API_KEY
```

### Authentication Errors

| Status Code | Error Message |
|-------------|---------------|
| 401 | Missing API key. Include X-API-Key header. |
| 403 | Invalid API key |

---

## Server Availability

### Service Unavailable Error

When the server is not connected to WhatsApp, **all data endpoints** return:

```
HTTP 503 Service Unavailable
```

```json
{
  "error": "SERVICE_UNAVAILABLE",
  "message": "Server is not connected to WhatsApp"
}
```

Clients should handle this gracefully and retry later. The server connection is managed internally - clients do not need to take any action to establish it.

---

## Quick Start

### Step 1: Check Server Status

```http
GET /api/status
```

**Response (Server Ready):**
```json
{
  "ready": true
}
```

**Response (Server Not Ready):**
```json
{
  "ready": false,
  "message": "Server is not connected to WhatsApp"
}
```

### Step 2: Get Customers (Groups)

```http
GET /api/customers
```

### Step 3: Get Messages (Local Database)

```http
GET /api/customers/{customerId}/messages?limit=20
```

### Step 4: Fetch Historical Messages (From WhatsApp)

```http
GET /api/whatsapp/messages/{chatId}?limit=200
```

Use this to build conversation context or sync messages not yet in the local database.

### Step 5: Connect WebSocket for Real-Time Updates

```
wss://YOUR_SERVER_URL/ws?apiKey=YOUR_API_KEY
```

---

## API Endpoints

### Server Status

#### GET /api/status

Check if the server is ready to serve requests.

**Response (Ready):**
```json
{
  "ready": true
}
```

**Response (Not Ready):**
```json
{
  "ready": false,
  "message": "Server is not connected to WhatsApp"
}
```

**Usage:**
- Call this endpoint on client startup to verify the server is available
- If `ready` is `false`, display an appropriate message to users and retry periodically

---

### Customers (Groups)

#### GET /api/customers

Get all customers (synced WhatsApp groups).

**Response:**
```json
[
  {
    "id": "120363123456789@g.us",
    "name": "Sales Team",
    "description": "Group for sales discussions",
    "participantCount": 12,
    "lastMessage": "Meeting at 3pm",
    "lastMessageTime": "2025-01-29T10:30:00Z",
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
  "id": "120363123456789@g.us",
  "name": "Sales Team",
  "description": "Group for sales discussions",
  "participantCount": 12,
  "lastMessage": "Meeting at 3pm",
  "lastMessageTime": "2025-01-29T10:30:00Z",
  "unreadCount": 5,
  "isAdmin": true
}
```

---

#### DELETE /api/customers/:id

Remove a customer from the local database. Does not leave the WhatsApp group.

**Response:**
```json
{
  "success": true
}
```

---

#### POST /api/customers/sync

Sync WhatsApp groups as customers. Imports all groups where the server account is a member.

**Response:**
```json
{
  "success": true,
  "message": "Synced 5 customers from WhatsApp groups",
  "count": 5
}
```

---

### Messages

#### GET /api/customers/:id/messages

Get message history for a customer from local database.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Maximum number of messages to return |

**Response:**
```json
[
  {
    "id": "true_120363123456789@g.us_ABC123",
    "customerId": "120363123456789@g.us",
    "body": "Hello everyone!",
    "fromPhone": "+1234567890",
    "fromName": "John Doe",
    "timestamp": "2025-01-29T10:30:00Z",
    "isFromMe": false,
    "hasMedia": false,
    "messageType": "text"
  }
]
```

---

#### GET /api/whatsapp/messages/:chatId

Fetch historical messages directly from WhatsApp servers. Use this endpoint to build conversation context or sync historical messages that aren't in the local database.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chatId` | string | WhatsApp chat ID (e.g., `120363123456789@g.us` for groups, `1234567890@c.us` for individuals) |

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 100 | 500 | Maximum number of messages to fetch |

**Response:**
```json
{
  "success": true,
  "chatId": "120363123456789@g.us",
  "count": 150,
  "messages": [
    {
      "id": "true_120363123456789@g.us_ABC123",
      "customerId": "120363123456789@g.us",
      "body": "Hello everyone!",
      "fromPhone": "1234567890@c.us",
      "fromName": "John Doe",
      "timestamp": "2025-01-28T10:30:00Z",
      "isFromMe": false,
      "hasMedia": false,
      "messageType": "text"
    },
    {
      "id": "true_120363123456789@g.us_DEF456",
      "customerId": "120363123456789@g.us",
      "body": "Good morning!",
      "fromPhone": "0987654321@c.us",
      "fromName": "Jane Smith",
      "timestamp": "2025-01-28T10:31:00Z",
      "isFromMe": false,
      "hasMedia": false,
      "messageType": "text"
    }
  ]
}
```

**Notes:**
- Messages are sorted oldest-first (ascending by timestamp)
- Fetched messages are also saved to the local database for caching
- This endpoint retrieves messages from WhatsApp servers, not just locally stored ones
- Useful for building AI context or initial sync when connecting to existing groups
- May take longer than the local endpoint due to network requests

**Message Types:**
| Type | Description |
|------|-------------|
| `text` | Plain text message |
| `image` | Image message |
| `video` | Video message |
| `audio` | Audio/voice message |
| `document` | Document/file attachment |
| `sticker` | Sticker message |

---

#### POST /api/customers/:id/messages

Send a message to a customer (WhatsApp group). Supports both text-only messages and messages with file attachments.

**Option 1: Text-Only Message (JSON)**

Send a plain text message using JSON body:

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
    "id": "true_120363123456789@g.us_XYZ789",
    "customerId": "120363123456789@g.us",
    "body": "Hello from the API!",
    "isFromMe": true,
    "hasMedia": false,
    "messageType": "text",
    "timestamp": "2025-01-29T10:35:00Z"
  }
}
```

**Option 2: Message with Attachment (Multipart Form Data)**

Send a message with a file attachment using `multipart/form-data`:

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Any file to attach (images, videos, audio, documents, or any other file type) |
| `caption` | string | No | Optional caption/message text to accompany the attachment |

**File Size Limit:** 100MB maximum for all file types.

**Message Type Detection:**
The API automatically determines the message type based on the file's MIME type:
- `image/*` → `image`
- `video/*` → `video`
- `audio/*` → `audio`
- `image/webp` → `sticker`
- All other types → `document`

**Example Request (using fetch):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('caption', 'Check out this document!');

const response = await fetch('/api/customers/120363123456789@g.us/messages', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key'
  },
  body: formData
});
```

**Example Request (using curl):**
```bash
curl -X POST "http://localhost:5000/api/customers/120363123456789@g.us/messages" \
  -H "X-API-Key: your-api-key" \
  -F "file=@/path/to/image.jpg" \
  -F "caption=Here's the photo you requested"
```

**Response (with attachment):**
```json
{
  "success": true,
  "message": {
    "id": "true_120363123456789@g.us_ABC123",
    "customerId": "120363123456789@g.us",
    "body": "Here's the photo you requested",
    "isFromMe": true,
    "hasMedia": true,
    "messageType": "image",
    "fileName": "image.jpg",
    "mimeType": "image/jpeg",
    "timestamp": "2025-01-29T10:35:00Z"
  }
}
```

**Error Responses:**

File too large:
```json
{
  "error": "File too large"
}
```

No file provided (multipart request without file):
```json
{
  "error": "No file provided. Use JSON body with 'message' field for text-only messages, or include a 'file' field for attachments"
}
```

---

### Groups

#### POST /api/groups/create

Create a new WhatsApp group with participants. Optionally set a group icon/profile picture.

**Option 1: JSON Body (no icon)**

```json
{
  "name": "New Project Team",
  "participants": ["+1234567890", "+0987654321"]
}
```

**Option 2: Multipart Form Data (with optional icon)**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group name |
| `participants` | string | Yes | JSON array of phone numbers (e.g., `["+1234567890", "+0987654321"]`) or comma-separated list |
| `settings` | string | No | JSON object with group settings |
| `icon` | File | No | Image file for group profile picture (must be image/* MIME type, JPEG/PNG recommended) |

**Example Request (with icon using curl):**
```bash
curl -X POST "http://localhost:5000/api/groups/create" \
  -H "X-API-Key: your-api-key" \
  -F "name=New Project Team" \
  -F "participants=[\"+1234567890\", \"+0987654321\"]" \
  -F "icon=@/path/to/group-image.jpg"
```

**Example Request (with icon using fetch):**
```javascript
const formData = new FormData();
formData.append('name', 'New Project Team');
formData.append('participants', JSON.stringify(['+1234567890', '+0987654321']));
formData.append('icon', iconFile); // File object

const response = await fetch('/api/groups/create', {
  method: 'POST',
  headers: { 'X-API-Key': 'your-api-key' },
  body: formData
});
```

**Response (Success):**
```json
{
  "success": true,
  "groupId": "120363123456789@g.us",
  "groupName": "New Project Team",
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
    "name": "New Project Team",
    "participantCount": 3
  },
  "iconSet": true
}
```

**Icon Field Behavior:**
- `iconSet: true` - Icon was successfully set
- `iconSet: false` - No icon was provided, or icon setting failed
- `iconError: "..."` - Present only when icon setting failed, contains the error reason

**Note:** If a non-image file is provided as `icon`, the group is still created successfully but `iconSet` will be `false` and `iconError` will explain why.

**Response (Partial Success):**
```json
{
  "success": true,
  "groupId": "120363123456789@g.us",
  "groupName": "New Project Team",
  "results": {
    "added": [
      { "number": "1234567890", "whatsappId": "1234567890@c.us" }
    ],
    "failed": [
      {
        "number": "0987654321",
        "reason": "The phone number is not registered on WhatsApp",
        "statusCode": 404
      }
    ]
  },
  "summary": {
    "totalRequested": 2,
    "successfullyAdded": 1,
    "failedToAdd": 1
  }
}
```

**Failure Status Codes:**
| Code | Meaning |
|------|---------|
| 403 | Privacy settings prevent adding to groups |
| 404 | Phone number not registered on WhatsApp |
| 408 | Request timed out |
| 409 | Already in group |

---

#### POST /api/diagnostics/check-number

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
  "whatsappId": "1234567890@c.us"
}
```

---

### Group Management

These endpoints allow clients to manage existing WhatsApp groups.

#### PATCH /api/customers/:id/name

Update a group's name.

**Request Body:**
```json
{
  "name": "New Group Name"
}
```

**Example Request:**
```bash
curl -X PATCH "http://localhost:5000/api/customers/120363123456789@g.us/name" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Team Name"}'
```

**Response:**
```json
{
  "success": true,
  "name": "Updated Team Name",
  "customer": {
    "id": "120363123456789@g.us",
    "name": "Updated Team Name",
    "participantCount": 5
  }
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | - | Name is required and must be a non-empty string |
| 403 | FORBIDDEN | Not authorized - admin privileges required |
| 404 | GROUP_NOT_FOUND | Group not found |
| 503 | SERVICE_UNAVAILABLE | Server is not connected to WhatsApp |

---

#### POST /api/customers/:id/participants

Add participants to a group.

**Request Body:**
```json
{
  "participants": ["+1234567890", "+0987654321"]
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/customers/120363123456789@g.us/participants" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"participants": ["+1234567890", "+0987654321"]}'
```

**Response:**
```json
{
  "success": true,
  "added": [
    { "number": "1234567890", "whatsappId": "1234567890@c.us" }
  ],
  "failed": [
    { "number": "0987654321", "whatsappId": "0987654321@c.us", "reason": "Not authorized to add this participant" }
  ],
  "summary": {
    "totalRequested": 2,
    "successfullyAdded": 1,
    "failedToAdd": 1
  },
  "customer": {
    "id": "120363123456789@g.us",
    "name": "Team Name",
    "participantCount": 6
  }
}
```

**Common Failure Reasons:**
| Code | Reason |
|------|--------|
| 403 | Not authorized to add this participant (privacy settings) |
| 409 | Participant already in group |

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | - | participants is required and must be a non-empty array |
| 403 | FORBIDDEN | Not authorized - admin privileges required |
| 404 | GROUP_NOT_FOUND | Group not found |
| 503 | SERVICE_UNAVAILABLE | Server is not connected to WhatsApp |

---

#### DELETE /api/customers/:id/participants

Remove participants from a group.

**Request Body:**
```json
{
  "participants": ["+1234567890", "+0987654321"]
}
```

**Example Request:**
```bash
curl -X DELETE "http://localhost:5000/api/customers/120363123456789@g.us/participants" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"participants": ["+1234567890"]}'
```

**Response:**
```json
{
  "success": true,
  "removed": [
    { "number": "1234567890", "whatsappId": "1234567890@c.us" }
  ],
  "failed": [],
  "summary": {
    "totalRequested": 1,
    "successfullyRemoved": 1,
    "failedToRemove": 0
  },
  "customer": {
    "id": "120363123456789@g.us",
    "name": "Team Name",
    "participantCount": 4
  }
}
```

**Common Failure Reasons:**
| Code | Reason |
|------|--------|
| 403 | Not authorized to remove this participant |
| 404 | Participant not in group |

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | - | participants is required and must be a non-empty array |
| 403 | FORBIDDEN | Not authorized - admin privileges required |
| 404 | GROUP_NOT_FOUND | Group not found |
| 503 | SERVICE_UNAVAILABLE | Server is not connected to WhatsApp |

---

#### GET /api/customers/:id/settings

Get group privacy/permission settings. Settings are cached in the database and automatically updated when changes are detected.

**Example Request:**
```bash
curl "http://localhost:5000/api/customers/120363123456789@g.us/settings" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**
```json
{
  "membersCanEditSettings": true,
  "membersCanSendMessages": true,
  "membersCanAddMembers": true,
  "lastUpdated": "2026-02-05T02:30:00.000Z",
  "source": "api"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `membersCanEditSettings` | boolean | Whether non-admin members can edit group info |
| `membersCanSendMessages` | boolean | Whether non-admin members can send messages |
| `membersCanAddMembers` | boolean | Whether non-admin members can add new participants |
| `lastUpdated` | string | ISO timestamp of when the settings were last updated/cached |
| `source` | string | How settings were obtained: `"api"` (via API) or `"event"` (via WhatsApp event) |

**Note:** Settings are automatically cached when groups are created, updated via the API, or when external changes are detected via WhatsApp events.

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | NOT_A_GROUP | The specified chat is not a group |
| 404 | GROUP_NOT_FOUND | Group not found |
| 503 | SERVICE_UNAVAILABLE | Server is not connected to WhatsApp and no cached settings exist |

---

#### PATCH /api/customers/:id/settings

Update group privacy/permission settings. You must be a group admin.

**Request Body:**
```json
{
  "membersCanEditSettings": false,
  "membersCanSendMessages": true,
  "membersCanAddMembers": false
}
```

All fields are optional. Only include the settings you want to change.

| Setting | Description |
|---------|-------------|
| `membersCanEditSettings` | Whether non-admin members can edit group info |
| `membersCanSendMessages` | Whether non-admin members can send messages |
| `membersCanAddMembers` | Whether non-admin members can add new participants |

**Example Request:**
```bash
curl -X PATCH "http://localhost:5000/api/customers/120363123456789@g.us/settings" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"membersCanSendMessages": false}'
```

**Response:**
The response returns the current group settings after the update, fetched directly from WhatsApp for accuracy.
```json
{
  "membersCanEditSettings": false,
  "membersCanSendMessages": false,
  "membersCanAddMembers": true,
  "lastUpdated": "2026-02-05T02:35:00.000Z",
  "source": "api"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `membersCanEditSettings` | boolean | Current state of edit settings permission |
| `membersCanSendMessages` | boolean | Current state of send messages permission |
| `membersCanAddMembers` | boolean | Current state of add members permission |
| `lastUpdated` | string | ISO timestamp of when the settings were updated |
| `source` | string | Always `"api"` for updates made via this endpoint |

**Note:** The response reflects the final state of all settings (not just the ones you changed), fetched from WhatsApp after applying your changes.

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | NOT_A_GROUP | The specified chat is not a group |
| 403 | FORBIDDEN | Not authorized - admin privileges required |
| 404 | GROUP_NOT_FOUND | Group not found |
| 503 | SERVICE_UNAVAILABLE | Server is not connected to WhatsApp |

---

### Health Check

#### GET /api/health

Basic server health check. **Does not require authentication.**

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
wss://YOUR_SERVER_URL/ws?apiKey=YOUR_API_KEY
```

### Message Types

#### connected

Sent immediately upon successful connection.

```json
{
  "type": "connected",
  "data": {
    "message": "Connected to WhatsApp server"
  }
}
```

---

#### message

Received when a new message arrives.

```json
{
  "type": "message",
  "data": {
    "id": "true_120363123456789@g.us_ABC123",
    "customerId": "120363123456789@g.us",
    "body": "Hello!",
    "fromPhone": "+1234567890",
    "fromName": "John Doe",
    "timestamp": "2025-01-29T10:30:00Z",
    "isFromMe": false,
    "hasMedia": false,
    "messageType": "text"
  },
  "customer": {
    "id": "120363123456789@g.us",
    "name": "Sales Team"
  }
}
```

---

#### customer_update

Received when a customer's data changes.

```json
{
  "type": "customer_update",
  "data": {
    "id": "120363123456789@g.us",
    "name": "Sales Team",
    "lastMessage": "New message",
    "lastMessageTime": "2025-01-29T10:30:00Z"
  }
}
```

---

#### customers_synced

Received after sync completes.

```json
{
  "type": "customers_synced",
  "data": [
    {
      "id": "120363123456789@g.us",
      "name": "Sales Team"
    }
  ]
}
```

---

#### service_unavailable

Received if the server loses connection to WhatsApp.

```json
{
  "type": "service_unavailable",
  "data": {
    "message": "Server disconnected from WhatsApp"
  }
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (invalid input) |
| 401 | Unauthorized (missing API key) |
| 403 | Forbidden (invalid API key) |
| 404 | Resource not found |
| 503 | Service unavailable (server not connected to WhatsApp) |
| 500 | Server error |

---

## Code Examples

### JavaScript/Node.js

```javascript
const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'https://YOUR_SERVER_URL';

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json'
};

async function checkServerStatus() {
  const response = await fetch(`${BASE_URL}/api/status`, { headers });
  const data = await response.json();
  
  if (!data.ready) {
    console.log('Server not ready:', data.message);
    return false;
  }
  
  console.log('Server is ready');
  return true;
}

async function getCustomers() {
  const response = await fetch(`${BASE_URL}/api/customers`, { headers });
  
  if (response.status === 503) {
    throw new Error('Server not connected to WhatsApp');
  }
  
  return response.json();
}

async function getMessages(customerId, limit = 20) {
  const response = await fetch(
    `${BASE_URL}/api/customers/${customerId}/messages?limit=${limit}`,
    { headers }
  );
  return response.json();
}

async function fetchHistoricalMessages(chatId, limit = 200) {
  const response = await fetch(
    `${BASE_URL}/api/whatsapp/messages/${chatId}?limit=${limit}`,
    { headers }
  );
  return response.json();
}

async function sendMessage(customerId, message) {
  const response = await fetch(
    `${BASE_URL}/api/customers/${customerId}/messages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ message })
    }
  );
  return response.json();
}

// WebSocket connection
const ws = new WebSocket(`wss://YOUR_SERVER_URL/ws?apiKey=${API_KEY}`);

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  switch (type) {
    case 'connected':
      console.log('WebSocket connected');
      break;
    case 'message':
      console.log('New message:', data.body);
      break;
    case 'service_unavailable':
      console.log('Server disconnected from WhatsApp');
      break;
  }
};
```

### Python

```python
import requests
import websocket
import json

API_KEY = 'YOUR_API_KEY'
BASE_URL = 'https://YOUR_SERVER_URL'
HEADERS = {'X-API-Key': API_KEY}

def check_server_status():
    response = requests.get(f'{BASE_URL}/api/status', headers=HEADERS)
    data = response.json()
    
    if not data.get('ready'):
        print(f"Server not ready: {data.get('message')}")
        return False
    
    print("Server is ready")
    return True

def get_customers():
    response = requests.get(f'{BASE_URL}/api/customers', headers=HEADERS)
    
    if response.status_code == 503:
        raise Exception('Server not connected to WhatsApp')
    
    return response.json()

def get_messages(customer_id, limit=20):
    response = requests.get(
        f'{BASE_URL}/api/customers/{customer_id}/messages',
        headers=HEADERS,
        params={'limit': limit}
    )
    return response.json()

def fetch_historical_messages(chat_id, limit=200):
    response = requests.get(
        f'{BASE_URL}/api/whatsapp/messages/{chat_id}',
        headers=HEADERS,
        params={'limit': limit}
    )
    return response.json()

def send_message(customer_id, message):
    response = requests.post(
        f'{BASE_URL}/api/customers/{customer_id}/messages',
        headers={**HEADERS, 'Content-Type': 'application/json'},
        json={'message': message}
    )
    return response.json()

# WebSocket
def on_message(ws, message):
    data = json.loads(message)
    msg_type = data.get('type')
    
    if msg_type == 'connected':
        print('WebSocket connected')
    elif msg_type == 'message':
        print(f"New message: {data['data']['body']}")
    elif msg_type == 'service_unavailable':
        print('Server disconnected from WhatsApp')

ws = websocket.WebSocketApp(
    f"wss://YOUR_SERVER_URL/ws?apiKey={API_KEY}",
    on_message=on_message
)
ws.run_forever()
```

### cURL

```bash
# Check server status
curl https://YOUR_SERVER_URL/api/status \
  -H "X-API-Key: YOUR_API_KEY"

# Get all customers
curl https://YOUR_SERVER_URL/api/customers \
  -H "X-API-Key: YOUR_API_KEY"

# Get messages (from local database)
curl "https://YOUR_SERVER_URL/api/customers/120363123456789@g.us/messages?limit=20" \
  -H "X-API-Key: YOUR_API_KEY"

# Fetch historical messages (from WhatsApp servers)
curl "https://YOUR_SERVER_URL/api/whatsapp/messages/120363123456789@g.us?limit=200" \
  -H "X-API-Key: YOUR_API_KEY"

# Send a message
curl -X POST https://YOUR_SERVER_URL/api/customers/120363123456789@g.us/messages \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from the API!"}'

# Sync customers
curl -X POST https://YOUR_SERVER_URL/api/customers/sync \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## Rate Limits

Recommended limits to avoid WhatsApp restrictions:

- Messages: Max 1 message per second per group
- Group creation: Max 1 group per minute
- API calls: No server-side limits, but use reasonably

---

## Phone Number Format

**Input:** Phone numbers can include or omit the "+" prefix
- `+1234567890` or `1234567890` - both accepted

**Output:** Phone numbers in responses are digits only (no "+")
- `1234567890`

**WhatsApp IDs:** Full format with suffix
- Individual: `1234567890@c.us`
- Group: `120363123456789@g.us`
