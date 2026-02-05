# Failed Members Feature - Overview

## Purpose
Handle cases where members cannot be added to WhatsApp groups due to privacy settings, non-WhatsApp registration, or other constraints. Provides a way to request invite URLs from the server and store them for sharing with failed members.

## User Flow

1. **Group Creation** - When creating a group, if some members fail to be added (server returns failures), the system automatically stores these failed members in the `failed_participants` database table.

2. **Failed Button with Badge** - A "Failed" button with a badge appears in the group/participant UI showing the count of failed member additions for that group.

3. **Failed Members Dialog** - Clicking the "Failed" button opens a dialog showing:
   - List of phone numbers that couldn't be added
   - Reason for each failure
   - Button to request a join URL from the server for each failed member
   - The generated join URL (once retrieved) with copy-to-clipboard functionality
   - Option to remove/dismiss entries

4. **Request Join URL** - For each failed member, users can request an invite URL from the WhatsApp server. The returned URL is stored in the `failed_participants` record and displayed in the UI.

## Technical Implementation

### Database Changes

**Update failed_participants table to add:**
- `joinUrl` - The invite URL returned by the server (nullable)
- `joinUrlRequestedAt` - When the URL was requested (nullable)

### API Endpoints

**POST /api/groups/join-url**
- Request: `{ groupId, phoneNumber }`
- Proxies request to WhatsApp server
- Response: `{ url }` - The join URL from the server
- Updates the `failed_participants` record with the returned URL

### Frontend Components

1. **FailedMembersDialog** - Modal showing failed members with:
   - Failed member list with phone numbers and failure reasons
   - "Get Invite Link" button per member (calls server for URL)
   - Display of generated join URL once retrieved
   - Copy to clipboard button for each URL
   - Remove/dismiss individual entries

2. **Failed Button with Badge** - Added to ParticipantList header:
   - Shows red badge with count of failed additions
   - Opens FailedMembersDialog on click
   - Only visible when there are failed members

### State Management

- Failed participants stored in existing `failed_participants` database table
- Join URLs stored in the same table once retrieved from server
- Frontend uses existing React Query hooks (`useFailedParticipants`, etc.)
- New hook `useRequestJoinUrl` for fetching invite URLs

### Integration Points

- **CreateGroupDialog**: Already saves failed participants on group creation
- **ParticipantList**: Will show "Failed" button with badge
- **GroupSettingsPanel**: Could link to failed members management
