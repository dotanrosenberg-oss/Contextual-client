# Contextify - WhatsApp Client with AI Copilot

## Overview

Contextify is a WhatsApp client with an AI-powered copilot panel that connects to a dedicated WhatsApp server. The platform provides contextual information including conversation summaries, key topics, action items, and social media integrations. Designed for users with many contacts who need context at a glance without manually catching up on conversations.

Tagline: "Intelligent Unification"

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + Shadcn UI components
- **State Management**: TanStack Query (React Query)
- **AI Integration**: OpenAI API (via Replit AI Integrations)

### Directory Structure
```
├── client/                   # Frontend React application
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── ui/           # Shadcn UI primitives
│   │   │   └── widgets/      # Copilot panel widgets
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and API
│   │   └── pages/            # Page components
├── server/                   # Backend Express application
│   ├── routes.ts             # API routes
│   ├── storage.ts            # Database operations
│   └── db.ts                 # Database connection
└── shared/                   # Shared code
    └── schema.ts             # Database schema and types
```

### Database Schema

1. **settings** - WhatsApp server configuration (URL, API key)
2. **customers** - Contacts/groups from WhatsApp
3. **messages** - Chat message history
4. **contactInsights** - AI-generated insights per customer
5. **socialIntegrations** - Social platform connections (future)
6. **failedParticipants** - Tracks participants that failed to be added to groups (phone number, reason, dismissable)
7. **contacts** - Repository of all WhatsApp users (phone unique, name, profilePicUrl) extracted from group participants and message senders

## Features

### Core Features
- **Tri-pane Layout**: Sidebar (chat list) | Center (messages) | Right (copilot)
- **Real-time Updates**: WebSocket connection for live message updates
- **Dark/Light Mode**: Full theme support with toggle
- **Attachment Support**: Send images, videos, audio files, and documents (up to 16MB)

### Copilot Panel Widgets
- **Conversation Summary**: AI-generated summary of recent messages
- **Contact Insights**: Key topics, action items, relationship strength
- **Social Integrations**: Placeholders for Instagram, Facebook, LinkedIn

### Settings
- Configure WhatsApp server URL and API key
- Test connection before saving
- Welcome screen for first-time setup

## API Endpoints

### Settings
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings

### WhatsApp Proxy (all under /api/wa/)
- `GET /api/wa/status` - Server status
- `GET /api/wa/customers` - List all customers
- `GET /api/wa/customers/:id` - Get customer
- `GET /api/wa/customers/:id/messages` - Get messages (local database)
- `GET /api/wa/customers/:id/participants` - Get group participants (with optional `?includePhotos=true`)
- `POST /api/wa/customers/:id/messages` - Send message (supports text and attachments)
- `POST /api/wa/customers/sync` - Sync customers from WhatsApp
- `GET /api/wa/customers/:id/settings` - Get group permission settings
- `PATCH /api/wa/customers/:id/settings` - Update group permission settings
- `GET /api/wa/whatsapp/messages/:chatId` - Import historical messages from WhatsApp servers

### AI Insights
- `POST /api/insights/generate` - Generate AI insights for a customer
- `GET /api/insights/:customerId` - Get stored insights

### Contacts
- `GET /api/contacts` - List all contacts
- `GET /api/contacts/:phone` - Get contact by phone number

### WebSocket
- `/ws?apiKey=KEY` - Real-time updates (requires authentication)

## Design System

### Colors
- Primary: Purple/Violet (hue ~270) - futuristic, professional
- Accent: Cyan/Teal (hue ~185) - for highlights and secondary actions
- Deep dark purple background for dark mode
- Proper contrast for accessibility
- Full dark mode support (optimized for the brand)

### Components
All components use Shadcn UI primitives with consistent styling:
- Cards, Buttons, Badges with proper hover/active states
- Form inputs with validation
- Toast notifications for feedback

## Recent Changes
- Initial implementation of full WhatsApp client
- AI-powered conversation insights with OpenAI
- Real-time WebSocket updates
- Settings management and onboarding flow
- Rebranded from "Contextful" to "Contextify" with new logo and color scheme
- Added client-side message caching with IndexedDB for persistent state
- Incremental message sync - only fetches new messages since last timestamp
- WebSocket handler caches incoming messages in real-time
- Import history button in chat header to fetch historical messages from WhatsApp
- Show last message preview when message history is not yet available
- Added group participants panel - click member count to view group members with admin badges and search
- Added group creation dialog - create new groups with name, image, and phone numbers from the sidebar
- Failed participants persistence - when group creation has failures, they are saved to the database and displayed in the participant list with strikethrough styling, reason, and ability to dismiss
- Added Contacts page - browse all WhatsApp users extracted from groups and messages with search functionality
- Contacts are automatically extracted from group participants and message senders during WhatsApp sync
- Group permission settings panel - WhatsApp-style toggles for group admin settings with ability to update existing groups
- Added attachment support for sending media messages (images, videos, audio, documents)
- MessageInput component with file picker, preview, and file type validation
- MessageBubble component updated to display incoming media attachments
- Updated attachment sending to use multipart/form-data (matching WhatsApp server API)
- Added Failed Members management feature - "Failed" button with badge in participant list header, dialog to view failed additions with reasons, ability to request join URLs from WhatsApp server, and copy-to-clipboard for sharing invite links
- Group settings now passed to WhatsApp server when creating groups (membersCanEditSettings, membersCanSendMessages, membersCanAddMembers)
- Disabled "Admins approve new members" toggle (not supported by WhatsApp API)
- GroupSettingsPanel now fetches actual settings from WhatsApp server (GET endpoint) with loading states and error handling

## User Preferences
- Professional, clean interface
- Purple/cyan color scheme matching the Contextify brand
- Dark mode enabled by default
