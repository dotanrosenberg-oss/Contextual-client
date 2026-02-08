type WaMessage = {
  body?: string | null;
  fromName?: string | null;
  fromPhone?: string | null;
  isFromMe?: boolean;
  timestamp?: string | number | Date;
};

type WaCustomer = {
  id: string;
  name?: string;
  participantCount?: number;
  avatarUrl?: string | null;
};

type WaParticipant = {
  phone?: string;
  name?: string;
};

export interface GroupSummary {
  mainTopics: string[];
  keyDecisions: string[];
  openAsksOrBlockers: string[];
  contactMentions: string[];
  lastActivityAt: string | null;
}

export interface ContactGroupEnrichmentItem {
  groupId: string;
  groupName: string;
  participantCount: number | null;
  avatarUrl: string | null;
  summary: GroupSummary;
}

export interface ContactGroupEnrichmentResponse {
  contactPhone: string;
  generatedAt: string;
  groups: ContactGroupEnrichmentItem[];
}

const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "have", "will", "just", "your", "you", "are", "our", "was", "not", "but", "can", "all", "any", "its", "about", "into", "we", "they", "their", "has", "had", "did", "been", "too", "very", "please", "thanks", "thank",
]);

interface CacheEntry {
  value: ContactGroupEnrichmentResponse;
  expiresAt: number;
}

const enrichmentCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function extractMainTopics(messages: string[], max = 4): string[] {
  const counts = new Map<string, number>();

  for (const body of messages) {
    const words = body
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

function toSentence(message: WaMessage): string {
  const sender = message.isFromMe ? "You" : (message.fromName || message.fromPhone || "Someone");
  const body = (message.body || "").trim();
  return `${sender}: ${body}`;
}

export function summarizeGroupMessages(
  allMessages: WaMessage[],
  contactPhone: string,
  contactName?: string,
): GroupSummary {
  const messages = allMessages
    .filter((m) => m.body && m.body.trim().length > 0)
    .slice(-120);

  const messageBodies = messages.map((m) => m.body || "");
  const mainTopics = extractMainTopics(messageBodies);

  const decisionRegex = /(decided|decision|approved|agree(?:d)?|confirmed|let'?s|ship it|done)/i;
  const blockerRegex = /(blocker|blocked|waiting on|stuck|issue|problem|can'?t|cannot|need help|asap|urgent|todo|follow up)/i;

  const normalizedPhone = normalizePhone(contactPhone);
  const possibleMentions = [
    normalizedPhone,
    contactName ? normalizeToken(contactName) : "",
  ].filter(Boolean);

  const keyDecisions = messages
    .filter((m) => decisionRegex.test(m.body || ""))
    .slice(-3)
    .map(toSentence);

  const openAsksOrBlockers = messages
    .filter((m) => blockerRegex.test(m.body || ""))
    .slice(-3)
    .map(toSentence);

  const contactMentions = messages
    .filter((m) => {
      const body = normalizeToken(m.body || "");
      return possibleMentions.some((needle) => body.includes(needle));
    })
    .slice(-3)
    .map(toSentence);

  const lastMessage = messages[messages.length - 1];
  const lastActivityAt = lastMessage?.timestamp
    ? new Date(lastMessage.timestamp).toISOString()
    : null;

  return {
    mainTopics,
    keyDecisions,
    openAsksOrBlockers,
    contactMentions,
    lastActivityAt,
  };
}

export function getCachedContactEnrichment(cacheKey: string): ContactGroupEnrichmentResponse | null {
  const entry = enrichmentCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    enrichmentCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

export function setCachedContactEnrichment(cacheKey: string, value: ContactGroupEnrichmentResponse) {
  enrichmentCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearContactEnrichmentCache() {
  enrichmentCache.clear();
}

export function buildContactGroupEnrichment(args: {
  contactPhone: string;
  contactName?: string;
  customers: WaCustomer[];
  participantsByGroup: Map<string, WaParticipant[]>;
  messagesByGroup: Map<string, WaMessage[]>;
}): ContactGroupEnrichmentResponse {
  const normalizedTarget = normalizePhone(args.contactPhone);

  const groups = args.customers
    .filter((customer) => customer.id.includes("@g.us"))
    .filter((group) => {
      const participants = args.participantsByGroup.get(group.id) ?? [];
      return participants.some((p) => normalizePhone(p.phone || "") === normalizedTarget);
    })
    .map((group) => {
      const groupMessages = args.messagesByGroup.get(group.id) ?? [];
      return {
        groupId: group.id,
        groupName: group.name || group.id,
        participantCount: group.participantCount ?? null,
        avatarUrl: group.avatarUrl ?? null,
        summary: summarizeGroupMessages(groupMessages, args.contactPhone, args.contactName),
      };
    })
    .sort((a, b) => {
      const aTs = a.summary.lastActivityAt ? new Date(a.summary.lastActivityAt).getTime() : 0;
      const bTs = b.summary.lastActivityAt ? new Date(b.summary.lastActivityAt).getTime() : 0;
      return bTs - aTs;
    });

  return {
    contactPhone: args.contactPhone,
    generatedAt: new Date().toISOString(),
    groups,
  };
}
