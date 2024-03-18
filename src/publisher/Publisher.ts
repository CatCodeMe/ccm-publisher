import { MetadataCache, TFile, Vault } from "obsidian";
import { Base64 } from "js-base64";
import {
	hasPublishFlag,
	isPublishFrontmatterValid,
} from "../publishFile/Validator";
import DigitalGardenSettings from "../models/settings";
import { Assets, GardenPageCompiler } from "../compiler/GardenPageCompiler";
import { CompiledPublishFile, PublishFile } from "../publishFile/PublishFile";
import { RepositoryConnection } from "../repositoryConnection/RepositoryConnection";
import { GitHubFile } from "../repositoryConnection/GitHubFile";
import { errorNotice, successNotice } from "../utils/NoticeUtils";
import { formatPath } from "../utils/utils";

export interface MarkedForPublishing {
	notes: PublishFile[];
	images: string[];
}

export const IMAGE_PATH_BASE = "img/user/";
export const NOTE_PATH_BASE = "";

/**
 * Prepares files to be published and publishes them to GitHub
 */
export default class Publisher {
	vault: Vault;
	metadataCache: MetadataCache;
	compiler: GardenPageCompiler;
	settings: DigitalGardenSettings;

	constructor(
		vault: Vault,
		metadataCache: MetadataCache,
		settings: DigitalGardenSettings,
	) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		this.settings = settings;

		this.compiler = new GardenPageCompiler(vault, settings, metadataCache);
	}

	shouldPublish(file: TFile): boolean {
		const frontMatter = this.metadataCache.getCache(file.path)?.frontmatter;

		return hasPublishFlag(frontMatter, this.settings.publishKey);
	}

	async getFilesMarkedForPublishing(): Promise<MarkedForPublishing> {
		const files = this.vault.getMarkdownFiles();
		const notesToPublish: PublishFile[] = [];
		const imagesToPublish: Set<string> = new Set();

		for (const file of files) {
			try {
				if (this.shouldPublish(file)) {
					const publishFile = new PublishFile({
						file,
						vault: this.vault,
						compiler: this.compiler,
						metadataCache: this.metadataCache,
						settings: this.settings,
					});

					notesToPublish.push(publishFile);

					const images = await publishFile.getImageLinks();

					images.forEach((i) => imagesToPublish.add(i));
				}
			} catch (e) {
				console.error(e);
			}
		}

		return {
			notes: notesToPublish.sort((a, b) => a.compare(b)),
			images: Array.from(imagesToPublish),
		};
	}

	async publish(file: CompiledPublishFile): Promise<boolean> {
		if (
			!isPublishFrontmatterValid(
				file.frontmatter,
				file.settings.publishKey,
			)
		) {
			return false;
		}

		try {
			const [text, assets] = file.compiledFile;
			const customPathAfterUpload = file.meta.getCustomRemotePath();

			await this.uploadText(
				customPathAfterUpload,
				text,
				file?.remoteHash,
			);
			await this.uploadAssets(assets);

			return true;
		} catch (error) {
			console.error(error);
			errorNotice(`publish failed: ${file.getPath()}`);

			return false;
		}
	}

	async uploadToGithub(
		path: string,
		content: string,
		remoteFileHash?: string,
	) {
		this.validateSettings();
		let message = `Update content ${path}`;

		const userGardenConnection = new RepositoryConnection({
			gardenRepository: this.settings.githubRepo,
			githubUserName: this.settings.githubUserName,
			githubToken: this.settings.githubToken,
		});

		if (!remoteFileHash) {
			const file = await userGardenConnection
				.getFile(path, this.settings.branchName)
				.catch(() => {
					// file does not exist
					console.info(`File ${path} does not exist, adding`);
				});
			remoteFileHash = file?.sha;

			if (!remoteFileHash) {
				message = `Add content ${path}`;
			}
		}

		return await userGardenConnection.updateFile({
			content,
			path,
			message,
			sha: remoteFileHash, //可选参数, create or update
		});
	}

	async uploadText(filePath: string, content: string, sha?: string) {
		content = Base64.encode(content);
		const path = `${this.getNotesBaseDir()}${filePath}`;
		await this.uploadToGithub(path, content, sha);
	}

	async uploadImage(filePath: string, content: string, sha?: string) {
		const path = `${filePath}`;
		await this.uploadToGithub(path, content, sha);
	}

	async uploadAssets(assets: Assets) {
		for (let idx = 0; idx < assets.images.length; idx++) {
			const image = assets.images[idx];

			await this.uploadImage(
				image.remotePath,
				image.content,
				image.remoteHash,
			);
		}
	}

	/**
	 * add、update、delete notes in one commit.
	 * @param files
	 * @param commitMsg
	 */
	async batchPublish(
		files: GitHubFile[],
		commitMsg?: string,
	): Promise<boolean> {
		if (!files || files.length == 0) {
			console.log("未选择文件");

			return true;
		}
		this.validateSettings();

		const userGardenConnection = new RepositoryConnection({
			gardenRepository: this.settings.githubRepo,
			githubUserName: this.settings.githubUserName,
			githubToken: this.settings.githubToken,
			branchName: this.settings.branchName,
		});

		try {
			await userGardenConnection.batchPublishFiles(files, commitMsg);
			successNotice("publish success");

			return true;
		} catch (error) {
			console.error(error);
			errorNotice("publish failed");

			return false;
		}
	}

	async updateImage(file: GitHubFile, commitMsg?: string) {
		if (!file) {
			console.log("未选择图片");

			return;
		}
		this.validateSettings();

		const userGardenConnection = new RepositoryConnection({
			gardenRepository: this.settings.githubRepo,
			githubUserName: this.settings.githubUserName,
			githubToken: this.settings.githubToken,
			branchName: this.settings.branchName,
		});

		const upload = await userGardenConnection.updateFile({
			path: file.path,
			sha: file.sha || "",
			content: file.content || "",
			branch: this.settings.branchName || "main",
			message: commitMsg,
		});

		if (!upload) {
			return false;
		}

		return (
			upload.status === 200 || // update
			upload.status === 201 // create
		);
	}

	validateSettings() {
		if (!this.settings.githubRepo) {
			errorNotice(
				"Config error: You need to define a GitHub repo in the plugin settings",
			);
			throw {};
		}

		if (!this.settings.githubUserName) {
			errorNotice(
				"Config error: You need to define a GitHub Username in the plugin settings",
			);
			throw {};
		}

		if (!this.settings.githubToken) {
			errorNotice(
				"Config error: You need to define a GitHub Token in the plugin settings",
			);
			throw {};
		}
	}

	private getNotesBaseDir(): string {
		return formatPath(this.settings.notesBaseDir);
	}
}
