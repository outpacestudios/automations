import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Token expiry time: 24 hours
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Generate a random 32-character alphanumeric token
function generateRandomToken(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let token = "";
	for (let i = 0; i < 32; i++) {
		token += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return token;
}

// Generate a new token for an invoice
export const generate = mutation({
	args: {
		invoiceId: v.id("invoices"),
	},
	handler: async (ctx, args) => {
		// Verify invoice exists
		const invoice = await ctx.db.get(args.invoiceId);
		if (!invoice) {
			throw new Error("Invoice not found");
		}

		// Generate unique token
		let token = generateRandomToken();
		let existing = await ctx.db
			.query("invoiceTokens")
			.withIndex("by_token", (q) => q.eq("token", token))
			.first();

		// Regenerate if collision (extremely rare)
		while (existing) {
			token = generateRandomToken();
			existing = await ctx.db
				.query("invoiceTokens")
				.withIndex("by_token", (q) => q.eq("token", token))
				.first();
		}

		const now = Date.now();
		const tokenId = await ctx.db.insert("invoiceTokens", {
			token,
			invoiceId: args.invoiceId,
			expiresAt: now + TOKEN_EXPIRY_MS,
			createdAt: now,
		});

		return { token, tokenId };
	},
});

// Validate a token and return the invoice ID if valid
export const validate = query({
	args: {
		token: v.string(),
	},
	handler: async (ctx, args) => {
		const tokenRecord = await ctx.db
			.query("invoiceTokens")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.first();

		if (!tokenRecord) {
			return { valid: false, error: "Token not found" };
		}

		if (tokenRecord.expiresAt < Date.now()) {
			return { valid: false, error: "Token expired" };
		}

		return {
			valid: true,
			invoiceId: tokenRecord.invoiceId,
			tokenId: tokenRecord._id,
		};
	},
});

// Mark token as used (call after successful PDF access)
export const markUsed = mutation({
	args: {
		tokenId: v.id("invoiceTokens"),
	},
	handler: async (ctx, args) => {
		const token = await ctx.db.get(args.tokenId);
		if (!token) {
			throw new Error("Token not found");
		}

		// Only mark if not already used
		if (!token.usedAt) {
			await ctx.db.patch(args.tokenId, { usedAt: Date.now() });
		}
	},
});

// Get token by invoice ID (for checking if token already exists)
export const getByInvoice = query({
	args: {
		invoiceId: v.id("invoices"),
	},
	handler: async (ctx, args) => {
		const tokens = await ctx.db
			.query("invoiceTokens")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
			.collect();

		// Return the most recent valid token
		const now = Date.now();
		const validTokens = tokens.filter((t) => t.expiresAt > now);
		if (validTokens.length === 0) {
			return null;
		}

		// Sort by creation time, return newest
		validTokens.sort((a, b) => b.createdAt - a.createdAt);
		return validTokens[0];
	},
});

// Cleanup expired tokens (should be called by cron job)
export const cleanupExpired = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const expiredTokens = await ctx.db
			.query("invoiceTokens")
			.withIndex("by_expires")
			.filter((q) => q.lt(q.field("expiresAt"), now))
			.collect();

		let deleted = 0;
		for (const token of expiredTokens) {
			await ctx.db.delete(token._id);
			deleted++;
		}

		return { deleted };
	},
});

// Delete all tokens for an invoice (for cleanup when invoice is deleted/voided)
export const deleteForInvoice = mutation({
	args: {
		invoiceId: v.id("invoices"),
	},
	handler: async (ctx, args) => {
		const tokens = await ctx.db
			.query("invoiceTokens")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
			.collect();

		for (const token of tokens) {
			await ctx.db.delete(token._id);
		}

		return { deleted: tokens.length };
	},
});
