/**
 * Currency formatting utilities
 */

export type CurrencyCode = "usd" | "eur" | "gbp" | "cad" | "aud";

const CURRENCY_SYMBOLS: Record<string, string> = {
	usd: "$",
	eur: "€",
	gbp: "£",
	cad: "CA$",
	aud: "A$",
};

export function formatCurrency(cents: number, currency = "usd"): string {
	const normalizedCurrency = currency.toLowerCase();
	const symbol =
		CURRENCY_SYMBOLS[normalizedCurrency] ?? currency.toUpperCase();
	const amount = cents / 100;

	if (cents < 0) {
		return `-${symbol}${Math.abs(amount).toFixed(2)}`;
	}

	return `${symbol}${amount.toFixed(2)}`;
}

export function dollarsToCents(dollars: number): number {
	return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
	return cents / 100;
}

export function calculateLineItemTotal(
	quantity: number,
	unitAmountCents: number
): number {
	return Math.round(quantity * unitAmountCents);
}

export function calculateSubtotal(
	lineItems: Array<{ quantity: number; unitAmountCents: number }>
): number {
	return lineItems.reduce(
		(sum, item) =>
			sum + calculateLineItemTotal(item.quantity, item.unitAmountCents),
		0
	);
}
