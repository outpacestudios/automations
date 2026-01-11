import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Slack slash command handler
http.route({
	path: "/slack/commands",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const formData = await request.formData();
		const command = formData.get("command") as string;
		const text = formData.get("text") as string;
		const userId = formData.get("user_id") as string;
		const channelId = formData.get("channel_id") as string;

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

					// Schedule the invoice creation
					await ctx.runMutation(api.invoices.create, {
						clientId: clientPrefix as any, // Will be resolved
						billingType: billingType as "retainer" | "sprint",
						periodStart: Date.now(),
						periodEnd: Date.now() + 28 * 24 * 60 * 60 * 1000, // 28 days
						amountCents: Math.round(parseFloat(amountStr) * 100),
						currency: currency || "EUR",
						lineItems: [
							{
								description:
									billingType === "retainer"
										? "Design & Development Retainer"
										: "Sprint Development",
								quantity: 1,
								unitAmountCents: Math.round(parseFloat(amountStr) * 100),
							},
						],
					});

					return new Response(
						JSON.stringify({
							response_type: "in_channel",
							text: `Creating invoice for ${clientPrefix}...`,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);

				case "list":
					return new Response(
						JSON.stringify({
							response_type: "ephemeral",
							text: "Fetching pending invoices...",
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
		const formData = await request.formData();
		const payloadStr = formData.get("payload") as string;
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
					return new Response(
						JSON.stringify({
							response_type: "in_channel",
							text: `Invoice approved and sent!`,
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
					return new Response(
						JSON.stringify({
							response_type: "in_channel",
							text: `Invoice voided.`,
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
			}
		}

		if (type === "view_submission" && callback_id === "edit_invoice_modal") {
			// Handle modal submission
			const invoiceId = view.private_metadata;
			const values = view.state.values;
			const newAmount = parseFloat(
				values.amount_block.amount_input.value
			);

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
