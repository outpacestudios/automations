/**
 * Date formatting utilities
 */

export function formatDate(
	dateString: string | Date | number,
	options: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
	}
): string {
	let date: Date;
	if (typeof dateString === "number") {
		date = new Date(dateString);
	} else if (typeof dateString === "string") {
		date = new Date(dateString);
	} else {
		date = dateString;
	}
	return date.toLocaleDateString("en-US", options);
}

export function toISODateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	result.setMonth(result.getMonth() + months);
	return result;
}

export function addWeeks(date: Date, weeks: number): Date {
	return addDays(date, weeks * 7);
}

export type BillingInterval = "4_weeks" | "monthly" | "custom";

export function getIntervalDays(interval: BillingInterval): number | null {
	switch (interval) {
		case "4_weeks":
			return 28;
		case "monthly":
			return null;
		case "custom":
			return null;
	}
}

export function calculatePeriodEnd(
	periodStart: number,
	interval: BillingInterval,
	customDays?: number
): number {
	const start = new Date(periodStart);

	if (interval === "4_weeks") {
		return addDays(start, 27).getTime(); // 28 days inclusive
	}

	if (interval === "monthly") {
		const end = addMonths(start, 1);
		end.setDate(end.getDate() - 1);
		return end.getTime();
	}

	if (interval === "custom" && customDays) {
		return addDays(start, customDays - 1).getTime();
	}

	return periodStart;
}
