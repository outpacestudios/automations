import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Mutation to create a client with a specific nextInvoiceNumber (for seeding)
export const createClientWithNumber = mutation({
	args: {
		name: v.string(),
		email: v.string(),
		invoicePrefix: v.string(),
		nextInvoiceNumber: v.number(),
		slackChannelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("clients", {
			name: args.name,
			email: args.email,
			invoicePrefix: args.invoicePrefix.toUpperCase().slice(0, 3),
			nextInvoiceNumber: args.nextInvoiceNumber,
			slackChannelId: args.slackChannelId,
			createdAt: now,
			updatedAt: now,
		});
	},
});

// Mutation to import an invoice with an existing invoice number (for seeding)
export const importInvoice = mutation({
	args: {
		clientId: v.id("clients"),
		invoiceNumber: v.string(),
		billingType: v.union(v.literal("retainer"), v.literal("sprint")),
		retainerDuration: v.optional(
			v.union(
				v.literal("4_weeks"),
				v.literal("monthly"),
				v.literal("custom")
			)
		),
		customDurationDays: v.optional(v.number()),
		periodStart: v.number(),
		periodEnd: v.number(),
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
		pdfUrl: v.optional(v.string()),
		createdAt: v.optional(v.number()),
		sentAt: v.optional(v.number()),
		paidAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("invoices", {
			clientId: args.clientId,
			invoiceNumber: args.invoiceNumber,
			billingType: args.billingType,
			retainerDuration: args.retainerDuration,
			customDurationDays: args.customDurationDays,
			periodStart: args.periodStart,
			periodEnd: args.periodEnd,
			amountCents: args.amountCents,
			currency: args.currency,
			status: args.status,
			lineItems: args.lineItems,
			pdfUrl: args.pdfUrl,
			createdAt: args.createdAt ?? now,
			sentAt: args.sentAt,
			paidAt: args.paidAt,
		});
	},
});

// Clear all data (for testing)
export const clearAll = mutation({
	args: {},
	handler: async (ctx) => {
		const clients = await ctx.db.query("clients").collect();
		const invoices = await ctx.db.query("invoices").collect();

		for (const invoice of invoices) {
			await ctx.db.delete(invoice._id);
		}
		for (const client of clients) {
			await ctx.db.delete(client._id);
		}

		return { deletedClients: clients.length, deletedInvoices: invoices.length };
	},
});
