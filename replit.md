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

## Features

### Core Features
- **Tri-pane Layout**: Sidebar (chat list) | Center (messages) | Right (copilot)
- **Real-time Updates**: WebSocket connection for live message updates
- **Dark/Light Mode**: Full theme support with toggle

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
- `POST /api/wa/customers/:id/messages` - Send message
- `POST /api/wa/customers/sync` - Sync customers from WhatsApp
- `GET /api/wa/whatsapp/messages/:chatId` - Import historical messages from WhatsApp servers

### AI Insights
- `POST /api/insights/generate` - Generate AI insights for a customer
- `GET /api/insights/:customerId` - Get stored insights

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

## User Preferences
- Professional, clean interface
- Purple/cyan color scheme matching the Contextify brand
- Dark mode enabled by default
