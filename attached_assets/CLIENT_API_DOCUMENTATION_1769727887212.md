# WhatsApp Server - Client API Documentation

## Version 1.0

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
  "ready": true,
  "phoneNumber": "+1234567890",
  "accountName": "Business Account"
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

### Step 3: Get Messages

```http
GET /api/customers/{customerId}/messages?limit=20
```

### Step 4: Connect WebSocket for Real-Time Updates

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
  "ready": true,
  "phoneNumber": "+1234567890",
  "accountName": "Business Account"
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

Get message history for a customer.

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
    "id": "true_120363123456789@g.us_XYZ789",
    "customerId": "120363123456789@g.us",
    "body": "Hello from the API!",
    "isFromMe": true,
    "timestamp": "2025-01-29T10:35:00Z"
  }
}
```

---

### Groups

#### POST /api/groups/create

Create a new WhatsApp group with participants.

**Request Body:**
```json
{
  "name": "New Project Team",
  "participants": ["+1234567890", "+0987654321"]
}
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
  }
}
```

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
  
  console.log('Connected to:', data.phoneNumber);
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
    
    print(f"Connected to: {data.get('phoneNumber')}")
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

# Get messages
curl "https://YOUR_SERVER_URL/api/customers/120363123456789@g.us/messages?limit=20" \
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
