/**
 * Add new invoices to the database
 * Run with: npx tsx scripts/add-new-invoices.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

const CONVEX_URL = "https://different-leopard-356.convex.cloud";
const INVOICES_DIR = "/tmp/invoices";

// New clients to add
const newClients = [
	{
		prefix: "LNK",
		name: "Linktree", // placeholder - update with actual name
		email: "invoices@linktr.ee", // placeholder
		invoiceCount: 1,
	},
	{
		prefix: "IVR",
		name: "Ivory", // placeholder - update with actual name
		email: "invoices@ivory.app", // placeholder
		invoiceCount: 1,
	},
];

// New invoices to add (for existing and new clients)
const newInvoices = [
	{
		prefix: "ESP",
		number: 4,
		amountCents: 800000,
		currency: "USD",
		billingType: "retainer" as const,
		retainerDuration: "4_weeks" as const,
		description: "Marathon Plan - 4 Weeks",
		periodStart: "2024-12-24",
		periodEnd: "2025-01-20",
	},
	{
		prefix: "CRW",
		number: 3,
		amountCents: 250000,
		currency: "USD",
		billingType: "sprint" as const,
		description: "Sprint Plan",
		periodStart: "2024-11-29",
		periodEnd: "2024-12-12",
	},
	{
		prefix: "BLM",
		number: 2,
		amountCents: 800000,
		currency: "USD",
		billingType: "retainer" as const,
		retainerDuration: "4_weeks" as const,
		description: "Marathon Plan - 4 Weeks",
		periodStart: "2024-11-29",
		periodEnd: "2024-12-26",
	},
	{
		prefix: "LNK",
		number: 1,
		amountCents: 800000, // placeholder
		currency: "USD",
		billingType: "retainer" as const,
		retainerDuration: "4_weeks" as const,
		description: "Marathon Plan - 4 Weeks",
		periodStart: "2024-12-01",
		periodEnd: "2024-12-28",
	},
	{
		prefix: "IVR",
		number: 1,
		amountCents: 800000, // placeholder
		currency: "USD",
		billingType: "retainer" as const,
		retainerDuration: "4_weeks" as const,
		description: "Marathon Plan - 4 Weeks",
		periodStart: "2024-12-01",
		periodEnd: "2024-12-28",
	},
];

function parseDate(dateStr: string): number {
	return new Date(dateStr).getTime();
}

async function uploadPdf(
	client: ConvexHttpClient,
	filePath: string
): Promise<string | null> {
	try {
		const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
		const fileBuffer = fs.readFileSync(filePath);
		const blob = new Blob([fileBuffer], { type: "application/pdf" });

		const response = await fetch(uploadUrl, {
			method: "POST",
			headers: { "Content-Type": "application/pdf" },
			body: blob,
		});

		if (!response.ok) {
			console.error(`Failed to upload ${filePath}: ${response.statusText}`);
			return null;
		}

		const { storageId } = await response.json();
		return storageId;
	} catch (error) {
		console.error(`Error uploading ${filePath}:`, error);
		return null;
	}
}

async function main() {
	const client = new ConvexHttpClient(CONVEX_URL);

	// Get existing clients
	const existingClients = await client.query(api.clients.list, {});
	const clientsByPrefix: Record<string, any> = {};
	for (const c of existingClients) {
		clientsByPrefix[c.invoicePrefix] = c;
	}

	console.log("👥 Adding new clients...");
	for (const clientData of newClients) {
		if (clientsByPrefix[clientData.prefix]) {
			console.log(`   ⏭️  ${clientData.prefix} already exists`);
			continue;
		}

		const clientId = await client.mutation(api.seed.createClientWithNumber, {
			name: clientData.name,
			email: clientData.email,
			invoicePrefix: clientData.prefix,
			nextInvoiceNumber: clientData.invoiceCount + 1,
		});
		clientsByPrefix[clientData.prefix] = { _id: clientId, invoicePrefix: clientData.prefix };
		console.log(`   ✅ Created ${clientData.prefix}: ${clientData.name}`);
	}

	// Check existing invoices
	const existingInvoices = await client.query(api.invoices.list, {});
	const existingInvoiceNumbers = new Set(existingInvoices.map((i: any) => i.invoiceNumber));

	console.log("\n📄 Adding new invoices...");
	for (const invoice of newInvoices) {
		const invoiceNumber = `${invoice.prefix}-AE-${String(invoice.number).padStart(4, "0")}`;

		if (existingInvoiceNumbers.has(invoiceNumber)) {
			console.log(`   ⏭️  ${invoiceNumber} already exists`);
			continue;
		}

		const clientRecord = clientsByPrefix[invoice.prefix];
		if (!clientRecord) {
			console.error(`   ❌ No client for prefix ${invoice.prefix}`);
			continue;
		}

		// Find PDF file
		const pdfDir = path.join(INVOICES_DIR, invoice.prefix);
		let pdfPath: string | null = null;

		if (fs.existsSync(pdfDir)) {
			const files = fs.readdirSync(pdfDir);
			const pdfFile = files.find((f) => f.includes(invoiceNumber));
			if (pdfFile) {
				pdfPath = path.join(pdfDir, pdfFile);
			}
		}

		// Upload PDF if exists
		let storageId: string | null = null;
		if (pdfPath && fs.existsSync(pdfPath)) {
			storageId = await uploadPdf(client, pdfPath);
			if (storageId) {
				console.log(`   📎 Uploaded ${path.basename(pdfPath)}`);
			}
		}

		// Create invoice
		const invoiceId = await client.mutation(api.seed.importInvoice, {
			clientId: clientRecord._id,
			invoiceNumber,
			billingType: invoice.billingType,
			retainerDuration: invoice.retainerDuration,
			periodStart: parseDate(invoice.periodStart),
			periodEnd: parseDate(invoice.periodEnd),
			amountCents: invoice.amountCents,
			currency: invoice.currency,
			status: "paid",
			lineItems: [
				{
					description: invoice.description,
					quantity: 1,
					unitAmountCents: invoice.amountCents,
				},
			],
			paidAt: parseDate(invoice.periodEnd),
		});

		// Link PDF to invoice
		if (storageId) {
			await client.mutation(api.files.setInvoicePdf, {
				invoiceId: invoiceId as any,
				storageId: storageId as any,
			});
		}

		// Update client's nextInvoiceNumber
		const newNextNumber = invoice.number + 1;
		if (!clientRecord.nextInvoiceNumber || newNextNumber > clientRecord.nextInvoiceNumber) {
			await client.mutation(api.clients.update, {
				id: clientRecord._id,
			});
		}

		console.log(`   ✅ ${invoiceNumber} - $${(invoice.amountCents / 100).toLocaleString()}`);
	}

	console.log("\n✨ Update complete!");

	// Print summary
	const allClients = await client.query(api.clients.list, {});
	const allInvoices = await client.query(api.invoices.list, {});
	console.log(`\n📊 Summary: ${allClients.length} clients, ${allInvoices.length} invoices`);
}

main().catch(console.error);
