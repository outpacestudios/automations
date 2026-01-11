/**
 * Google Drive upload utilities using rclone CLI
 * Uses rclone which is already configured on the server
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const execAsync = promisify(exec);

export interface UploadResult {
	success: boolean;
	remotePath?: string;
	error?: string;
}

/**
 * Upload a buffer to Google Drive using rclone
 * @param buffer - File buffer to upload
 * @param filename - Destination filename
 * @param folder - Destination folder path (relative to configured remote)
 * @param remoteName - rclone remote name (default: "outpace")
 */
export async function uploadToGoogleDrive(
	buffer: Buffer,
	filename: string,
	folder = "operations/invoices",
	remoteName = "outpace"
): Promise<UploadResult> {
	// Create temp directory for uploads
	const tempDir = path.join(os.tmpdir(), "automations-uploads");
	await mkdir(tempDir, { recursive: true });

	const tempFilePath = path.join(tempDir, filename);
	const remotePath = `${remoteName}:${folder}/${filename}`;

	try {
		// Write buffer to temp file
		await writeFile(tempFilePath, buffer);

		// Upload using rclone
		const { stdout, stderr } = await execAsync(
			`rclone copy "${tempFilePath}" "${remoteName}:${folder}" --progress`
		);

		// Clean up temp file
		await unlink(tempFilePath).catch(() => {});

		return {
			success: true,
			remotePath,
		};
	} catch (error) {
		// Clean up temp file on error
		await unlink(tempFilePath).catch(() => {});

		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Get a shareable link for a file in Google Drive
 * Note: This requires the file to already be shared or in a shared folder
 */
export async function getGoogleDriveLink(
	filename: string,
	folder = "operations/invoices",
	remoteName = "outpace"
): Promise<string | null> {
	try {
		const { stdout } = await execAsync(
			`rclone link "${remoteName}:${folder}/${filename}"`
		);
		return stdout.trim();
	} catch {
		// rclone link may not work for all remotes
		return null;
	}
}

/**
 * List files in a Google Drive folder
 */
export async function listGoogleDriveFiles(
	folder = "operations/invoices",
	remoteName = "outpace"
): Promise<string[]> {
	try {
		const { stdout } = await execAsync(`rclone lsf "${remoteName}:${folder}"`);
		return stdout.trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Check if rclone is configured and working
 */
export async function checkRcloneConfig(
	remoteName = "outpace"
): Promise<boolean> {
	try {
		await execAsync(`rclone lsd "${remoteName}:" --max-depth 0`);
		return true;
	} catch {
		return false;
	}
}
