/**
 * Slack Web API client wrapper
 */

import { WebClient } from "@slack/web-api";
import type { KnownBlock } from "@slack/types";

let client: WebClient | null = null;

export function getSlackClient(): WebClient {
	if (!client) {
		const token = process.env.SLACK_BOT_TOKEN;
		if (!token) {
			throw new Error("SLACK_BOT_TOKEN environment variable is not set");
		}
		client = new WebClient(token);
	}
	return client;
}

export async function sendMessage(
	channel: string,
	text: string,
	blocks?: KnownBlock[]
): Promise<string | undefined> {
	const slack = getSlackClient();
	const result = await slack.chat.postMessage({
		channel,
		text,
		blocks,
	});
	return result.ts;
}

export async function updateMessage(
	channel: string,
	ts: string,
	text: string,
	blocks?: KnownBlock[]
): Promise<void> {
	const slack = getSlackClient();
	await slack.chat.update({
		channel,
		ts,
		text,
		blocks,
	});
}

export async function openModal(
	triggerId: string,
	view: object
): Promise<void> {
	const slack = getSlackClient();
	await slack.views.open({
		trigger_id: triggerId,
		view: view as Parameters<typeof slack.views.open>[0]["view"],
	});
}

export async function sendWebhookMessage(
	webhookUrl: string,
	payload: { text: string; blocks?: KnownBlock[] }
): Promise<void> {
	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Slack webhook failed: ${response.statusText}`);
	}
}
