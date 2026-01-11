/**
 * Seed script to populate the database with clients and invoices from Google Drive PDFs
 * Run with: npx tsx scripts/seed-database.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

const CONVEX_URL = "https://different-leopard-356.convex.cloud";
const INVOICES_DIR = "/tmp/invoices";

// Client data extracted from invoice PDFs
const clients = [
	{
		prefix: "CLX",
		name: "Celebratix B.V.",
		email: "payme@celebratix.io",
		invoiceCount: 4,
	},
	{
		prefix: "HVN",
		name: "Keigan Miller",
		email: "keigan@havenyeg.com",
		invoiceCount: 4,
	},
	{
		prefix: "ADJ",
		name: "Gauss Capital AG",
		email: "fiebig@gauss.ag",
		invoiceCount: 3,
	},
	{
		prefix: "ESP",
		name: "Translucence Research Inc",
		email: "averi@espressosys.com",
		invoiceCount: 3,
	},
	{
		prefix: "FRT",
		name: "Fortune App Inc.",
		email: "leo@fortune.app",
		invoiceCount: 2,
	},
	{
		prefix: "AUR",
		name: "Zach Pogrob",
		email: "zach@shareaura.app",
		invoiceCount: 1,
	},
	{
		prefix: "BLM",
		name: "BLOOM SOFTWARE SRL",
		email: "bloomtgbot@gmail.com",
		invoiceCount: 1,
	},
	{
		prefix: "CRW",
		name: "Daniel Bitton",
		email: "danvslbusiness@gmail.com",
		invoiceCount: 2,
	},
	{
		prefix: "GRV",
		name: "IRIS INC.",
		email: "zach@grv.dev", // placeholder
		invoiceCount: 1,
	},
	{
		prefix: "COD",
		name: "Sarup Banskota",
		email: "sarup@codecrafters.io",
		invoiceCount: 1,
	},
	{
		prefix: "PRV",
		name: "Provable",
		email: "invoices@provable.com",
		invoiceCount: 3,
	},
	{
		prefix: "MRK",
		name: "Mark Vassilevskiy",
		email: "markknd1991@gmail.com",
		invoiceCount: 1,
	},
];

// Invoice data (amounts and periods from PDFs)
const invoiceData: Record<
	string,
	Array<{
		number: number;
		amountCents: number;
		currency: string;
		billingType: "retainer" | "sprint";
		retainerDuration?: "4_weeks" | "monthly";
		description: string;
		periodStart: string; // YYYY-MM-DD
		periodEnd: string;
	}>
> = {
	CLX: [
		{
			number: 1,
			amountCents: 1040000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "monthly",
			description: "Marathon Plan - Monthly",
			periodStart: "2024-09-01",
			periodEnd: "2024-09-30",
		},
		{
			number: 2,
			amountCents: 1040000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "monthly",
			description: "Marathon Plan - Monthly",
			periodStart: "2024-10-01",
			periodEnd: "2024-10-31",
		},
		{
			number: 3,
			amountCents: 1040000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "monthly",
			description: "Marathon Plan - Monthly",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-30",
		},
		{
			number: 4,
			amountCents: 1040000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "monthly",
			description: "Marathon Plan - Monthly",
			periodStart: "2024-12-01",
			periodEnd: "2024-12-31",
		},
	],
	HVN: [
		{
			number: 1,
			amountCents: 804000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-09-01",
			periodEnd: "2024-09-28",
		},
		{
			number: 2,
			amountCents: 804000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-09-29",
			periodEnd: "2024-10-26",
		},
		{
			number: 3,
			amountCents: 804000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-27",
			periodEnd: "2024-11-23",
		},
		{
			number: 4,
			amountCents: 804000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-24",
			periodEnd: "2024-12-21",
		},
	],
	ADJ: [
		{
			number: 1,
			amountCents: 450000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-01",
			periodEnd: "2024-10-28",
		},
		{
			number: 2,
			amountCents: 450000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-29",
			periodEnd: "2024-11-25",
		},
		{
			number: 3,
			amountCents: 450000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-26",
			periodEnd: "2024-12-23",
		},
	],
	ESP: [
		{
			number: 1,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-01",
			periodEnd: "2024-10-28",
		},
		{
			number: 2,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-29",
			periodEnd: "2024-11-25",
		},
		{
			number: 3,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-26",
			periodEnd: "2024-12-23",
		},
	],
	FRT: [
		{
			number: 1,
			amountCents: 400000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-28",
		},
		{
			number: 2,
			amountCents: 400000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-29",
			periodEnd: "2024-12-26",
		},
	],
	AUR: [
		{
			number: 1,
			amountCents: 400000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-28",
		},
	],
	BLM: [
		{
			number: 1,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-28",
		},
	],
	CRW: [
		{
			number: 1,
			amountCents: 250000,
			currency: "USD",
			billingType: "sprint",
			description: "Sprint Plan",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-14",
		},
		{
			number: 2,
			amountCents: 250000,
			currency: "USD",
			billingType: "sprint",
			description: "Sprint Plan",
			periodStart: "2024-11-15",
			periodEnd: "2024-11-28",
		},
	],
	GRV: [
		{
			number: 1,
			amountCents: 1200000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "monthly",
			description: "Marathon Plan - Monthly",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-30",
		},
	],
	COD: [
		{
			number: 1,
			amountCents: 1600000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "monthly",
			description: "Marathon Plan - Monthly",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-30",
		},
	],
	PRV: [
		{
			number: 1,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-01",
			periodEnd: "2024-10-28",
		},
		{
			number: 2,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-10-29",
			periodEnd: "2024-11-25",
		},
		{
			number: 3,
			amountCents: 800000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-26",
			periodEnd: "2024-12-23",
		},
	],
	MRK: [
		{
			number: 1,
			amountCents: 450000,
			currency: "USD",
			billingType: "retainer",
			retainerDuration: "4_weeks",
			description: "Marathon Plan - 4 Weeks",
			periodStart: "2024-11-01",
			periodEnd: "2024-11-28",
		},
	],
};

function parseDate(dateStr: string): number {
	return new Date(dateStr).getTime();
}

async function uploadPdf(
	client: ConvexHttpClient,
	filePath: string
): Promise<string | null> {
	try {
		// Get upload URL
		const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});

		// Read file
		const fileBuffer = fs.readFileSync(filePath);
		const blob = new Blob([fileBuffer], { type: "application/pdf" });

		// Upload file
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

	console.log("🧹 Clearing existing data...");
	try {
		const result = await client.mutation(api.seed.clearAll, {});
		console.log(
			`   Deleted ${result.deletedClients} clients and ${result.deletedInvoices} invoices`
		);
	} catch {
		console.log("   No existing data to clear");
	}

	console.log("\n👥 Creating clients...");
	const clientIds: Record<string, string> = {};

	for (const clientData of clients) {
		const clientId = await client.mutation(api.seed.createClientWithNumber, {
			name: clientData.name,
			email: clientData.email,
			invoicePrefix: clientData.prefix,
			nextInvoiceNumber: clientData.invoiceCount + 1,
		});
		clientIds[clientData.prefix] = clientId;
		console.log(
			`   Created ${clientData.prefix}: ${clientData.name} (next: ${clientData.invoiceCount + 1})`
		);
	}

	console.log("\n📄 Creating invoices and uploading PDFs...");

	for (const [prefix, invoices] of Object.entries(invoiceData)) {
		const clientId = clientIds[prefix];
		if (!clientId) {
			console.error(`   ❌ No client ID for prefix ${prefix}`);
			continue;
		}

		for (const invoice of invoices) {
			const invoiceNumber = `${prefix}-AE-${String(invoice.number).padStart(4, "0")}`;

			// Find PDF file
			const pdfDir = path.join(INVOICES_DIR, prefix);
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
				clientId: clientId as any,
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

			console.log(`   ✅ ${invoiceNumber} - $${(invoice.amountCents / 100).toLocaleString()}`);
		}
	}

	console.log("\n✨ Seed complete!");

	// Print summary
	const allClients = await client.query(api.clients.list, {});
	const allInvoices = await client.query(api.invoices.list, {});
	console.log(`\n📊 Summary: ${allClients.length} clients, ${allInvoices.length} invoices`);
}

main().catch(console.error);
