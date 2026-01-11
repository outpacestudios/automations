import path from "node:path";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";

// Page dimensions (A4 landscape in points: 842 x 595)
const PAGE = {
  width: 842,
  height: 595,
  padding: { x: 32, y: 24 },
};

// Colors - using opacity for accurate rgba rendering
const COLORS = {
  black: "#000000",
  opacity88: 0.88, // rgba(0,0,0,0.88) - labels
  opacity72: 0.72, // rgba(0,0,0,0.72) - values
  opacity48: 0.48, // rgba(0,0,0,0.48) - muted text
  opacity06: 0.06, // rgba(0,0,0,0.06) - dividers
  orange: "#FF4500",
};

// Typography
const FONTS = {
  regular: "InterDisplay-Regular",
  medium: "InterDisplay-Medium",
  semibold: "InterDisplay-SemiBold",
  bold: "InterDisplay-Bold",
};

export interface BankDetails {
  bankName: string;
  iban: string;
  swiftCode: string;
  bankAddress: string[];
}

export interface CryptoDetails {
  network: string;
  address: string;
}

export interface CompanyDetails {
  legalName: string;
  address: string[];
  email: string;
  phone: string;
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
  // Required company details (from settings)
  company: CompanyDetails;
  // Optional payment details - at least one should be provided
  bankDetails?: BankDetails;
  cryptoDetails?: CryptoDetails;
  /** Payment processing fee in cents (added for Stripe payments) */
  processingFeeCents?: number;
  /** Processing fee percentage (for display) */
  processingFeePercent?: number;
}

function formatCurrency(cents: number, currency: string): string {
  const symbol = currency.toUpperCase() === "USD" ? "$" : currency;
  return `${symbol}${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}`;
}

function registerFonts(doc: PDFKit.PDFDocument): void {
  const fontPath = path.join(process.cwd(), "public/fonts");

  doc.registerFont(FONTS.regular, `${fontPath}/InterDisplay-Regular.ttf`);
  doc.registerFont(FONTS.medium, `${fontPath}/InterDisplay-Medium.ttf`);
  doc.registerFont(FONTS.semibold, `${fontPath}/InterDisplay-SemiBold.ttf`);
  doc.registerFont(FONTS.bold, `${fontPath}/InterDisplay-Bold.ttf`);
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number): void {
  // Outpace logo - using solid orange (PDFKit doesn't support gradients)
  const logoColor = "#FF4500";
  doc.save();

  // First shape - pill/rounded rectangle on left
  doc
    .path(
      `M${x + 15.0588} ${y + 5.64706}` +
        `C${x + 15.0588} ${y + 8.76609} ${x + 12.5308} ${y + 11.2941} ${x + 9.41174} ${y + 11.2941}` +
        `H${x + 5.64706}` +
        `C${x + 2.52863} ${y + 11.2941} ${x} ${y + 8.76609} ${x} ${y + 5.64706}` +
        `C${x} ${y + 2.528} ${x + 2.52863} ${y} ${x + 5.64706} ${y}` +
        `H${x + 9.41174}` +
        `C${x + 12.5308} ${y} ${x + 15.0588} ${y + 2.52863} ${x + 15.0588} ${y + 5.64706}Z`,
    )
    .fillColor(logoColor)
    .fill();

  // Second shape - top right curved shape
  doc
    .path(
      `M${x + 30.1174} ${y + 2.82353}` +
        `C${x + 30.1174} ${y + 4.38274} ${x + 28.8531} ${y + 5.64706} ${x + 27.2939} ${y + 5.64706}` +
        `H${x + 20.7056}` +
        `C${x + 17.5872} ${y + 5.64706} ${x + 15.0586} ${y + 3.11906} ${x + 15.0586} ${y}` +
        `H${x + 27.2939}` +
        `C${x + 28.8531} ${y} ${x + 30.1174} ${y + 1.26431} ${x + 30.1174} ${y + 2.82353}Z`,
    )
    .fillColor(logoColor)
    .fill();

  // Third shape - bottom right curved shape
  doc
    .path(
      `M${x + 24.4703} ${y + 8.47061}` +
        `C${x + 24.4703} ${y + 10.0298} ${x + 23.206} ${y + 11.2941} ${x + 21.6468} ${y + 11.2941}` +
        `H${x + 15.0586}` +
        `C${x + 15.0586} ${y + 8.17569} ${x + 17.5872} ${y + 5.64706} ${x + 20.7056} ${y + 5.64706}` +
        `H${x + 21.6468}` +
        `C${x + 22.4217} ${y + 5.64706} ${x + 23.1226} ${y + 5.9589} ${x + 23.6334} ${y + 6.464}` +
        `C${x + 24.1497} ${y + 6.97597} ${x + 24.4703} ${y + 7.6863} ${x + 24.4703} ${y + 8.47061}Z`,
    )
    .fillColor(logoColor)
    .fill();

  doc.restore();
}

function drawDivider(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .moveTo(0, y)
    .lineTo(PAGE.width, y)
    .strokeColor(COLORS.black)
    .strokeOpacity(COLORS.opacity06)
    .lineWidth(1)
    .stroke();
  // Reset opacity
  doc.strokeOpacity(1);
}

// Helper to set text style with proper color and opacity
function setLabelStyle(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  return doc
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor(COLORS.black)
    .fillOpacity(COLORS.opacity88);
}

function setValueStyle(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  return doc
    .font(FONTS.medium)
    .fontSize(10)
    .fillColor(COLORS.black)
    .fillOpacity(COLORS.opacity72);
}

function setMutedStyle(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  return doc
    .font(FONTS.medium)
    .fontSize(10)
    .fillColor(COLORS.black)
    .fillOpacity(COLORS.opacity48);
}

function setTitleStyle(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  return doc
    .font(FONTS.bold)
    .fontSize(18)
    .fillColor(COLORS.black)
    .fillOpacity(COLORS.opacity88);
}

function setTotalValueStyle(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  return doc
    .font(FONTS.medium)
    .fontSize(18)
    .fillColor(COLORS.black)
    .fillOpacity(COLORS.opacity72);
}

function setSubtitleStyle(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  return doc
    .font(FONTS.medium)
    .fontSize(9)
    .fillColor(COLORS.black)
    .fillOpacity(COLORS.opacity72);
}

// Generate QR code as PNG buffer
async function generateQrCodeBuffer(address: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    QRCode.toBuffer(
      address,
      {
        errorCorrectionLevel: "M",
        margin: 0,
        width: 160, // Double resolution for crisp rendering
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      },
      (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      },
    );
  });
}

// Draw page header (logo + website)
function drawPageHeader(doc: PDFKit.PDFDocument): number {
  const y = PAGE.padding.y;

  // Logo
  drawLogo(doc, PAGE.padding.x, y);

  // Website
  const contentWidth = PAGE.width - PAGE.padding.x * 2;
  setMutedStyle(doc).text("outpacestudios.com", PAGE.padding.x, y, {
    width: contentWidth,
    align: "right",
  });

  return y + 14 + 16; // logo row height + gap
}

// Draw "OR" separator with lines
function drawOrSeparator(doc: PDFKit.PDFDocument, y: number): void {
  const contentWidth = PAGE.width - PAGE.padding.x * 2;
  const textWidth = 20;
  const gap = 12;
  const lineWidth = (contentWidth - textWidth - gap * 2) / 2;

  // Left line
  doc
    .moveTo(PAGE.padding.x, y + 7)
    .lineTo(PAGE.padding.x + lineWidth, y + 7)
    .strokeColor(COLORS.black)
    .strokeOpacity(COLORS.opacity06)
    .lineWidth(1)
    .stroke();

  // OR text
  setMutedStyle(doc).text("OR", PAGE.padding.x + lineWidth + gap, y, {
    width: textWidth,
    align: "center",
  });

  // Right line
  doc
    .moveTo(PAGE.padding.x + lineWidth + gap + textWidth + gap, y + 7)
    .lineTo(PAGE.width - PAGE.padding.x, y + 7)
    .strokeColor(COLORS.black)
    .strokeOpacity(COLORS.opacity06)
    .lineWidth(1)
    .stroke();

  doc.strokeOpacity(1);
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  // Generate QR code buffer from crypto address (if available)
  let qrCodeBuffer: Buffer | null = null;
  if (data.cryptoDetails?.address) {
    try {
      qrCodeBuffer = await generateQrCodeBuffer(data.cryptoDetails.address);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      // Get font path for Inter Display
      const fontPath = path.join(process.cwd(), "public/fonts");
      const defaultFont = `${fontPath}/InterDisplay-Regular.ttf`;

      const doc = new PDFDocument({
        size: [PAGE.width, PAGE.height],
        margin: 0,
        bufferPages: true,
        font: defaultFont, // Set default font to avoid Helvetica loading
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Register all font variants
      registerFonts(doc);

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
        cryptoDetails,
      } = data;

      let y = PAGE.padding.y;
      const contentWidth = PAGE.width - PAGE.padding.x * 2;
      const columnWidth = contentWidth / 4;

      // ===== HEADER SECTION =====

      // Logo and website row (height: 14px)
      drawLogo(doc, PAGE.padding.x, y);

      setMutedStyle(doc).text("outpacestudios.com", PAGE.padding.x, y, {
        width: contentWidth,
        align: "right",
      });

      y += 14 + 16; // logo row height (14) + gap (16) = 30

      // Invoice title
      setTitleStyle(doc).text("Invoice", PAGE.padding.x, y);

      y += 28 + 16; // title height (28) + gap (16) = 44

      // Company info row (4 columns)
      const companyInfoY = y;

      // Column 1: Company name and address (with text wrapping)
      setLabelStyle(doc).text(company.legalName, PAGE.padding.x, companyInfoY);

      let addressY = companyInfoY + 14 + 8; // line height + gap
      const addressWidth = columnWidth - 8; // Leave some padding
      setValueStyle(doc);
      for (const line of company.address) {
        const textHeight = doc.heightOfString(line, { width: addressWidth });
        doc.text(line, PAGE.padding.x, addressY, { width: addressWidth });
        addressY += textHeight + 4;
      }

      // Column 2: Contact info (with text wrapping)
      setLabelStyle(doc).text(
        "Contact",
        PAGE.padding.x + columnWidth,
        companyInfoY,
      );

      let contactY = companyInfoY + 14 + 8;
      const contactWidth = columnWidth - 8;
      setValueStyle(doc);
      doc.text(company.email, PAGE.padding.x + columnWidth, contactY, {
        width: contactWidth,
      });
      contactY +=
        doc.heightOfString(company.email, { width: contactWidth }) + 4;
      doc.text(company.phone, PAGE.padding.x + columnWidth, contactY, {
        width: contactWidth,
      });

      // Calculate max height of this section
      y = Math.max(addressY, contactY) + PAGE.padding.y;

      // Divider
      drawDivider(doc, y);
      y += PAGE.padding.y;

      // ===== INVOICE DETAILS SECTION =====

      const detailsY = y;

      // Column 1: Invoice number (with text wrapping)
      const detailsColWidth = columnWidth - 8;
      setLabelStyle(doc).text("Invoice no.", PAGE.padding.x, detailsY);
      setValueStyle(doc).text(
        invoiceNumber,
        PAGE.padding.x,
        detailsY + 14 + 8,
        { width: detailsColWidth },
      );

      // Column 2: To (client) with text wrapping
      setLabelStyle(doc).text("To", PAGE.padding.x + columnWidth, detailsY);

      let clientY = detailsY + 14 + 8;
      const clientColWidth = columnWidth - 8; // Leave some padding
      setValueStyle(doc);
      doc.text(clientName, PAGE.padding.x + columnWidth, clientY, {
        width: clientColWidth,
      });
      clientY += doc.heightOfString(clientName, { width: clientColWidth }) + 4;
      for (const line of clientAddress) {
        const textHeight = doc.heightOfString(line, { width: clientColWidth });
        doc.text(line, PAGE.padding.x + columnWidth, clientY, {
          width: clientColWidth,
        });
        clientY += textHeight + 4;
      }
      doc.text(clientEmail, PAGE.padding.x + columnWidth, clientY, {
        width: clientColWidth,
      });
      clientY += 14;

      // Column 3: Issue Date (with text wrapping)
      setLabelStyle(doc).text(
        "Issue Date",
        PAGE.padding.x + columnWidth * 2,
        detailsY,
      );
      setValueStyle(doc).text(
        date,
        PAGE.padding.x + columnWidth * 2,
        detailsY + 14 + 8,
        { width: detailsColWidth },
      );

      // Column 4: Due Date (with text wrapping)
      setLabelStyle(doc).text(
        "Due Date",
        PAGE.padding.x + columnWidth * 3,
        detailsY,
      );
      setValueStyle(doc).text(
        dueDate,
        PAGE.padding.x + columnWidth * 3,
        detailsY + 14 + 8,
        { width: detailsColWidth },
      );

      y = Math.max(clientY, detailsY + 14 + 8 + 14) + PAGE.padding.y;

      // Divider
      drawDivider(doc, y);
      y += PAGE.padding.y;

      // ===== TABLE SECTION =====

      const tableX = PAGE.padding.x + contentWidth / 2; // Right half
      const tableWidth = contentWidth / 2;
      const tableColWidth = tableWidth / 2;
      const tableY = y;

      // Table header
      setLabelStyle(doc);
      doc.text("Description", tableX, tableY);
      doc.text("Amount", tableX + tableColWidth, tableY);

      // Header bottom border
      const headerBottomY = tableY + 14 + 12;
      doc
        .moveTo(tableX, headerBottomY)
        .lineTo(tableX + tableWidth, headerBottomY)
        .strokeColor(COLORS.black)
        .strokeOpacity(COLORS.opacity06)
        .lineWidth(1)
        .stroke();
      doc.strokeOpacity(1);

      let rowY = headerBottomY + 12;

      // Table rows (with text wrapping)
      const descriptionWidth = tableColWidth - 8;
      for (const item of lineItems) {
        setLabelStyle(doc).text(item.description, tableX, rowY, {
          width: descriptionWidth,
        });
        const descHeight = doc.heightOfString(item.description, {
          width: descriptionWidth,
        });

        // Sub-description if present
        let subDescHeight = 0;
        if (item.subDescription) {
          setSubtitleStyle(doc).text(
            item.subDescription,
            tableX,
            rowY + descHeight,
            { width: descriptionWidth },
          );
          subDescHeight = doc.heightOfString(item.subDescription, {
            width: descriptionWidth,
          });
        }

        setValueStyle(doc).text(
          formatCurrency(item.quantity * item.unitAmountCents, currency),
          tableX + tableColWidth,
          rowY,
        );

        const rowBottomY = rowY + descHeight + subDescHeight + 12;
        doc
          .moveTo(tableX, rowBottomY)
          .lineTo(tableX + tableWidth, rowBottomY)
          .strokeColor(COLORS.black)
          .strokeOpacity(COLORS.opacity06)
          .lineWidth(1)
          .stroke();
        doc.strokeOpacity(1);

        rowY = rowBottomY + 12;
      }

      // Processing fee row (if applicable) with text wrapping
      if (data.processingFeeCents && data.processingFeeCents > 0) {
        const feeLabel = "Payment Processing Fee";
        setLabelStyle(doc).text(feeLabel, tableX, rowY, {
          width: descriptionWidth,
        });
        const feeLabelHeight = doc.heightOfString(feeLabel, {
          width: descriptionWidth,
        });

        const feePercentDisplay = data.processingFeePercent ?? 4.4;
        const feeSubLabel = `${feePercentDisplay}% card payment fee`;
        setSubtitleStyle(doc).text(feeSubLabel, tableX, rowY + feeLabelHeight, {
          width: descriptionWidth,
        });
        const feeSubHeight = doc.heightOfString(feeSubLabel, {
          width: descriptionWidth,
        });

        setValueStyle(doc).text(
          formatCurrency(data.processingFeeCents, currency),
          tableX + tableColWidth,
          rowY,
        );

        const feeRowBottomY = rowY + feeLabelHeight + feeSubHeight + 12;
        doc
          .moveTo(tableX, feeRowBottomY)
          .lineTo(tableX + tableWidth, feeRowBottomY)
          .strokeColor(COLORS.black)
          .strokeOpacity(COLORS.opacity06)
          .lineWidth(1)
          .stroke();
        doc.strokeOpacity(1);

        rowY = feeRowBottomY + 12;
      }

      // Total row - positioned at bottom of table area
      // Calculate where to place Total to align with bottom
      const footerY = PAGE.height - PAGE.padding.y - 14; // Footer text position
      const bottomDividerY = footerY - PAGE.padding.y; // Divider above footer
      const totalRowY = bottomDividerY - PAGE.padding.y - 28; // Total row (18px font + padding)
      const totalTopBorderY = totalRowY - 12;

      // Total top border
      doc
        .moveTo(tableX, totalTopBorderY)
        .lineTo(tableX + tableWidth, totalTopBorderY)
        .strokeColor(COLORS.black)
        .strokeOpacity(COLORS.opacity06)
        .lineWidth(1)
        .stroke();
      doc.strokeOpacity(1);

      setTitleStyle(doc).text("Total", tableX, totalRowY);

      setTotalValueStyle(doc).text(
        formatCurrency(totalCents, currency),
        tableX + tableColWidth,
        totalRowY,
      );

      // ===== BOTTOM DIVIDER =====
      drawDivider(doc, bottomDividerY);

      // ===== FOOTER =====
      setMutedStyle(doc).text("1 of 2", PAGE.padding.x, footerY);

      // ===== PAGE 2: PAYMENT INSTRUCTIONS =====
      doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });

      let page2Y = drawPageHeader(doc);

      // Title
      setTitleStyle(doc).text("Payment Instructions", PAGE.padding.x, page2Y);
      page2Y += 28 + 16;

      // Divider
      drawDivider(doc, page2Y);
      page2Y += PAGE.padding.y;

      const bankColWidth = contentWidth / 4;
      let hasBankSection = false;

      // Bank Transfer section (if bank details available)
      if (bankDetails) {
        hasBankSection = true;
        setLabelStyle(doc).text("Bank Transfer (USD)", PAGE.padding.x, page2Y);
        page2Y += 14 + 16;

        // Bank details - 4 columns (with text wrapping)
        const bankDetailsY = page2Y;
        const bankFieldWidth = bankColWidth - 8;

        // Column 1: Bank Name
        setLabelStyle(doc).text("Bank Name", PAGE.padding.x, bankDetailsY);
        setValueStyle(doc).text(
          bankDetails.bankName,
          PAGE.padding.x,
          bankDetailsY + 14 + 8,
          { width: bankFieldWidth },
        );

        // Column 2: Beneficiary IBAN
        setLabelStyle(doc).text(
          "Beneficiary IBAN",
          PAGE.padding.x + bankColWidth,
          bankDetailsY,
        );
        setValueStyle(doc).text(
          bankDetails.iban,
          PAGE.padding.x + bankColWidth,
          bankDetailsY + 14 + 8,
          { width: bankFieldWidth },
        );

        // Column 3: SWIFT / BIC code
        setLabelStyle(doc).text(
          "SWIFT / BIC code",
          PAGE.padding.x + bankColWidth * 2,
          bankDetailsY,
        );
        setValueStyle(doc).text(
          bankDetails.swiftCode,
          PAGE.padding.x + bankColWidth * 2,
          bankDetailsY + 14 + 8,
          { width: bankFieldWidth },
        );

        // Column 4: Bank Address (with text wrapping)
        setLabelStyle(doc).text(
          "Bank Address",
          PAGE.padding.x + bankColWidth * 3,
          bankDetailsY,
        );
        const bankAddrX = PAGE.padding.x + bankColWidth * 3;
        const bankAddrWidth = bankColWidth - 8; // Leave some padding
        let bankAddrY = bankDetailsY + 14 + 8;
        setValueStyle(doc);
        for (const line of bankDetails.bankAddress) {
          const textHeight = doc.heightOfString(line, { width: bankAddrWidth });
          doc.text(line, bankAddrX, bankAddrY, { width: bankAddrWidth });
          bankAddrY += textHeight + 4;
        }

        page2Y =
          Math.max(bankDetailsY + 14 + 8 + 14, bankAddrY) + PAGE.padding.y;
      }

      // Only show crypto section if crypto details are available
      if (cryptoDetails) {
        // OR separator only if both payment methods exist
        if (hasBankSection) {
          drawOrSeparator(doc, page2Y);
          page2Y += 14 + PAGE.padding.y;
        }

        // Crypto section title
        setLabelStyle(doc).text("Crypto (USDC)", PAGE.padding.x, page2Y);
        page2Y += 14 + 16;

        // Crypto details - 3 columns (Network, Address, QR Code) with text wrapping
        const cryptoDetailsY = page2Y;
        const cryptoFieldWidth = bankColWidth - 8;
        const cryptoAddrWidth = bankColWidth * 2 - 8; // Address gets 2 columns worth

        // Column 1: Network
        setLabelStyle(doc).text("Network", PAGE.padding.x, cryptoDetailsY);
        setValueStyle(doc).text(
          cryptoDetails.network,
          PAGE.padding.x,
          cryptoDetailsY + 14 + 8,
          { width: cryptoFieldWidth },
        );

        // Column 2: Address (wider column for long addresses)
        setLabelStyle(doc).text(
          "Address",
          PAGE.padding.x + bankColWidth,
          cryptoDetailsY,
        );
        setValueStyle(doc).text(
          cryptoDetails.address,
          PAGE.padding.x + bankColWidth,
          cryptoDetailsY + 14 + 8,
          { width: cryptoAddrWidth },
        );

        // Column 3: QR Code
        const qrX = PAGE.width - PAGE.padding.x - bankColWidth;
        setLabelStyle(doc).text("Scan to pay USDC (SOL)", qrX, cryptoDetailsY);

        // Draw QR code if available
        if (qrCodeBuffer) {
          doc.image(qrCodeBuffer, qrX, cryptoDetailsY + 14 + 8, {
            width: 80,
            height: 80,
          });
        }
      }

      // Page 2 footer divider and page number
      const page2FooterY = PAGE.height - PAGE.padding.y - 14;
      const page2BottomDividerY = page2FooterY - PAGE.padding.y;

      drawDivider(doc, page2BottomDividerY);
      setMutedStyle(doc).text("2 of 2", PAGE.padding.x, page2FooterY);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
