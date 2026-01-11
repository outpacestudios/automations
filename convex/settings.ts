import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";

// Helper function for setting a value (used by convenience mutations)
async function setSetting(
	ctx: MutationCtx,
	key: string,
	value: unknown
): Promise<void> {
	const existing = await ctx.db
		.query("settings")
		.withIndex("by_key", (q) => q.eq("key", key))
		.first();

	if (existing) {
		await ctx.db.patch(existing._id, { value });
	} else {
		await ctx.db.insert("settings", { key, value });
	}
}

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
		await setSetting(ctx, args.key, args.value);
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
		await setSetting(ctx, "companyName", args.companyName);
		await setSetting(ctx, "companyAddress", args.companyAddress);
		await setSetting(ctx, "bankDetails", args.bankDetails);
	},
});

export const setSlackConfig = mutation({
	args: {
		webhookUrl: v.string(),
		defaultChannelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await setSetting(ctx, "slackWebhookUrl", args.webhookUrl);
		if (args.defaultChannelId) {
			await setSetting(ctx, "slackDefaultChannelId", args.defaultChannelId);
		}
	},
});

export const setGoogleDriveConfig = mutation({
	args: {
		folderId: v.string(),
		serviceAccountEmail: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await setSetting(ctx, "googleDriveFolderId", args.folderId);
		if (args.serviceAccountEmail) {
			await setSetting(ctx, "googleServiceAccountEmail", args.serviceAccountEmail);
		}
	},
});
