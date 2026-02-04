import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  waServerUrl: text("wa_server_url").notNull(),
  waApiKey: text("wa_api_key").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  participantCount: integer("participant_count"),
  lastMessage: text("last_message"),
  lastMessageTime: timestamp("last_message_time"),
  unreadCount: integer("unread_count").default(0),
  isAdmin: boolean("is_admin").default(false),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  customerId: varchar("customer_id").references(() => customers.id),
  body: text("body").notNull(),
  fromPhone: text("from_phone"),
  fromName: text("from_name"),
  timestamp: timestamp("timestamp").notNull(),
  isFromMe: boolean("is_from_me").default(false),
  hasMedia: boolean("has_media").default(false),
  messageType: text("message_type").default("text"),
  mediaUrl: text("media_url"),
  mimetype: text("mimetype"),
  filename: text("filename"),
});

export const insertMessageSchema = createInsertSchema(messages);

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const contactInsights = pgTable("contact_insights", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").references(() => customers.id),
  summary: text("summary"),
  keyTopics: text("key_topics").array(),
  actionItems: text("action_items").array(),
  lastInteraction: timestamp("last_interaction"),
  relationshipStrength: integer("relationship_strength"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const insertContactInsightSchema = createInsertSchema(contactInsights).omit({
  id: true,
  generatedAt: true,
});

export type InsertContactInsight = z.infer<typeof insertContactInsightSchema>;
export type ContactInsight = typeof contactInsights.$inferSelect;

export const socialIntegrations = pgTable("social_integrations", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").references(() => customers.id),
  platform: text("platform").notNull(),
  profileUrl: text("profile_url"),
  username: text("username"),
  lastActivity: text("last_activity"),
  connected: boolean("connected").default(false),
});

export const insertSocialIntegrationSchema = createInsertSchema(socialIntegrations).omit({
  id: true,
});

export type InsertSocialIntegration = z.infer<typeof insertSocialIntegrationSchema>;
export type SocialIntegration = typeof socialIntegrations.$inferSelect;

export const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  isAdmin: z.boolean(),
  isSuperAdmin: z.boolean(),
  profilePicUrl: z.string().nullable().optional(),
});

export type Participant = z.infer<typeof participantSchema>;

export const failedParticipants = pgTable("failed_participants", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFailedParticipantSchema = createInsertSchema(failedParticipants).omit({
  id: true,
  createdAt: true,
});

export type InsertFailedParticipant = z.infer<typeof insertFailedParticipantSchema>;
export type FailedParticipant = typeof failedParticipants.$inferSelect;

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  profilePicUrl: text("profile_pic_url"),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastSeen: timestamp("last_seen").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  firstSeen: true,
  lastSeen: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
