import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: {
		status: v.optional(
			v.union(
				v.literal("draft"),
				v.literal("pending_approval"),
				v.literal("sent"),
				v.literal("paid"),
				v.literal("void")
			)
		),
		clientId: v.optional(v.id("clients")),
	},
	handler: async (ctx, args) => {
		let q = ctx.db.query("invoices");

		if (args.status) {
			q = q.withIndex("by_status", (q) => q.eq("status", args.status!));
		} else if (args.clientId) {
			q = q.withIndex("by_client", (q) => q.eq("clientId", args.clientId!));
		}

		return await q.collect();
	},
});

export const get = query({
	args: { id: v.id("invoices") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const getByNumber = query({
	args: { invoiceNumber: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("invoices")
			.withIndex("by_invoice_number", (q) =>
				q.eq("invoiceNumber", args.invoiceNumber)
			)
			.first();
	},
});

export const create = mutation({
	args: {
		clientId: v.id("clients"),
		billingType: v.union(v.literal("retainer"), v.literal("sprint")),
		retainerDuration: v.optional(
			v.union(v.literal("4_weeks"), v.literal("monthly"), v.literal("custom"))
		),
		customDurationDays: v.optional(v.number()),
		periodStart: v.number(),
		periodEnd: v.number(),
		amountCents: v.number(),
		currency: v.string(),
		lineItems: v.array(
			v.object({
				description: v.string(),
				quantity: v.number(),
				unitAmountCents: v.number(),
			})
		),
		customOptions: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const client = await ctx.db.get(args.clientId);
		if (!client) throw new Error("Client not found");

		// Generate invoice number: PREFIX-AE-XXXX
		const invoiceNumber = `${client.invoicePrefix}-AE-${String(client.nextInvoiceNumber).padStart(4, "0")}`;

		// Increment client's next invoice number
		await ctx.db.patch(args.clientId, {
			nextInvoiceNumber: client.nextInvoiceNumber + 1,
			updatedAt: Date.now(),
		});

		const now = Date.now();
		return await ctx.db.insert("invoices", {
			clientId: args.clientId,
			invoiceNumber,
			billingType: args.billingType,
			retainerDuration: args.retainerDuration,
			customDurationDays: args.customDurationDays,
			periodStart: args.periodStart,
			periodEnd: args.periodEnd,
			amountCents: args.amountCents,
			currency: args.currency,
			status: "draft",
			lineItems: args.lineItems,
			customOptions: args.customOptions,
			createdAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("invoices"),
		amountCents: v.optional(v.number()),
		lineItems: v.optional(
			v.array(
				v.object({
					description: v.string(),
					quantity: v.number(),
					unitAmountCents: v.number(),
				})
			)
		),
		customOptions: v.optional(v.any()),
		periodStart: v.optional(v.number()),
		periodEnd: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args;
		const filtered = Object.fromEntries(
			Object.entries(updates).filter(([_, v]) => v !== undefined)
		);
		return await ctx.db.patch(id, filtered);
	},
});

export const updateStatus = mutation({
	args: {
		id: v.id("invoices"),
		status: v.union(
			v.literal("draft"),
			v.literal("pending_approval"),
			v.literal("sent"),
			v.literal("paid"),
			v.literal("void")
		),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = { status: args.status };

		if (args.status === "sent") {
			updates.sentAt = Date.now();
		} else if (args.status === "paid") {
			updates.paidAt = Date.now();
		}

		return await ctx.db.patch(args.id, updates);
	},
});

export const setPdfUrl = mutation({
	args: {
		id: v.id("invoices"),
		pdfUrl: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.patch(args.id, { pdfUrl: args.pdfUrl });
	},
});

export const getPending = query({
	args: {},
	handler: async (ctx) => {
		const pending = await ctx.db
			.query("invoices")
			.withIndex("by_status", (q) => q.eq("status", "pending_approval"))
			.collect();

		const drafts = await ctx.db
			.query("invoices")
			.withIndex("by_status", (q) => q.eq("status", "draft"))
			.collect();

		return [...drafts, ...pending];
	},
});
