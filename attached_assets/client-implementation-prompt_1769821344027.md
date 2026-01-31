# CLIENT-SIDE IMPLEMENTATION PROMPT
## Display Group Participants in React UI

---

## Context
I have a React-based WhatsApp CRM client that displays groups (customers) and their messages. The server now provides an endpoint to fetch group participants, and I need to build a UI component to display them.

The backend endpoint is already implemented and returns participant data including names, phone numbers, admin status, and optionally profile pictures.

---

## Current Architecture

### Tech Stack
- React (with TypeScript or JavaScript)
- Likely using: React Router, Tailwind CSS or similar
- HTTP client: `fetch` or `axios`
- State management: React hooks (useState, useEffect)

### Existing Components (Assumed)
```
client/
├── components/
│   ├── CustomerList.tsx      # Shows list of groups
│   ├── CustomerDetail.tsx    # Shows group details
│   └── MessageList.tsx       # Shows messages
├── api/
│   └── api.ts               # API client utilities
└── types/
    └── types.ts             # TypeScript types
```

### API Configuration
```typescript
// Assumed existing API setup
const API_KEY = import.meta.env.VITE_API_KEY;
const API_BASE_URL = '/api'; // or full URL if different origin

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json'
};
```

---

## Requirements

### 1. Create Participant Type Definition

**File:** `types/types.ts` (or similar)

```typescript
export interface Participant {
  id: string;              // WhatsApp ID: "1234567890@c.us"
  name: string;            // Display name
  phone: string;           // Phone number without country code
  isAdmin: boolean;        // Is group admin
  isSuperAdmin: boolean;   // Is group creator
  profilePicUrl?: string;  // Optional profile picture URL
}

export interface ParticipantsResponse {
  participants: Participant[];
}
```

### 2. Create API Function

**File:** `api/api.ts` (or similar)

Create a function to fetch participants:

```typescript
export async function getGroupParticipants(
  groupId: string,
  includePhotos: boolean = false
): Promise<Participant[]>
```

**Requirements:**
- Accept `groupId` and optional `includePhotos` parameter
- Build URL: `/api/customers/${groupId}/participants?includePhotos=${includePhotos}`
- Include API key in headers
- Make GET request
- Handle errors (network errors, 503 service unavailable, etc.)
- Return participants array
- Type the response properly

**Error Handling:**
- If 503 (WhatsApp not connected): throw descriptive error
- If 404 (group not found): throw descriptive error
- If network error: throw descriptive error

### 3. Create ParticipantList Component

**File:** `components/ParticipantList.tsx`

Create a reusable component that displays participants.

**Props:**
```typescript
interface ParticipantListProps {
  groupId: string;
  includePhotos?: boolean;
}
```

**Features:**
- Fetch participants on mount using `useEffect`
- Show loading state while fetching
- Show error state if fetch fails
- Display participants in a list/grid
- Show participant avatar (photo or initials fallback)
- Show participant name
- Show phone number (formatted or masked)
- Show badge for admins ("Admin" or "Creator")
- Handle empty state (no participants)

**UI Requirements:**
- Responsive design (mobile-friendly)
- Accessible (semantic HTML, ARIA labels)
- Clean, professional appearance
- Smooth loading states (skeleton or spinner)

### 4. Avatar Component (Optional but Recommended)

**File:** `components/Avatar.tsx`

Create a reusable avatar component:

**Props:**
```typescript
interface AvatarProps {
  src?: string | null;     // Profile picture URL
  name: string;            // For fallback initials
  size?: 'sm' | 'md' | 'lg';
}
```

**Features:**
- Display image if `src` is provided
- Fallback to initials if no image (first 2 letters of name)
- Different sizes: small (32px), medium (48px), large (64px)
- Circular shape
- Background color based on name (consistent color per user)

### 5. Integration Points

Show how to integrate `ParticipantList` into existing UI:

**Option A: Modal/Dialog**
```typescript
// In CustomerDetail.tsx
<Dialog open={showParticipants} onClose={...}>
  <ParticipantList groupId={customer.id} includePhotos={true} />
</Dialog>
```

**Option B: Side Panel**
```typescript
// In CustomerDetail.tsx
<div className="flex">
  <MessageList customerId={customer.id} />
  <ParticipantList groupId={customer.id} />
</div>
```

**Option C: Tab View**
```typescript
// In CustomerDetail.tsx
<Tabs>
  <Tab label="Messages">
    <MessageList customerId={customer.id} />
  </Tab>
  <Tab label="Participants">
    <ParticipantList groupId={customer.id} />
  </Tab>
</Tabs>
```

---

## Design Guidelines

### Loading States
```
┌─────────────────────────────┐
│ Loading participants...     │
│                              │
│ ⚪ ─────────────             │
│ ⚪ ─────────────             │
│ ⚪ ─────────────             │
└─────────────────────────────┘
```

### Loaded State
```
┌─────────────────────────────┐
│ Participants (12)            │
│                              │
│ 🔵 John Doe        [Admin]   │
│    +1234567890              │
│                              │
│ 🟢 Jane Smith               │
│    +0987654321              │
│                              │
│ 🟣 Bob Johnson     [Creator] │
│    +1122334455              │
└─────────────────────────────┘
```

### Error State
```
┌─────────────────────────────┐
│ ⚠️ Failed to load           │
│ participants                │
│                              │
│ Server is not connected     │
│ to WhatsApp                 │
│                              │
│ [Retry]                     │
└─────────────────────────────┘
```

---

## Code Style Preferences

### Use Modern React Patterns
- Functional components only (no classes)
- React hooks (useState, useEffect, useMemo, useCallback)
- TypeScript for type safety
- Proper error boundaries

### Styling Options
Choose ONE based on your stack:
- **Tailwind CSS**: Utility classes
- **CSS Modules**: Scoped styles
- **Styled Components**: CSS-in-JS
- **Plain CSS**: Traditional stylesheets

### Accessibility
- Use semantic HTML (`<ul>`, `<li>`, `<button>`)
- Include ARIA labels where needed
- Keyboard navigation support
- Focus indicators

---

## Example User Flows

### Flow 1: View Participants
1. User clicks group in list
2. Group detail page opens
3. User clicks "View Participants" button
4. Participant list displays (names load immediately)
5. Profile pictures load progressively

### Flow 2: Participant Management (Future)
1. User views participants
2. User clicks on participant
3. Opens participant detail/actions
4. (Future: Add/remove, promote, etc.)

---

## Performance Considerations

### Optimization Strategies
1. **Lazy loading**: Load photos after names appear
2. **Caching**: Cache participant data for 5 minutes
3. **Pagination**: If 100+ participants, paginate or virtualize
4. **Debouncing**: If adding search, debounce input

### Progressive Loading
```typescript
// Step 1: Load names quickly
const participants = await getGroupParticipants(groupId, false);
setParticipants(participants);

// Step 2: Load photos in background
setTimeout(async () => {
  const withPhotos = await getGroupParticipants(groupId, true);
  setParticipants(withPhotos);
}, 100);
```

---

## Testing Requirements

### Manual Testing
1. ✅ Component renders with loading state
2. ✅ Participants display correctly
3. ✅ Admin badges show for admins
4. ✅ Profile pictures load (or show initials)
5. ✅ Error state displays when server disconnected
6. ✅ Retry button works
7. ✅ Responsive on mobile
8. ✅ Accessible via keyboard

### Edge Cases
- Empty group (no participants)
- Large group (100+ participants)
- Participant with no name (show phone number)
- Participant with no profile picture (show initials)
- Network error during fetch
- Server not connected to WhatsApp

---

## Deliverables

Please provide:
1. **Type definitions** for Participant interface
2. **API function** to fetch participants
3. **ParticipantList component** with full implementation
4. **Avatar component** (optional but recommended)
5. **Usage example** showing integration
6. **Styling** (using your preferred method)
7. **Brief documentation** of component props and usage

---

## Bonus Features (Optional)

If time permits, consider adding:
- 🔍 Search/filter participants by name
- 📊 Sort by name, admin status, etc.
- 📱 Click-to-call (tel: link on phone numbers)
- 💬 Click participant to open DM (future)
- ♻️ Pull-to-refresh on mobile
- 🎨 Customizable colors/theme
- ⚡ Virtual scrolling for large lists (react-window)

---

## Example Mock Data

For development/testing:

```typescript
const mockParticipants: Participant[] = [
  {
    id: "1234567890@c.us",
    name: "John Doe",
    phone: "1234567890",
    isAdmin: true,
    isSuperAdmin: false,
    profilePicUrl: "https://i.pravatar.cc/150?img=1"
  },
  {
    id: "0987654321@c.us",
    name: "Jane Smith",
    phone: "0987654321",
    isAdmin: false,
    isSuperAdmin: false,
    profilePicUrl: null
  },
  {
    id: "1122334455@c.us",
    name: "Bob Johnson",
    phone: "1122334455",
    isAdmin: true,
    isSuperAdmin: true,
    profilePicUrl: "https://i.pravatar.cc/150?img=3"
  }
];
```

---

## Success Criteria

✅ Component displays participant list correctly
✅ Loading and error states work properly
✅ Profile pictures display (or fallback to initials)
✅ Admin badges show correctly
✅ Mobile responsive
✅ Accessible via keyboard
✅ Clean, professional design
✅ Type-safe (if using TypeScript)
✅ Easy to integrate into existing UI

---

## Questions to Consider

Before starting implementation, decide:
1. Where should the participant list appear? (modal, sidebar, tab, separate page)
2. Should photos load immediately or progressively?
3. What styling framework are you using?
4. Should the list be searchable/filterable?
5. What happens when user clicks a participant?
