import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("clients").collect();
	},
});

export const get = query({
	args: { id: v.id("clients") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const getByPrefix = query({
	args: { prefix: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("clients")
			.withIndex("by_prefix", (q) => q.eq("invoicePrefix", args.prefix))
			.first();
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		email: v.string(),
		invoicePrefix: v.string(),
		slackChannelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("clients", {
			name: args.name,
			email: args.email,
			invoicePrefix: args.invoicePrefix.toUpperCase().slice(0, 3),
			nextInvoiceNumber: 1,
			slackChannelId: args.slackChannelId,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("clients"),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		slackChannelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args;
		const filtered = Object.fromEntries(
			Object.entries(updates).filter(([_, v]) => v !== undefined)
		);
		return await ctx.db.patch(id, {
			...filtered,
			updatedAt: Date.now(),
		});
	},
});

export const incrementInvoiceNumber = mutation({
	args: { id: v.id("clients") },
	handler: async (ctx, args) => {
		const client = await ctx.db.get(args.id);
		if (!client) throw new Error("Client not found");

		await ctx.db.patch(args.id, {
			nextInvoiceNumber: client.nextInvoiceNumber + 1,
			updatedAt: Date.now(),
		});

		return client.nextInvoiceNumber;
	},
});
