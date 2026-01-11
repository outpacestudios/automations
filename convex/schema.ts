import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	clients: defineTable({
		name: v.string(),
		email: v.string(),
		invoicePrefix: v.string(), // 3-char prefix, e.g., "FRI"
		nextInvoiceNumber: v.number(),
		slackChannelId: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_prefix", ["invoicePrefix"])
		.index("by_email", ["email"]),

	invoices: defineTable({
		clientId: v.id("clients"),
		invoiceNumber: v.string(), // e.g., "FRI-AE-0001"
		billingType: v.union(v.literal("retainer"), v.literal("sprint")),
		retainerDuration: v.optional(
			v.union(
				v.literal("4_weeks"),
				v.literal("monthly"),
				v.literal("custom")
			)
		),
		customDurationDays: v.optional(v.number()),
		periodStart: v.number(), // timestamp
		periodEnd: v.number(), // timestamp
		amountCents: v.number(),
		currency: v.string(),
		status: v.union(
			v.literal("draft"),
			v.literal("pending_approval"),
			v.literal("sent"),
			v.literal("paid"),
			v.literal("void")
		),
		lineItems: v.array(
			v.object({
				description: v.string(),
				quantity: v.number(),
				unitAmountCents: v.number(),
			})
		),
		customOptions: v.optional(v.any()),
		pdfUrl: v.optional(v.string()),
		pdfStorageId: v.optional(v.id("_storage")),
		createdAt: v.number(),
		sentAt: v.optional(v.number()),
		paidAt: v.optional(v.number()),
	})
		.index("by_client", ["clientId"])
		.index("by_status", ["status"])
		.index("by_invoice_number", ["invoiceNumber"]),

	settings: defineTable({
		key: v.string(),
		value: v.any(),
	}).index("by_key", ["key"]),

	invoiceTokens: defineTable({
		token: v.string(), // 32-char random alphanumeric
		invoiceId: v.id("invoices"),
		expiresAt: v.number(), // Timestamp (24 hours from creation)
		createdAt: v.number(),
		usedAt: v.optional(v.number()), // Track first access
	})
		.index("by_token", ["token"])
		.index("by_invoice", ["invoiceId"])
		.index("by_expires", ["expiresAt"]),
});
