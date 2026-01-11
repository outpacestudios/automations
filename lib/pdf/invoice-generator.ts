import * as PDFDocument from "pdfkit";
import * as path from "node:path";

const PAGE = {
	width: 842,
	height: 595,
	padding: { x: 32, y: 24 },
};

const COLORS = {
	black: "#000000",
	opacity88: 0.88,
	opacity72: 0.72,
	opacity48: 0.48,
	opacity06: 0.06,
	orange: "#FF4500",
};

export interface BankDetails {
	bankName: string;
	iban: string;
	bic: string;
	bankAddress: string[];
}

export interface CompanyDetails {
	legalName: string;
	address: string[];
	email: string;
	phone?: string;
}

export interface InvoiceData {
	invoiceNumber: string;
	date: string;
	dueDate: string;
	clientName: string;
	clientEmail: string;
	clientAddress?: string[];
	lineItems: Array<{
		description: string;
		subDescription?: string;
		quantity: number;
		unitAmountCents: number;
	}>;
	totalCents: number;
	currency: string;
	company: CompanyDetails;
	bankDetails?: BankDetails;
}

function formatCurrency(cents: number, currency: string): string {
	const symbols: Record<string, string> = {
		USD: "$",
		EUR: "€",
		GBP: "£",
	};
	const symbol = symbols[currency.toUpperCase()] ?? currency;
	return `${symbol}${(cents / 100).toLocaleString("en-US", {
		minimumFractionDigits: 2,
	})}`;
}

function drawDivider(doc: PDFKit.PDFDocument, y: number): void {
	doc
		.moveTo(0, y)
		.lineTo(PAGE.width, y)
		.strokeColor(COLORS.black)
		.strokeOpacity(COLORS.opacity06)
		.lineWidth(1)
		.stroke();
	doc.strokeOpacity(1);
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		try {
			const doc = new PDFDocument({
				size: [PAGE.width, PAGE.height],
				margin: 0,
				bufferPages: true,
			});

			const chunks: Buffer[] = [];
			doc.on("data", (chunk) => chunks.push(chunk));
			doc.on("end", () => resolve(Buffer.concat(chunks)));
			doc.on("error", reject);

			const {
				invoiceNumber,
				date,
				dueDate,
				clientName,
				clientEmail,
				clientAddress = [],
				lineItems,
				totalCents,
				currency,
				company,
				bankDetails,
			} = data;

			let y = PAGE.padding.y;
			const contentWidth = PAGE.width - PAGE.padding.x * 2;
			const columnWidth = contentWidth / 4;

			// Header
			doc
				.font("Helvetica-Bold")
				.fontSize(10)
				.fillColor(COLORS.black)
				.fillOpacity(COLORS.opacity88);

			doc.text("outpacestudios.com", PAGE.padding.x, y, {
				width: contentWidth,
				align: "right",
			});

			y += 30;

			// Invoice title
			doc.font("Helvetica-Bold").fontSize(18).text("Invoice", PAGE.padding.x, y);

			y += 44;

			// Company info
			doc.font("Helvetica-Bold").fontSize(10).text(company.legalName, PAGE.padding.x, y);

			let addressY = y + 22;
			doc.font("Helvetica").fontSize(10).fillOpacity(COLORS.opacity72);
			for (const line of company.address) {
				doc.text(line, PAGE.padding.x, addressY);
				addressY += 14;
			}

			// Contact column
			doc
				.font("Helvetica-Bold")
				.fillOpacity(COLORS.opacity88)
				.text("Contact", PAGE.padding.x + columnWidth, y);
			doc
				.font("Helvetica")
				.fillOpacity(COLORS.opacity72)
				.text(company.email, PAGE.padding.x + columnWidth, y + 22);
			if (company.phone) {
				doc.text(company.phone, PAGE.padding.x + columnWidth, y + 36);
			}

			y = Math.max(addressY, y + 50) + PAGE.padding.y;

			drawDivider(doc, y);
			y += PAGE.padding.y;

			// Invoice details
			const detailsY = y;

			doc
				.font("Helvetica-Bold")
				.fillOpacity(COLORS.opacity88)
				.text("Invoice no.", PAGE.padding.x, detailsY);
			doc
				.font("Helvetica")
				.fillOpacity(COLORS.opacity72)
				.text(invoiceNumber, PAGE.padding.x, detailsY + 22);

			doc
				.font("Helvetica-Bold")
				.fillOpacity(COLORS.opacity88)
				.text("To", PAGE.padding.x + columnWidth, detailsY);
			let clientY = detailsY + 22;
			doc.font("Helvetica").fillOpacity(COLORS.opacity72).text(clientName, PAGE.padding.x + columnWidth, clientY);
			clientY += 14;
			for (const line of clientAddress) {
				doc.text(line, PAGE.padding.x + columnWidth, clientY);
				clientY += 14;
			}
			doc.text(clientEmail, PAGE.padding.x + columnWidth, clientY);

			doc
				.font("Helvetica-Bold")
				.fillOpacity(COLORS.opacity88)
				.text("Issue Date", PAGE.padding.x + columnWidth * 2, detailsY);
			doc
				.font("Helvetica")
				.fillOpacity(COLORS.opacity72)
				.text(date, PAGE.padding.x + columnWidth * 2, detailsY + 22);

			doc
				.font("Helvetica-Bold")
				.fillOpacity(COLORS.opacity88)
				.text("Due Date", PAGE.padding.x + columnWidth * 3, detailsY);
			doc
				.font("Helvetica")
				.fillOpacity(COLORS.opacity72)
				.text(dueDate, PAGE.padding.x + columnWidth * 3, detailsY + 22);

			y = Math.max(clientY, detailsY + 36) + PAGE.padding.y;

			drawDivider(doc, y);
			y += PAGE.padding.y;

			// Line items table
			const tableX = PAGE.padding.x + contentWidth / 2;
			const tableWidth = contentWidth / 2;
			const tableColWidth = tableWidth / 2;
			const tableY = y;

			doc.font("Helvetica-Bold").fillOpacity(COLORS.opacity88);
			doc.text("Description", tableX, tableY);
			doc.text("Amount", tableX + tableColWidth, tableY);

			const headerBottomY = tableY + 26;
			doc
				.moveTo(tableX, headerBottomY)
				.lineTo(tableX + tableWidth, headerBottomY)
				.strokeColor(COLORS.black)
				.strokeOpacity(COLORS.opacity06)
				.lineWidth(1)
				.stroke();
			doc.strokeOpacity(1);

			let rowY = headerBottomY + 12;

			for (const item of lineItems) {
				doc
					.font("Helvetica-Bold")
					.fillOpacity(COLORS.opacity88)
					.text(item.description, tableX, rowY);

				if (item.subDescription) {
					doc
						.font("Helvetica")
						.fontSize(9)
						.fillOpacity(COLORS.opacity72)
						.text(item.subDescription, tableX, rowY + 14);
				}

				doc
					.font("Helvetica")
					.fontSize(10)
					.fillOpacity(COLORS.opacity72)
					.text(
						formatCurrency(item.quantity * item.unitAmountCents, currency),
						tableX + tableColWidth,
						rowY
					);

				const rowHeight = item.subDescription ? 40 : 26;
				rowY += rowHeight;

				doc
					.moveTo(tableX, rowY)
					.lineTo(tableX + tableWidth, rowY)
					.strokeColor(COLORS.black)
					.strokeOpacity(COLORS.opacity06)
					.lineWidth(1)
					.stroke();
				doc.strokeOpacity(1);

				rowY += 12;
			}

			// Total
			const totalRowY = rowY + 12;
			doc
				.moveTo(tableX, totalRowY - 12)
				.lineTo(tableX + tableWidth, totalRowY - 12)
				.strokeColor(COLORS.black)
				.strokeOpacity(COLORS.opacity06)
				.lineWidth(1)
				.stroke();

			doc.font("Helvetica-Bold").fontSize(18).fillOpacity(COLORS.opacity88);
			doc.text("Total", tableX, totalRowY);
			doc
				.font("Helvetica")
				.fontSize(18)
				.fillOpacity(COLORS.opacity72)
				.text(formatCurrency(totalCents, currency), tableX + tableColWidth, totalRowY);

			// Bank details page 2
			if (bankDetails) {
				doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });

				y = PAGE.padding.y;

				doc
					.font("Helvetica")
					.fontSize(10)
					.fillOpacity(COLORS.opacity48)
					.text("outpacestudios.com", PAGE.padding.x, y, {
						width: contentWidth,
						align: "right",
					});

				y += 30;

				doc
					.font("Helvetica-Bold")
					.fontSize(18)
					.fillOpacity(COLORS.opacity88)
					.text("Payment Instructions", PAGE.padding.x, y);

				y += 44;

				drawDivider(doc, y);
				y += PAGE.padding.y;

				doc
					.font("Helvetica-Bold")
					.fontSize(10)
					.fillOpacity(COLORS.opacity88)
					.text("Bank Transfer", PAGE.padding.x, y);

				y += 30;

				const bankColWidth = contentWidth / 4;

				doc.text("Bank Name", PAGE.padding.x, y);
				doc
					.font("Helvetica")
					.fillOpacity(COLORS.opacity72)
					.text(bankDetails.bankName, PAGE.padding.x, y + 22);

				doc
					.font("Helvetica-Bold")
					.fillOpacity(COLORS.opacity88)
					.text("IBAN", PAGE.padding.x + bankColWidth, y);
				doc
					.font("Helvetica")
					.fillOpacity(COLORS.opacity72)
					.text(bankDetails.iban, PAGE.padding.x + bankColWidth, y + 22);

				doc
					.font("Helvetica-Bold")
					.fillOpacity(COLORS.opacity88)
					.text("BIC", PAGE.padding.x + bankColWidth * 2, y);
				doc
					.font("Helvetica")
					.fillOpacity(COLORS.opacity72)
					.text(bankDetails.bic, PAGE.padding.x + bankColWidth * 2, y + 22);

				doc
					.font("Helvetica-Bold")
					.fillOpacity(COLORS.opacity88)
					.text("Bank Address", PAGE.padding.x + bankColWidth * 3, y);
				let bankAddrY = y + 22;
				doc.font("Helvetica").fillOpacity(COLORS.opacity72);
				for (const line of bankDetails.bankAddress) {
					doc.text(line, PAGE.padding.x + bankColWidth * 3, bankAddrY);
					bankAddrY += 14;
				}
			}

			doc.end();
		} catch (error) {
			reject(error);
		}
	});
}
