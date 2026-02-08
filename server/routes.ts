import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import OpenAI from "openai";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import FormData from "form-data";
import * as fs from "fs";
import * as path from "path";
import {
  buildContactGroupEnrichment,
  getCachedContactEnrichment,
  setCachedContactEnrichment,
} from "./services/contactGroupEnrichment";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const sendMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
});

const sendPollSchema = z.object({
  question: z.string().min(1, "Poll question is required").max(255),
  options: z.array(z.string().max(100)).min(2).max(12),
  allowMultipleAnswers: z.boolean().optional().default(false),
});

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

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
    
    // Merge with local avatar data
    if (status === 200 && Array.isArray(data)) {
      const localCustomers = await storage.getCustomers();
      const avatarMap = new Map(
        localCustomers.filter(c => c.avatarUrl).map(c => [c.id, c.avatarUrl])
      );
      
      const enrichedData = data.map((customer: { id: string; avatarUrl?: string | null }) => ({
        ...customer,
        avatarUrl: avatarMap.get(customer.id) || customer.avatarUrl || null,
      }));
      
      return res.status(status).json(enrichedData);
    }
    
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

  app.post("/api/wa/customers/:id/messages", upload.single("file"), async (req: Request, res: Response) => {
    const { id } = req.params;
    const settings = await getWaSettings();
    
    if (!settings) {
      return res.status(503).json({ error: "SETTINGS_NOT_CONFIGURED", message: "WhatsApp server settings not configured" });
    }
    
    const url = `${settings.baseUrl}/api/customers/${encodeURIComponent(id)}/messages`;
    
    if (req.file) {
      const formData = new FormData();
      formData.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      
      if (req.body.caption) {
        formData.append("caption", req.body.caption);
      }
      
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
        return res.status(response.status).json(data);
      } catch (error) {
        console.error("WhatsApp server request failed:", error);
        return res.status(503).json({ error: "CONNECTION_FAILED", message: "Failed to connect to WhatsApp server" });
      }
    } else {
      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
      }
      
      const payload: Record<string, unknown> = {};
      if (parsed.data.message.trim()) {
        payload.message = parsed.data.message;
      }
      
      const { status, data } = await makeWaRequest("POST", `/api/customers/${encodeURIComponent(id)}/messages`, payload);
      res.status(status).json(data);
    }
  });

  const editMessageSchema = z.object({
    message: z.string().min(1, "Message cannot be empty"),
  });

  app.patch("/api/wa/customers/:id/messages/:messageId", async (req: Request, res: Response) => {
    const { id, messageId } = req.params;
    const parsed = editMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
    }

    const { status, data } = await makeWaRequest(
      "PATCH",
      `/api/customers/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
      { message: parsed.data.message }
    );
    res.status(status).json(data);
  });

  app.delete("/api/wa/customers/:id/messages/:messageId", async (req: Request, res: Response) => {
    const { id, messageId } = req.params;
    const { status, data } = await makeWaRequest(
      "DELETE",
      `/api/customers/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`
    );
    res.status(status).json(data);
  });

  // Send poll to a customer (WhatsApp group)
  app.post("/api/wa/customers/:id/poll", async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log("[poll] Received poll request for:", id, "body:", JSON.stringify(req.body));
    const parsed = sendPollSchema.safeParse(req.body);
    
    if (!parsed.success) {
      console.log("[poll] Validation failed:", parsed.error.errors);
      return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
    }
    
    console.log("[poll] Sending to WhatsApp server:", parsed.data);
    const { status, data } = await makeWaRequest("POST", `/api/customers/${encodeURIComponent(id)}/poll`, parsed.data);
    console.log("[poll] WhatsApp response status:", status, "data:", JSON.stringify(data));
    res.status(status).json(data);
  });

  app.post("/api/wa/groups/create", upload.single("icon"), async (req: Request, res: Response) => {
    const settings = await getWaSettings();
    
    if (!settings) {
      return res.status(503).json({ error: "SETTINGS_NOT_CONFIGURED", message: "WhatsApp server settings not configured" });
    }
    
    const url = `${settings.baseUrl}/api/groups/create`;
    let savedIconPath: string | null = null;
    
    if (req.file) {
      // Handle multipart form data with icon
      const formData = new FormData();
      formData.append("name", req.body.name);
      
      // Participants should be a JSON string array
      const participants = req.body.participants;
      if (typeof participants === "string") {
        formData.append("participants", participants);
      } else if (Array.isArray(participants)) {
        formData.append("participants", JSON.stringify(participants));
      }
      
      // Settings should be a JSON string object
      if (req.body.settings) {
        const settingsValue = typeof req.body.settings === "string" 
          ? req.body.settings 
          : JSON.stringify(req.body.settings);
        formData.append("settings", settingsValue);
      }
      
      // Append the icon file
      formData.append("icon", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      
      // Save icon locally for display
      const iconFilename = `${Date.now()}-${req.file.originalname}`;
      const iconDir = path.join(process.cwd(), "uploads", "group-icons");
      const iconPath = path.join(iconDir, iconFilename);
      
      try {
        // Ensure directory exists
        if (!fs.existsSync(iconDir)) {
          fs.mkdirSync(iconDir, { recursive: true });
        }
        fs.writeFileSync(iconPath, req.file.buffer);
        savedIconPath = `/uploads/group-icons/${iconFilename}`;
      } catch (err) {
        console.error("Failed to save icon locally:", err);
      }
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "X-API-Key": settings.apiKey,
            ...formData.getHeaders(),
          },
          body: formData.getBuffer(),
        });
        
        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        
        // If group creation was successful and we have an icon, save the customer with avatar
        // Handle different response key formats (groupId, id, customer.id)
        const groupId = (data.groupId as string) || 
                       (data.id as string) || 
                       ((data.customer as { id?: string })?.id) ||
                       null;
        
        if (response.ok && groupId && savedIconPath) {
          const groupName = (data.groupName as string) || 
                           (data.name as string) || 
                           ((data.customer as { name?: string })?.name) ||
                           req.body.name;
          try {
            await storage.upsertCustomer({
              id: groupId,
              name: groupName,
              avatarUrl: savedIconPath,
              participantCount: (data.customer as { participantCount?: number })?.participantCount || 1,
            });
          } catch (err) {
            console.error("Failed to save customer with avatar:", err);
          }
        }
        
        return res.status(response.status).json(data);
      } catch (error) {
        console.error("WhatsApp server request failed:", error);
        return res.status(503).json({ error: "CONNECTION_FAILED", message: "Failed to connect to WhatsApp server" });
      }
    } else {
      // Handle JSON request without icon
      const parsed = createGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
      }
      const { status, data } = await makeWaRequest("POST", "/api/groups/create", parsed.data);
      res.status(status).json(data);
    }
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

  // Get group settings
  app.get("/api/wa/customers/:id/settings", async (req: Request, res: Response) => {
    const { id } = req.params;
    const path = `/api/customers/${encodeURIComponent(id)}/settings`;
    const { status, data } = await makeWaRequest("GET", path);
    res.status(status).json(data);
  });

  // Update group settings
  const groupSettingsSchema = z.object({
    membersCanEditSettings: z.boolean().optional(),
    membersCanSendMessages: z.boolean().optional(),
    membersCanAddMembers: z.boolean().optional(),
  });

  app.patch("/api/wa/customers/:id/settings", async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = groupSettingsSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid request body" });
    }
    
    const path = `/api/customers/${encodeURIComponent(id)}/settings`;
    const { status, data } = await makeWaRequest("PATCH", path, parsed.data);
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

  const requestJoinUrlSchema = z.object({
    groupId: z.string(),
    phoneNumber: z.string(),
    failedParticipantId: z.number(),
  });

  app.post("/api/groups/join-url", async (req: Request, res: Response) => {
    try {
      const parsed = requestJoinUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
      }

      const { groupId, phoneNumber, failedParticipantId } = parsed.data;

      const existingRecord = await storage.getFailedParticipantById(failedParticipantId);
      if (!existingRecord) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Failed participant record not found" });
      }

      if (existingRecord.customerId !== groupId) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Failed participant does not belong to this group" });
      }

      const { status, data } = await makeWaRequest("POST", "/api/groups/join-url", {
        groupId,
        userId: phoneNumber,
      });

      if (status !== 200 || !data || typeof data !== "object") {
        return res.status(status).json(data || { error: "REQUEST_FAILED", message: "Failed to get join URL from WhatsApp server" });
      }

      const responseData = data as { url?: string };
      if (!responseData.url) {
        return res.status(500).json({ error: "NO_URL", message: "WhatsApp server did not return a join URL" });
      }

      const updated = await storage.updateFailedParticipantJoinUrl(failedParticipantId, responseData.url);
      if (!updated) {
        return res.status(500).json({ error: "UPDATE_FAILED", message: "Failed to update join URL in database" });
      }

      res.json({ 
        success: true, 
        url: responseData.url,
        failedParticipant: updated,
      });
    } catch (error) {
      console.error("Failed to request join URL:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to request join URL" });
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

  app.get("/api/contacts/:phone/group-enrichment", async (req: Request, res: Response) => {
    const featureEnabled = process.env.ENABLE_CONTACT_GROUP_ENRICHMENT !== "false";
    if (!featureEnabled) {
      return res.status(404).json({
        error: "FEATURE_DISABLED",
        message: "Group enrichment is disabled",
      });
    }

    try {
      const { phone } = req.params;
      const refresh = req.query.refresh === "true";
      const cacheKey = `contact-group-enrichment:${phone}`;

      if (!refresh) {
        const cached = getCachedContactEnrichment(cacheKey);
        if (cached) {
          return res.json({ ...cached, cached: true });
        }
      }

      const contact = await storage.getContactByPhone(phone);
      if (!contact) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      }

      const { status: customersStatus, data: customersData } = await makeWaRequest("GET", "/api/customers");
      if (customersStatus !== 200 || !Array.isArray(customersData)) {
        return res.status(502).json({
          error: "UPSTREAM_ERROR",
          message: "Failed to fetch groups from WhatsApp service",
        });
      }

      const customers = customersData.filter(
        (value): value is { id: string; name?: string; participantCount?: number; avatarUrl?: string | null } =>
          !!value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string",
      );

      const groups = customers.filter((c) => c.id.includes("@g.us"));

      const participantsByGroup = new Map<string, Array<{ phone?: string; name?: string }>>();
      const messagesByGroup = new Map<string, Array<{ body?: string; fromName?: string; fromPhone?: string; isFromMe?: boolean; timestamp?: string | number | Date }>>();
      const normalizedTargetPhone = phone.replace(/[^\d]/g, "");

      for (const group of groups) {
        const participantsPath = `/api/customers/${encodeURIComponent(group.id)}/participants?includePhotos=false`;
        const { status: participantsStatus, data: participantsData } = await makeWaRequest("GET", participantsPath);

        if (participantsStatus !== 200 || !participantsData || typeof participantsData !== "object" || !("participants" in participantsData)) {
          continue;
        }

        const participantsRaw = (participantsData as { participants?: unknown }).participants;
        const participants = Array.isArray(participantsRaw)
          ? participantsRaw.filter(
              (p): p is { phone?: string; name?: string } => !!p && typeof p === "object",
            )
          : [];

        participantsByGroup.set(group.id, participants);

        const contactIsInGroup = participants.some(
          (p) => (p.phone || "").replace(/[^\d]/g, "") === normalizedTargetPhone,
        );
        if (!contactIsInGroup) {
          continue;
        }

        const messagesPath = `/api/customers/${encodeURIComponent(group.id)}/messages?limit=80`;
        const { status: messagesStatus, data: messagesData } = await makeWaRequest("GET", messagesPath);

        if (messagesStatus === 200 && Array.isArray(messagesData)) {
          messagesByGroup.set(group.id, messagesData as Array<{ body?: string; fromName?: string; fromPhone?: string; isFromMe?: boolean; timestamp?: string | number | Date }>);
        } else if (
          messagesStatus === 200 &&
          messagesData &&
          typeof messagesData === "object" &&
          "messages" in messagesData &&
          Array.isArray((messagesData as { messages?: unknown }).messages)
        ) {
          messagesByGroup.set(group.id, (messagesData as { messages: Array<{ body?: string; fromName?: string; fromPhone?: string; isFromMe?: boolean; timestamp?: string | number | Date }> }).messages);
        }
      }

      const payload = buildContactGroupEnrichment({
        contactPhone: phone,
        contactName: contact.name,
        customers,
        participantsByGroup,
        messagesByGroup,
      });

      setCachedContactEnrichment(cacheKey, payload);
      res.json({ ...payload, cached: false });
    } catch (error) {
      console.error("Failed to get contact group enrichment:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to retrieve contact group enrichment" });
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
