import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  type User,
  type InsertUser,
  type Settings,
  type InsertSettings,
  type Customer,
  type InsertCustomer,
  type Message,
  type InsertMessage,
  type ContactInsight,
  type InsertContactInsight,
  type SocialIntegration,
  type InsertSocialIntegration,
  type FailedParticipant,
  type InsertFailedParticipant,
  users,
  settings,
  customers,
  messages,
  contactInsights,
  socialIntegrations,
  failedParticipants,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getSettings(): Promise<Settings | undefined>;
  saveSettings(data: InsertSettings): Promise<Settings>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  upsertCustomer(customer: InsertCustomer): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  getMessages(): Promise<Message[]>;
  getMessagesByCustomer(customerId: string): Promise<Message[]>;
  saveMessage(message: InsertMessage): Promise<Message>;

  getInsight(customerId: string): Promise<ContactInsight | undefined>;
  saveInsight(insight: InsertContactInsight): Promise<ContactInsight>;

  getSocialIntegrations(customerId: string): Promise<SocialIntegration[]>;
  saveSocialIntegration(integration: InsertSocialIntegration): Promise<SocialIntegration>;

  getFailedParticipants(customerId: string): Promise<FailedParticipant[]>;
  saveFailedParticipants(participants: InsertFailedParticipant[]): Promise<FailedParticipant[]>;
  deleteFailedParticipant(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSettings(): Promise<Settings | undefined> {
    const [result] = await db.select().from(settings).limit(1);
    return result;
  }

  async saveSettings(data: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(settings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(settings).values(data).returning();
    return created;
  }

  async getCustomers(): Promise<Customer[]> {
    return db.select().from(customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async upsertCustomer(customer: InsertCustomer): Promise<Customer> {
    const existing = await this.getCustomer(customer.id);
    if (existing) {
      const [updated] = await db
        .update(customers)
        .set(customer)
        .where(eq(customers.id, customer.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async getMessages(): Promise<Message[]> {
    return db.select().from(messages);
  }

  async getMessagesByCustomer(customerId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.customerId, customerId));
  }

  async saveMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getInsight(customerId: string): Promise<ContactInsight | undefined> {
    const [insight] = await db
      .select()
      .from(contactInsights)
      .where(eq(contactInsights.customerId, customerId));
    return insight;
  }

  async saveInsight(insight: InsertContactInsight): Promise<ContactInsight> {
    const existing = insight.customerId ? await this.getInsight(insight.customerId) : undefined;
    if (existing) {
      const [updated] = await db
        .update(contactInsights)
        .set({ ...insight, generatedAt: new Date() })
        .where(eq(contactInsights.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(contactInsights).values(insight).returning();
    return created;
  }

  async getSocialIntegrations(customerId: string): Promise<SocialIntegration[]> {
    return db
      .select()
      .from(socialIntegrations)
      .where(eq(socialIntegrations.customerId, customerId));
  }

  async saveSocialIntegration(integration: InsertSocialIntegration): Promise<SocialIntegration> {
    const [created] = await db.insert(socialIntegrations).values(integration).returning();
    return created;
  }

  async getFailedParticipants(customerId: string): Promise<FailedParticipant[]> {
    return db
      .select()
      .from(failedParticipants)
      .where(eq(failedParticipants.customerId, customerId));
  }

  async saveFailedParticipants(participants: InsertFailedParticipant[]): Promise<FailedParticipant[]> {
    if (participants.length === 0) return [];
    const created = await db.insert(failedParticipants).values(participants).returning();
    return created;
  }

  async deleteFailedParticipant(id: number): Promise<void> {
    await db.delete(failedParticipants).where(eq(failedParticipants.id, id));
  }
}

export const storage = new DatabaseStorage();
