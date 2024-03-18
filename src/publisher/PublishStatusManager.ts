import DigitalGardenSiteManager from "../repositoryConnection/DigitalGardenSiteManager";
import Publisher from "./Publisher";
import { generateBlobHash } from "../utils/utils";
import { CompiledPublishFile } from "../publishFile/PublishFile";
import { Asset } from "../compiler/GardenPageCompiler";

/**
 *  Manages the publishing status of notes and images for a digital garden.
 */
export default class PublishStatusManager implements IPublishStatusManager {
	siteManager: DigitalGardenSiteManager;
	publisher: Publisher;
	constructor(siteManager: DigitalGardenSiteManager, publisher: Publisher) {
		this.siteManager = siteManager;
		this.publisher = publisher;
	}
	getDeletedNotePaths(): Promise<string[]> {
		throw new Error("Method not implemented.");
	}
	getDeletedImagesPaths(): Promise<string[]> {
		throw new Error("Method not implemented.");
	}

	private generateDeletedContentPaths(
		remoteNoteHashes: { [key: string]: string },
		marked: string[],
	): Array<{ remotePath: string; sha: string }> {
		const isJsFile = (key: string) => key.endsWith(".js");

		const isMarkedForPublish = (key: string) =>
			marked.find((f) => f === key);

		const deletedPaths = Object.keys(remoteNoteHashes).filter(
			(key) => !isJsFile(key) && !isMarkedForPublish(key),
		);

		return deletedPaths.map((path) => {
			return {
				remotePath: path,
				sha: remoteNoteHashes[path],
			};
		});
	}
	async getPublishStatus(): Promise<PublishStatus> {
		const unpublishedNotes: Array<CompiledPublishFile> = [];
		const publishedNotes: Array<CompiledPublishFile> = [];
		const changedNotes: Array<CompiledPublishFile> = [];
		const unpublishedImages: Array<Asset> = [];
		const publishedImages: Array<Asset> = [];
		const changedImages: Array<Asset> = [];

		const contentTree =
			await this.siteManager.userGardenConnection.getContent(
				this.siteManager.settings.branchName || "HEAD",
			);

		if (!contentTree) {
			throw new Error("Could not get content tree from base garden");
		}

		const remoteNoteHashes =
			await this.siteManager.getNoteHashes(contentTree);

		const remoteImageHashes =
			await this.siteManager.getImageHashes(contentTree);

		const marked = await this.publisher.getFilesMarkedForPublishing();

		const linkedAssetMap = new Map();

		for (const file of marked.notes) {
			const compiledFile = await file.compile();

			const [content, imagesWithLocalInfo] =
				compiledFile.getCompiledFile();
			//for note
			const localHash = generateBlobHash(content);

			const remoteHash =
				remoteNoteHashes[file.meta.getCustomRemotePath()];

			if (!remoteHash) {
				unpublishedNotes.push(compiledFile);
			} else if (remoteHash === localHash) {
				compiledFile.setRemoteHash(remoteHash);
				publishedNotes.push(compiledFile);
			} else {
				compiledFile.setRemoteHash(remoteHash);
				changedNotes.push(compiledFile);
			}

			//校验所有笔记引用的图片, 再根据sha分类
			imagesWithLocalInfo.images.forEach((a: Asset) => {
				if (a.remotePath) {
					linkedAssetMap.set(a.remotePath, a);
				}
			});
		}

		linkedAssetMap.forEach((img, key) => {
			const githubHash = remoteImageHashes[key];

			if (!githubHash) {
				// img.remoteHash = img.localHash;
				unpublishedImages.push(img);
			} else if (githubHash === img.localHash) {
				//published no change
				img.remoteHash = githubHash;
				publishedImages.push(img);
			} else {
				//changed
				img.remoteHash = githubHash;
				changedImages.push(img);
			}
		});

		const deletedNotePaths = this.generateDeletedContentPaths(
			remoteNoteHashes,
			//删除笔记和github仓库路径保持一致
			marked.notes.map((f) => f.meta.getCustomRemotePath()),
		);

		const deletedImagePaths = this.generateDeletedContentPaths(
			remoteImageHashes,
			[...changedImages, ...publishedImages].map(
				(image) => image.remotePath,
			),
		);
		// These might already be sorted, as getFilesMarkedForPublishing sorts already
		publishedNotes.sort((a, b) => a.compare(b));
		changedNotes.sort((a, b) => a.compare(b));

		deletedNotePaths.sort((a, b) =>
			a.remotePath.localeCompare(b.remotePath),
		);

		return {
			unpublishedNotes,
			publishedNotes,
			changedNotes,
			deletedNotePaths,
			unpublishedImages,
			publishedImages,
			changedImages,
			deletedImagePaths,
		};
	}

	async checkConflictPath(): Promise<Array<ConflictStatus>> {
		// const marked = await this.publisher.getFilesMarkedForPublishing();
		return [
			{
				remotePath: "xxx",
				locaPaths: ["a", "b", "c"],
			},
		];
	}
}

interface PathToRemove {
	remotePath: string;
	sha: string;
}

export interface PublishStatus {
	unpublishedNotes: Array<CompiledPublishFile>;
	publishedNotes: Array<CompiledPublishFile>;
	changedNotes: Array<CompiledPublishFile>;
	deletedNotePaths: Array<PathToRemove>;

	unpublishedImages: Array<Asset>;
	publishedImages: Array<Asset>;
	changedImages: Array<Asset>;
	deletedImagePaths: Array<PathToRemove>;
}

export interface ConflictStatus {
	remotePath: string;
	locaPaths: Array<string>;
}

export interface IPublishStatusManager {
	getPublishStatus(): Promise<PublishStatus>;

	checkConflictPath(): Promise<Array<ConflictStatus>>;
}
