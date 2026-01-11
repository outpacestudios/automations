import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// Verify Slack request signature
async function verifySlackSignature(
	request: Request,
	body: string
): Promise<boolean> {
	const signingSecret = process.env.SLACK_SIGNING_SECRET;
	if (!signingSecret) {
		console.error("SLACK_SIGNING_SECRET not configured");
		return false;
	}

	const timestamp = request.headers.get("X-Slack-Request-Timestamp");
	const signature = request.headers.get("X-Slack-Signature");

	if (!timestamp || !signature) {
		return false;
	}

	// Check timestamp is within 5 minutes to prevent replay attacks
	const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
	if (parseInt(timestamp) < fiveMinutesAgo) {
		return false;
	}

	// Compute expected signature
	const baseString = `v0:${timestamp}:${body}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(signingSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const signatureBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(baseString)
	);
	const signatureArray = Array.from(new Uint8Array(signatureBuffer));
	const computedSignature =
		"v0=" + signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

	// Constant-time comparison
	if (signature.length !== computedSignature.length) {
		return false;
	}
	let result = 0;
	for (let i = 0; i < signature.length; i++) {
		result |= signature.charCodeAt(i) ^ computedSignature.charCodeAt(i);
	}
	return result === 0;
}

// Protected invoice PDF endpoint
http.route({
	path: "/invoice/{token}",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		// Extract token from URL
		const url = new URL(request.url);
		const pathParts = url.pathname.split("/");
		const token = pathParts[pathParts.length - 1];

		if (!token || token.length !== 32) {
			return new Response(JSON.stringify({ error: "Invalid token" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Validate token
		const validation = await ctx.runQuery(api.tokens.validate, { token });

		if (!validation.valid) {
			return new Response(
				JSON.stringify({ error: validation.error || "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Get invoice
		const invoice = await ctx.runQuery(api.invoices.get, {
			id: validation.invoiceId!,
		});

		if (!invoice) {
			return new Response(JSON.stringify({ error: "Invoice not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!invoice.pdfStorageId) {
			return new Response(JSON.stringify({ error: "PDF not available" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get PDF from storage
		const pdfBlob = await ctx.storage.get(invoice.pdfStorageId);

		if (!pdfBlob) {
			return new Response(JSON.stringify({ error: "PDF file not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Mark token as used
		if (validation.tokenId) {
			await ctx.runMutation(api.tokens.markUsed, {
				tokenId: validation.tokenId,
			});
		}

		// Return PDF
		return new Response(pdfBlob, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
				"Cache-Control": "private, max-age=3600",
			},
		});
	}),
});

// Slack slash command handler
http.route({
	path: "/slack/commands",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		// Read body for signature verification
		const body = await request.text();

		// Verify Slack signature
		const isValid = await verifySlackSignature(request, body);
		if (!isValid) {
			console.error("Invalid Slack signature");
			return new Response(JSON.stringify({ error: "Invalid signature" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Parse form data from body
		const params = new URLSearchParams(body);
		const command = params.get("command") as string;
		const text = params.get("text") as string;
		const userId = params.get("user_id") as string;
		const channelId = params.get("channel_id") as string;

		// Acknowledge immediately
		if (command === "/invoice") {
			const args = text.split(" ");
			const subcommand = args[0] || "help";

			switch (subcommand) {
				case "create":
					// Parse: /invoice create [client] [type] [amount] [currency]
					// Example: /invoice create FRI retainer 5000 EUR
					const [_, clientPrefix, billingType, amountStr, currency] = args;

					if (!clientPrefix || !billingType || !amountStr) {
						return new Response(
							JSON.stringify({
								response_type: "ephemeral",
								text: "Usage: `/invoice create [CLIENT_PREFIX] [retainer|sprint] [AMOUNT] [CURRENCY]`\nExample: `/invoice create FRI retainer 5000 EUR`",
							}),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							}
						);
					}

					// Look up client by prefix
					const client = await ctx.runQuery(api.clients.getByPrefix, {
						prefix: clientPrefix.toUpperCase(),
					});

					if (!client) {
						return new Response(
							JSON.stringify({
								response_type: "ephemeral",
								text: `Client with prefix "${clientPrefix}" not found.`,
							}),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							}
						);
					}

					// Create the invoice
					await ctx.runMutation(api.invoices.create, {
						clientId: client._id,
						billingType: billingType as "retainer" | "sprint",
						periodStart: Date.now(),
						periodEnd: Date.now() + 28 * 24 * 60 * 60 * 1000, // 28 days
						amountCents: Math.round(parseFloat(amountStr) * 100),
						currency: currency?.toUpperCase() || "USD",
						lineItems: [
							{
								description:
									billingType === "retainer"
										? "Marathon Plan - 4 Weeks"
										: "Sprint Plan",
								quantity: 1,
								unitAmountCents: Math.round(parseFloat(amountStr) * 100),
							},
						],
					});

					return new Response(
						JSON.stringify({
							response_type: "in_channel",
							text: `✅ Invoice created for ${client.name} (${clientPrefix})`,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);

				case "list":
					const pending = await ctx.runQuery(api.invoices.getPending, {});
					if (pending.length === 0) {
						return new Response(
							JSON.stringify({
								response_type: "ephemeral",
								text: "No pending invoices.",
							}),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							}
						);
					}

					const invoiceList = pending
						.map(
							(inv) =>
								`• ${inv.invoiceNumber} - $${(inv.amountCents / 100).toLocaleString()} (${inv.status})`
						)
						.join("\n");

					return new Response(
						JSON.stringify({
							response_type: "ephemeral",
							text: `*Pending Invoices:*\n${invoiceList}`,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);

				case "help":
				default:
					return new Response(
						JSON.stringify({
							response_type: "ephemeral",
							text: [
								"*Invoice Commands:*",
								"`/invoice create [CLIENT] [TYPE] [AMOUNT] [CURRENCY]` - Create new invoice",
								"`/invoice list` - List pending invoices",
								"`/invoice help` - Show this help",
								"",
								"*Examples:*",
								"`/invoice create FRI retainer 5000 EUR`",
								"`/invoice create ABC sprint 2500 USD`",
							].join("\n"),
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);
			}
		}

		return new Response(
			JSON.stringify({ response_type: "ephemeral", text: "Unknown command" }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	}),
});

// Slack interactive components handler (buttons, modals)
http.route({
	path: "/slack/interactive",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		// Read body for signature verification
		const body = await request.text();

		// Verify Slack signature
		const isValid = await verifySlackSignature(request, body);
		if (!isValid) {
			console.error("Invalid Slack signature");
			return new Response(JSON.stringify({ error: "Invalid signature" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Parse form data from body
		const params = new URLSearchParams(body);
		const payloadStr = params.get("payload") as string;
		const payload = JSON.parse(payloadStr);

		const { type, actions, callback_id, trigger_id, view } = payload;

		if (type === "block_actions") {
			const action = actions[0];

			switch (action.action_id) {
				case "approve_invoice":
					const invoiceId = action.value;
					await ctx.runMutation(api.invoices.updateStatus, {
						id: invoiceId as any,
						status: "sent",
					});

					// Generate token for PDF access
					const { token } = await ctx.runMutation(api.tokens.generate, {
						invoiceId: invoiceId as any,
					});

					// Get the Convex site URL
					const siteUrl =
						process.env.CONVEX_SITE_URL ||
						"https://different-leopard-356.convex.site";
					const pdfUrl = `${siteUrl}/invoice/${token}`;

					return new Response(
						JSON.stringify({
							response_type: "in_channel",
							text: `✅ Invoice approved and sent!\n<${pdfUrl}|View PDF>`,
							replace_original: true,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);

				case "void_invoice":
					await ctx.runMutation(api.invoices.updateStatus, {
						id: action.value as any,
						status: "void",
					});
					// Delete any tokens for this invoice
					await ctx.runMutation(api.tokens.deleteForInvoice, {
						invoiceId: action.value as any,
					});
					return new Response(
						JSON.stringify({
							response_type: "in_channel",
							text: `❌ Invoice voided.`,
							replace_original: true,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);

				case "edit_invoice":
					// Would open modal - requires Slack app with views scope
					return new Response(null, { status: 200 });

				case "view_pdf":
					// Generate new token for viewing PDF
					const viewInvoiceId = action.value;
					const viewToken = await ctx.runMutation(api.tokens.generate, {
						invoiceId: viewInvoiceId as any,
					});

					const viewSiteUrl =
						process.env.CONVEX_SITE_URL ||
						"https://different-leopard-356.convex.site";
					const viewPdfUrl = `${viewSiteUrl}/invoice/${viewToken.token}`;

					return new Response(
						JSON.stringify({
							response_type: "ephemeral",
							text: `<${viewPdfUrl}|Click here to view the PDF>`,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);
			}
		}

		if (type === "view_submission" && callback_id === "edit_invoice_modal") {
			// Handle modal submission
			const invoiceId = view.private_metadata;
			const values = view.state.values;
			const newAmount = parseFloat(values.amount_block.amount_input.value);

			await ctx.runMutation(api.invoices.update, {
				id: invoiceId as any,
				amountCents: Math.round(newAmount * 100),
			});

			return new Response(null, { status: 200 });
		}

		return new Response(null, { status: 200 });
	}),
});

// Health check
http.route({
	path: "/health",
	method: "GET",
	handler: httpAction(async () => {
		return new Response(
			JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	}),
});

export default http;
