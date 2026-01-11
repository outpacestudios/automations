import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const setting = await ctx.db
			.query("settings")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();
		return setting?.value;
	},
});

export const getAll = query({
	args: {},
	handler: async (ctx) => {
		const settings = await ctx.db.query("settings").collect();
		return Object.fromEntries(settings.map((s) => [s.key, s.value]));
	},
});

export const set = mutation({
	args: {
		key: v.string(),
		value: v.any(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("settings")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		if (existing) {
			return await ctx.db.patch(existing._id, { value: args.value });
		} else {
			return await ctx.db.insert("settings", {
				key: args.key,
				value: args.value,
			});
		}
	},
});

export const remove = mutation({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const setting = await ctx.db
			.query("settings")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		if (setting) {
			await ctx.db.delete(setting._id);
		}
	},
});

// Convenience mutations for common settings
export const setCompanyInfo = mutation({
	args: {
		companyName: v.string(),
		companyAddress: v.array(v.string()),
		bankDetails: v.object({
			bankName: v.string(),
			accountName: v.string(),
			iban: v.string(),
			bic: v.string(),
		}),
	},
	handler: async (ctx, args) => {
		await ctx.runMutation(set, { key: "companyName", value: args.companyName });
		await ctx.runMutation(set, { key: "companyAddress", value: args.companyAddress });
		await ctx.runMutation(set, { key: "bankDetails", value: args.bankDetails });
	},
});

export const setSlackConfig = mutation({
	args: {
		webhookUrl: v.string(),
		defaultChannelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.runMutation(set, { key: "slackWebhookUrl", value: args.webhookUrl });
		if (args.defaultChannelId) {
			await ctx.runMutation(set, { key: "slackDefaultChannelId", value: args.defaultChannelId });
		}
	},
});

export const setGoogleDriveConfig = mutation({
	args: {
		folderId: v.string(),
		serviceAccountEmail: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.runMutation(set, { key: "googleDriveFolderId", value: args.folderId });
		if (args.serviceAccountEmail) {
			await ctx.runMutation(set, { key: "googleServiceAccountEmail", value: args.serviceAccountEmail });
		}
	},
});
