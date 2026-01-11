/**
 * Slack Block Kit message templates for invoice automation
 */

import type { KnownBlock } from "@slack/types";

// Use KnownBlock for proper typing
type SlackBlock = KnownBlock;

export interface InvoiceMessageData {
	invoiceNumber: string;
	clientName: string;
	amount: string;
	currency: string;
	periodStart: string;
	periodEnd: string;
	billingType: "retainer" | "sprint";
	invoiceId: string;
}

export function createInvoiceDraftMessage(data: InvoiceMessageData): SlackBlock[] {
	return [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "📄 New Invoice Draft",
				emoji: true,
			},
		},
		{
			type: "section",
			fields: [
				{
					type: "mrkdwn",
					text: `*Invoice:*\n${data.invoiceNumber}`,
				},
				{
					type: "mrkdwn",
					text: `*Client:*\n${data.clientName}`,
				},
				{
					type: "mrkdwn",
					text: `*Amount:*\n${data.currency} ${data.amount}`,
				},
				{
					type: "mrkdwn",
					text: `*Type:*\n${data.billingType === "retainer" ? "Retainer" : "Sprint"}`,
				},
				{
					type: "mrkdwn",
					text: `*Period:*\n${data.periodStart} - ${data.periodEnd}`,
				},
			],
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "✅ Approve & Send",
						emoji: true,
					},
					style: "primary",
					action_id: "approve_invoice",
					value: data.invoiceId,
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "✏️ Edit",
						emoji: true,
					},
					action_id: "edit_invoice",
					value: data.invoiceId,
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "🗑️ Void",
						emoji: true,
					},
					style: "danger",
					action_id: "void_invoice",
					value: data.invoiceId,
				},
			],
		},
	];
}

export function createInvoiceSentMessage(data: {
	invoiceNumber: string;
	clientName: string;
	amount: string;
	pdfUrl?: string;
}): SlackBlock[] {
	const blocks: SlackBlock[] = [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `✅ *Invoice ${data.invoiceNumber}* sent to *${data.clientName}*\nAmount: ${data.amount}`,
			},
		},
	];

	if (data.pdfUrl) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `<${data.pdfUrl}|View PDF>`,
			},
		});
	}

	return blocks;
}

export function createPendingInvoicesMessage(
	invoices: Array<{
		invoiceNumber: string;
		clientName: string;
		amount: string;
		status: string;
		createdAt: string;
	}>
): SlackBlock[] {
	if (invoices.length === 0) {
		return [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "✨ No pending invoices!",
				},
			},
		];
	}

	const blocks: SlackBlock[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "📋 Pending Invoices",
				emoji: true,
			},
		},
		{
			type: "divider",
		},
	];

	for (const inv of invoices) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*${inv.invoiceNumber}* - ${inv.clientName}\n${inv.amount} | ${inv.status} | Created ${inv.createdAt}`,
			},
		});
	}

	return blocks;
}

export function createErrorMessage(error: string): SlackBlock[] {
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `❌ *Error:* ${error}`,
			},
		},
	];
}

export function createEditInvoiceModal(data: {
	invoiceId: string;
	invoiceNumber: string;
	amount: number;
	notes?: string;
}) {
	return {
		type: "modal",
		callback_id: "edit_invoice_modal",
		private_metadata: data.invoiceId,
		title: {
			type: "plain_text",
			text: `Edit ${data.invoiceNumber}`,
		},
		submit: {
			type: "plain_text",
			text: "Save Changes",
		},
		close: {
			type: "plain_text",
			text: "Cancel",
		},
		blocks: [
			{
				type: "input",
				block_id: "amount_block",
				element: {
					type: "number_input",
					action_id: "amount_input",
					is_decimal_allowed: true,
					initial_value: String(data.amount / 100),
					placeholder: {
						type: "plain_text",
						text: "Enter amount",
					},
				},
				label: {
					type: "plain_text",
					text: "Amount",
				},
			},
			{
				type: "input",
				block_id: "notes_block",
				optional: true,
				element: {
					type: "plain_text_input",
					action_id: "notes_input",
					multiline: true,
					initial_value: data.notes ?? "",
					placeholder: {
						type: "plain_text",
						text: "Add any notes...",
					},
				},
				label: {
					type: "plain_text",
					text: "Notes",
				},
			},
		],
	};
}
