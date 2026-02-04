import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import OpenAI from "openai";
import FormData from "form-data";
import { storage } from "./storage";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const attachmentSchema = z.object({
  data: z.string(),
  mimetype: z.string(),
  filename: z.string(),
  type: z.enum(["image", "video", "audio", "document"]),
});

const sendMessageSchema = z.object({
  message: z.string(),
  attachment: attachmentSchema.optional(),
}).refine(
  (data) => data.message.trim().length > 0 || data.attachment !== undefined,
  { message: "Either message or attachment is required" }
);

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name cannot be empty"),
  participants: z.array(z.string()).min(1, "At least one participant required"),
  image: z.string().optional(), // Base64 encoded image data
  settings: z.object({
    membersCanEditSettings: z.boolean().optional(),
    membersCanSendMessages: z.boolean().optional(),
    membersCanAddMembers: z.boolean().optional(),
  }).optional(),
});

const checkNumberSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number cannot be empty"),
});

const limitQuerySchema = z.coerce.number().int().min(1).max(500).default(100);
const sinceQuerySchema = z.coerce.number().int().min(0).optional();

async function getWaSettings() {
  const settings = await storage.getSettings();
  if (!settings) {
    return null;
  }
  return {
    baseUrl: settings.waServerUrl,
    apiKey: settings.waApiKey,
  };
}

async function makeWaRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const settings = await getWaSettings();
  if (!settings) {
    return { status: 503, data: { error: "SETTINGS_NOT_CONFIGURED", message: "WhatsApp server settings not configured" } };
  }

  const url = `${settings.baseUrl}${path}`;
  const headers: Record<string, string> = {
    "X-API-Key": settings.apiKey,
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    console.error("WhatsApp server request failed:", error);
    return { status: 503, data: { error: "CONNECTION_FAILED", message: "Failed to connect to WhatsApp server" } };
  }
}

async function makeWaMultipartRequest(
  path: string,
  formData: FormData
): Promise<{ status: number; data: unknown }> {
  const settings = await getWaSettings();
  if (!settings) {
    return { status: 503, data: { error: "SETTINGS_NOT_CONFIGURED", message: "WhatsApp server settings not configured" } };
  }

  const url = `${settings.baseUrl}${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": settings.apiKey,
        ...formData.getHeaders(),
      },
      body: formData.getBuffer(),
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    console.error("WhatsApp server multipart request failed:", error);
    return { status: 503, data: { error: "CONNECTION_FAILED", message: "Failed to connect to WhatsApp server" } };
  }
}

let waWebSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;
const connectedClients = new Set<WebSocket>();

function setupWaWebSocket() {
  if (isConnecting) return;
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  isConnecting = true;
  
  getWaSettings().then((settings) => {
    if (!settings) {
      console.log("No WhatsApp settings configured, skipping WebSocket connection");
      isConnecting = false;
      return;
    }

    const wsUrl = settings.baseUrl.replace(/^http/, "ws") + `/ws?apiKey=${encodeURIComponent(settings.apiKey)}`;
    
    if (waWebSocket) {
      waWebSocket.close();
      waWebSocket = null;
    }

    try {
      waWebSocket = new WebSocket(wsUrl);

      waWebSocket.on("open", () => {
        console.log("Connected to WhatsApp server WebSocket");
        isConnecting = false;
        broadcastToClients({ type: "wa_connected", data: { message: "Connected to WhatsApp server" } });
      });

      waWebSocket.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          broadcastToClients(message);
        } catch (e) {
          console.error("Failed to parse WA WebSocket message:", e);
        }
      });

      waWebSocket.on("close", () => {
        console.log("WhatsApp server WebSocket closed");
        waWebSocket = null;
        isConnecting = false;
        broadcastToClients({ type: "wa_disconnected", data: { message: "Disconnected from WhatsApp server" } });
        reconnectTimer = setTimeout(setupWaWebSocket, 5000);
      });

      waWebSocket.on("error", (error) => {
        console.error("WhatsApp server WebSocket error:", error);
        isConnecting = false;
      });
    } catch (error) {
      console.error("Failed to create WhatsApp WebSocket connection:", error);
      isConnecting = false;
    }
  }).catch(() => {
    isConnecting = false;
  });
}

function broadcastToClients(message: unknown) {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const clientApiKey = url.searchParams.get("apiKey");
    
    const settings = await getWaSettings();
    
    if (!settings) {
      ws.send(JSON.stringify({ type: "error", data: { code: "SETTINGS_NOT_CONFIGURED", message: "Server not configured" } }));
      ws.close(4001, "Server not configured");
      return;
    }
    
    if (!clientApiKey || clientApiKey !== settings.apiKey) {
      ws.send(JSON.stringify({ type: "error", data: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } }));
      ws.close(4003, "Unauthorized");
      return;
    }
    
    connectedClients.add(ws);
    console.log("Client connected to WebSocket (authenticated)");

    ws.send(JSON.stringify({ type: "connected", data: { message: "Connected to Contextify server" } }));

    ws.on("close", () => {
      connectedClients.delete(ws);
      console.log("Client disconnected from WebSocket");
    });

    ws.on("error", (error) => {
      console.error("Client WebSocket error:", error);
      connectedClients.delete(ws);
    });
  });

  setupWaWebSocket();

  // Settings routes
  app.get("/api/settings", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      if (!settings) {
        return res.json({ configured: false });
      }

      const maskedApiKey = settings.waApiKey
        ? settings.waApiKey.slice(0, 4) + "****" + settings.waApiKey.slice(-4)
        : "";

      res.json({
        configured: true,
        baseUrl: settings.waServerUrl,
        apiKey: maskedApiKey,
        updatedAt: settings.updatedAt,
      });
    } catch (error) {
      console.error("Failed to get settings:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to retrieve settings" });
    }
  });

  const updateSettingsSchema = z.object({
    baseUrl: z.string().url(),
    apiKey: z.string().min(1),
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
      }

      const { baseUrl, apiKey } = parsed.data;

      const settings = await storage.saveSettings({
        waServerUrl: baseUrl.replace(/\/$/, ""),
        waApiKey: apiKey,
      });

      setupWaWebSocket();

      res.json({
        success: true,
        configured: true,
        baseUrl: settings.waServerUrl,
        updatedAt: settings.updatedAt,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to save settings" });
    }
  });

  // WhatsApp proxy routes
  app.get("/api/wa/status", async (_req: Request, res: Response) => {
    const { status, data } = await makeWaRequest("GET", "/api/status");
    res.status(status).json(data);
  });

  app.get("/api/wa/customers", async (_req: Request, res: Response) => {
    const { status, data } = await makeWaRequest("GET", "/api/customers");
    res.status(status).json(data);
  });

  app.get("/api/wa/customers/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, data } = await makeWaRequest("GET", `/api/customers/${encodeURIComponent(id)}`);
    res.status(status).json(data);
  });

  app.delete("/api/wa/customers/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, data } = await makeWaRequest("DELETE", `/api/customers/${encodeURIComponent(id)}`);
    res.status(status).json(data);
  });

  app.post("/api/wa/customers/sync", async (_req: Request, res: Response) => {
    const { status, data } = await makeWaRequest("POST", "/api/customers/sync");
    res.status(status).json(data);
  });

  app.get("/api/wa/customers/:id/messages", async (req: Request, res: Response) => {
    const { id } = req.params;
    const limitResult = limitQuerySchema.safeParse(req.query.limit);
    const limit = limitResult.success ? limitResult.data : 100;
    const sinceResult = sinceQuerySchema.safeParse(req.query.since);
    const since = sinceResult.success ? sinceResult.data : undefined;
    
    let path = `/api/customers/${encodeURIComponent(id)}/messages?limit=${limit}`;
    if (since !== undefined) {
      path += `&since=${since}`;
    }
    
    const { status, data } = await makeWaRequest("GET", path);
    
    if (status === 200 && data && typeof data === "object" && "messages" in data) {
      const messages = (data as { messages: Array<{ fromPhone?: string | null; fromName?: string | null }> }).messages;
      
      const seen = new Set<string>();
      for (const msg of messages) {
        if (msg.fromPhone && msg.fromName && !seen.has(msg.fromPhone)) {
          seen.add(msg.fromPhone);
          try {
            await storage.upsertContact({
              phone: msg.fromPhone,
              name: msg.fromName,
              profilePicUrl: null,
            });
          } catch (err) {
            console.error("Failed to save contact from message:", err);
          }
        }
      }
    }
    
    res.status(status).json(data);
  });

  app.post("/api/wa/customers/:id/messages", async (req: Request, res: Response) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
    }
    const { id } = req.params;
    
    // If there's an attachment, use multipart form data
    if (parsed.data.attachment) {
      const { data: base64Data, mimetype, filename } = parsed.data.attachment;
      
      // Convert base64 to buffer
      const fileBuffer = Buffer.from(base64Data, "base64");
      
      // Create FormData
      const formData = new FormData();
      formData.append("file", fileBuffer, {
        filename,
        contentType: mimetype,
      });
      
      // Add caption if there's a message
      if (parsed.data.message.trim()) {
        formData.append("caption", parsed.data.message);
      }
      
      const { status, data } = await makeWaMultipartRequest(
        `/api/customers/${encodeURIComponent(id)}/messages`,
        formData
      );
      return res.status(status).json(data);
    }
    
    // Text-only message - use JSON
    const { status, data } = await makeWaRequest(
      "POST",
      `/api/customers/${encodeURIComponent(id)}/messages`,
      { message: parsed.data.message }
    );
    res.status(status).json(data);
  });

  app.post("/api/wa/groups/create", async (req: Request, res: Response) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
    }
    const { status, data } = await makeWaRequest("POST", "/api/groups/create", parsed.data);
    res.status(status).json(data);
  });

  app.post("/api/wa/diagnostics/check-number", async (req: Request, res: Response) => {
    const parsed = checkNumberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
    }
    const { status, data } = await makeWaRequest("POST", "/api/diagnostics/check-number", parsed.data);
    res.status(status).json(data);
  });

  app.get("/api/wa/whatsapp/messages/:chatId", async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const limitResult = limitQuerySchema.safeParse(req.query.limit);
    const limit = limitResult.success ? limitResult.data : 100;
    
    const path = `/api/whatsapp/messages/${encodeURIComponent(chatId)}?limit=${limit}`;
    const { status, data } = await makeWaRequest("GET", path);
    res.status(status).json(data);
  });

  app.get("/api/wa/customers/:id/participants", async (req: Request, res: Response) => {
    const { id } = req.params;
    const includePhotos = req.query.includePhotos === "true";
    
    const path = `/api/customers/${encodeURIComponent(id)}/participants?includePhotos=${includePhotos}`;
    const { status, data } = await makeWaRequest("GET", path);
    
    if (status === 200 && data && typeof data === "object" && "participants" in data) {
      const participants = (data as { participants: Array<{ phone?: string; name?: string; profilePicUrl?: string | null }> }).participants;
      
      for (const participant of participants) {
        if (participant.phone && participant.name) {
          try {
            await storage.upsertContact({
              phone: participant.phone,
              name: participant.name,
              profilePicUrl: participant.profilePicUrl || null,
            });
          } catch (err) {
            console.error("Failed to save contact:", err);
          }
        }
      }
    }
    
    res.status(status).json(data);
  });

  // AI Insights route
  const generateInsightsSchema = z.object({
    customerId: z.string(),
    messages: z.array(z.object({
      id: z.string(),
      body: z.string(),
      fromName: z.string().nullable().optional(),
      fromPhone: z.string().nullable().optional(),
      timestamp: z.string().or(z.date()),
      isFromMe: z.boolean().optional(),
    })),
  });

  app.post("/api/insights/generate", async (req: Request, res: Response) => {
    try {
      const parsed = generateInsightsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
      }

      const { customerId, messages } = parsed.data;

      if (messages.length === 0) {
        return res.status(400).json({ error: "NO_MESSAGES", message: "No messages provided for analysis" });
      }

      const conversationText = messages
        .map((m) => {
          const sender = m.isFromMe ? "Me" : (m.fromName || m.fromPhone || "Unknown");
          return `[${sender}]: ${m.body}`;
        })
        .join("\n");

      const systemPrompt = `You are an AI assistant that analyzes WhatsApp conversations and provides actionable insights. Analyze the conversation and provide:

1. A brief summary (2-3 sentences) of the conversation
2. Key topics discussed (list of 3-5 topics)
3. Action items or follow-ups if any (list of items)
4. Relationship strength score (1-10, where 10 is very strong engagement)
5. Recommendations for the user

Respond in JSON format with the following structure:
{
  "summary": "string",
  "keyTopics": ["topic1", "topic2", ...],
  "actionItems": ["item1", "item2", ...],
  "relationshipStrength": number,
  "recommendations": ["recommendation1", ...]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this conversation:\n\n${conversationText}` },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      let insights;
      try {
        insights = JSON.parse(content);
      } catch {
        throw new Error("Failed to parse AI response");
      }

      const insightDataSchema = z.object({
        summary: z.string().default("No summary available"),
        keyTopics: z.array(z.string()).default([]),
        actionItems: z.array(z.string()).default([]),
        relationshipStrength: z.number().min(1).max(10).default(5),
        recommendations: z.array(z.string()).default([]),
      });

      const validatedInsights = insightDataSchema.parse(insights);

      const savedInsight = await storage.saveInsight({
        customerId,
        summary: validatedInsights.summary,
        keyTopics: validatedInsights.keyTopics,
        actionItems: validatedInsights.actionItems,
        relationshipStrength: validatedInsights.relationshipStrength,
        lastInteraction: new Date(),
      });

      res.json({
        success: true,
        insight: {
          ...savedInsight,
          recommendations: validatedInsights.recommendations,
        },
      });
    } catch (error) {
      console.error("Failed to generate insights:", error);
      res.status(500).json({ error: "AI_ERROR", message: "Failed to generate insights" });
    }
  });

  app.get("/api/insights/:customerId", async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const insight = await storage.getInsight(customerId);
      
      if (!insight) {
        return res.status(404).json({ error: "NOT_FOUND", message: "No insights found for this customer" });
      }

      res.json(insight);
    } catch (error) {
      console.error("Failed to get insight:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to retrieve insight" });
    }
  });

  // Failed participants routes
  app.get("/api/customers/:customerId/failed-participants", async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const failedParticipants = await storage.getFailedParticipants(customerId);
      res.json({ failedParticipants });
    } catch (error) {
      console.error("Failed to get failed participants:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to retrieve failed participants" });
    }
  });

  const saveFailedParticipantsSchema = z.object({
    customerId: z.string(),
    participants: z.array(z.object({
      phoneNumber: z.string(),
      reason: z.string(),
    })),
  });

  app.post("/api/customers/failed-participants", async (req: Request, res: Response) => {
    try {
      const parsed = saveFailedParticipantsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
      }

      const { customerId, participants } = parsed.data;
      const toSave = participants.map(p => ({
        customerId,
        phoneNumber: p.phoneNumber,
        reason: p.reason,
      }));

      const saved = await storage.saveFailedParticipants(toSave);
      res.json({ success: true, failedParticipants: saved });
    } catch (error) {
      console.error("Failed to save failed participants:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to save failed participants" });
    }
  });

  app.delete("/api/customers/failed-participants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "INVALID_ID", message: "Invalid participant ID" });
      }
      await storage.deleteFailedParticipant(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete failed participant:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to delete failed participant" });
    }
  });

  // Contacts routes
  app.get("/api/contacts", async (_req: Request, res: Response) => {
    try {
      const contactList = await storage.getContacts();
      res.json({ contacts: contactList });
    } catch (error) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to retrieve contacts" });
    }
  });

  app.post("/api/contacts/sync", async (_req: Request, res: Response) => {
    try {
      const { status: customersStatus, data: customersData } = await makeWaRequest("GET", "/api/customers");
      
      if (customersStatus !== 200 || !customersData || !Array.isArray(customersData)) {
        console.log(`[contacts-sync] Failed to fetch customers: status ${customersStatus}`);
        return res.status(500).json({ error: "FETCH_ERROR", message: "Failed to fetch customers from WhatsApp" });
      }
      
      const groups = customersData.filter((c: { id?: string }) => c.id?.includes("@g.us"));
      
      let totalSynced = 0;
      let groupsProcessed = 0;
      
      console.log(`[contacts-sync] Found ${groups.length} groups to process`);
      
      for (const group of groups) {
        const path = `/api/customers/${encodeURIComponent(group.id)}/participants?includePhotos=false`;
        const { status, data } = await makeWaRequest("GET", path);
        
        groupsProcessed++;
        
        if (status === 200 && data && typeof data === "object" && "participants" in data) {
          const participants = (data as { participants: Array<{ phone?: string; name?: string; pushName?: string; profilePicUrl?: string | null }> }).participants;
          
          for (const participant of participants) {
            const phone = participant.phone;
            const name = participant.name || participant.pushName || phone;
            
            if (phone && name) {
              try {
                await storage.upsertContact({
                  phone: phone,
                  name: name,
                  profilePicUrl: participant.profilePicUrl || null,
                });
                totalSynced++;
              } catch (err) {
                console.error("Failed to save contact:", err);
              }
            }
          }
        } else if (status !== 200) {
          console.log(`[contacts-sync] Group ${group.id} returned status ${status}`);
        }
      }
      
      console.log(`[contacts-sync] Processed ${groupsProcessed} groups, synced ${totalSynced} contacts`);
      
      const contactList = await storage.getContacts();
      res.json({ success: true, synced: totalSynced, contacts: contactList });
    } catch (error) {
      console.error("Failed to sync contacts:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to sync contacts" });
    }
  });

  app.get("/api/contacts/:phone", async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const contact = await storage.getContactByPhone(phone);
      if (!contact) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Failed to get contact:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to retrieve contact" });
    }
  });

  return httpServer;
}
