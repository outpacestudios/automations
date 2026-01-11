import { v } from "convex/values";
import { mutation, internalQuery } from "./_generated/server";

// Generate upload URL for client-side uploads
export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		return await ctx.storage.generateUploadUrl();
	},
});

// Store a file and return its storage ID
export const storeFile = mutation({
	args: {
		storageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		// Verify the file exists
		const url = await ctx.storage.getUrl(args.storageId);
		if (!url) {
			throw new Error("File not found in storage");
		}
		return args.storageId;
	},
});

// Get URL for a stored file (internal only - use token-protected HTTP endpoint for external access)
export const getUrl = internalQuery({
	args: {
		storageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		return await ctx.storage.getUrl(args.storageId);
	},
});

// Delete a file from storage
export const deleteFile = mutation({
	args: {
		storageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		await ctx.storage.delete(args.storageId);
	},
});

// Update invoice with PDF storage ID
export const setInvoicePdf = mutation({
	args: {
		invoiceId: v.id("invoices"),
		storageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		const url = await ctx.storage.getUrl(args.storageId);
		if (!url) {
			throw new Error("File not found in storage");
		}

		await ctx.db.patch(args.invoiceId, {
			pdfStorageId: args.storageId,
			pdfUrl: url,
		});

		return url;
	},
});

// Get invoice PDF URL (internal only - use token-protected HTTP endpoint for external access)
export const getInvoicePdfUrl = internalQuery({
	args: {
		invoiceId: v.id("invoices"),
	},
	handler: async (ctx, args) => {
		const invoice = await ctx.db.get(args.invoiceId);
		if (!invoice?.pdfStorageId) {
			return null;
		}
		return await ctx.storage.getUrl(invoice.pdfStorageId);
	},
});
