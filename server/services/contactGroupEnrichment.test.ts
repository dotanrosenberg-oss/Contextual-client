import test from "node:test";
import assert from "node:assert/strict";
import { buildContactGroupEnrichment, summarizeGroupMessages } from "./contactGroupEnrichment";

test("summarizeGroupMessages extracts decisions and blockers", () => {
  const summary = summarizeGroupMessages(
    [
      { fromName: "Alex", body: "We decided to ship on Friday", timestamp: "2026-01-01T10:00:00Z" },
      { fromName: "Sam", body: "Blocked on design assets, need help ASAP", timestamp: "2026-01-01T11:00:00Z" },
      { fromName: "Alex", body: "@15551234567 please review", timestamp: "2026-01-01T12:00:00Z" },
    ],
    "+1 (555) 123-4567",
    "Taylor",
  );

  assert.equal(summary.keyDecisions.length, 1);
  assert.equal(summary.openAsksOrBlockers.length, 1);
  assert.equal(summary.contactMentions.length, 1);
  assert.equal(summary.lastActivityAt, "2026-01-01T12:00:00.000Z");
});

test("buildContactGroupEnrichment returns only groups where contact is participant", () => {
  const payload = buildContactGroupEnrichment({
    contactPhone: "+1 (555) 123-4567",
    customers: [
      { id: "group-a@g.us", name: "A" },
      { id: "group-b@g.us", name: "B" },
      { id: "direct@c.us", name: "Direct" },
    ],
    participantsByGroup: new Map([
      ["group-a@g.us", [{ phone: "15551234567", name: "Taylor" }]],
      ["group-b@g.us", [{ phone: "18885550000", name: "Other" }]],
    ]),
    messagesByGroup: new Map(),
  });

  assert.equal(payload.groups.length, 1);
  assert.equal(payload.groups[0].groupId, "group-a@g.us");
});
