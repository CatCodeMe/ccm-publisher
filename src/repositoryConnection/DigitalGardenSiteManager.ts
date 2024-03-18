import type DigitalGardenSettings from "src/models/settings";
import { type MetadataCache } from "obsidian";
import { Base64 } from "js-base64";
import {
	RepositoryConnection,
	TRepositoryContent,
} from "./RepositoryConnection";
import { formatPath } from "../utils/utils";

export interface PathRewriteRule {
	from: string;
	to: string;
}
export type PathRewriteRules = PathRewriteRule[];

type ContentTreeItem = {
	path: string;
	sha: string;
	type: string;
};

/**
 * Manages the digital garden website by handling various site configurations, files,
 * and interactions with GitHub via Octokit. Responsible for operations like updating
 * environment variables, fetching and updating notes & images, and creating pull requests
 * for site changes.
 */

export default class DigitalGardenSiteManager {
	settings: DigitalGardenSettings;
	metadataCache: MetadataCache;
	baseGardenConnection: RepositoryConnection;
	userGardenConnection: RepositoryConnection;

	constructor(metadataCache: MetadataCache, settings: DigitalGardenSettings) {
		this.settings = settings;
		this.metadataCache = metadataCache;

		this.baseGardenConnection = new RepositoryConnection({
			githubToken: settings.githubToken,
			githubUserName: "oleeskild",
			gardenRepository: "digitalgarden",
		});

		this.userGardenConnection = new RepositoryConnection({
			githubToken: settings.githubToken,
			githubUserName: settings.githubUserName,
			gardenRepository: settings.githubRepo,
		});
	}

	async getNoteContent(path: string): Promise<string> {
		if (path.startsWith("/")) {
			path = path.substring(1);
		}

		const response = await this.userGardenConnection.getFile(
			this.getNotesBaseDir() + path,
			this.settings.branchName,
		);

		if (!response) {
			return "";
		}

		return Base64.decode(response.content);
	}

	async getNoteHashes(
		contentTree: NonNullable<TRepositoryContent>,
	): Promise<Record<string, string>> {
		const files = contentTree.tree;

		const ignoreSettings = this.settings.ignoredDirOrFiles;

		const ignoresArray = ignoreSettings
			? ignoreSettings.split(",").map((f) => f.trim())
			: [];

		const notes = files.filter(
			(x): x is ContentTreeItem =>
				typeof x.path === "string" &&
				x.path.startsWith(this.getNotesBaseDir()) &&
				x.type === "blob",
		);
		const hashes: Record<string, string> = {};

		for (const note of notes) {
			if (note.path.startsWith(this.getNotesBaseDir())) {
				const matchIndex = note.path.indexOf(this.getNotesBaseDir());
				const vaultPath = note.path.substring(matchIndex);

				//路径包含关键字,则不做处理; 同时过滤掉静态资源路径，单独处理
				if (
					!ignoresArray.some((ig) => vaultPath.includes(ig)) &&
					!vaultPath.startsWith(this.getImgBaseDir())
				) {
					hashes[vaultPath] = note.sha;
				}
			}
		}

		return hashes;
	}

	async getImageHashes(
		contentTree: NonNullable<TRepositoryContent>,
	): Promise<Record<string, string>> {
		const files = contentTree.tree ?? [];

		const images = files.filter(
			(x): x is ContentTreeItem =>
				typeof x.path === "string" &&
				x.path.startsWith(this.getImgBaseDir()) &&
				x.type === "blob",
		);
		const hashes: Record<string, string> = {};

		for (const img of images) {
			const remotePath = decodeURI(img.path);
			hashes[remotePath] = img.sha;
		}

		return hashes;
	}

	private getNotesBaseDir(): string {
		return formatPath(this.settings.notesBaseDir);
	}

	private getImgBaseDir(): string {
		return formatPath(this.settings.imgBaseDir);
	}
}
