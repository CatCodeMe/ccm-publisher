import DigitalGardenSiteManager from "../repositoryConnection/DigitalGardenSiteManager";
import Publisher from "./Publisher";
import { generateBlobHash } from "../utils/utils";
import { CompiledPublishFile } from "../publishFile/PublishFile";

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
	): Array<{ path: string; sha: string }> {
		const isJsFile = (key: string) => key.endsWith(".js");

		const isMarkedForPublish = (key: string) =>
			marked.find((f) => f === key);

		const deletedPaths = Object.keys(remoteNoteHashes).filter(
			(key) => !isJsFile(key) && !isMarkedForPublish(key),
		);

		return deletedPaths.map((path) => {
			return {
				path,
				sha: remoteNoteHashes[path],
			};
		});
	}
	async getPublishStatus(): Promise<PublishStatus> {
		const unpublishedNotes: Array<CompiledPublishFile> = [];
		const publishedNotes: Array<CompiledPublishFile> = [];
		const changedNotes: Array<CompiledPublishFile> = [];

		const contentTree =
			await this.siteManager.userGardenConnection.getContent("HEAD");

		if (!contentTree) {
			throw new Error("Could not get content tree from base garden");
		}

		const remoteNoteHashes =
			await this.siteManager.getNoteHashes(contentTree);

		const remoteImageHashes =
			await this.siteManager.getImageHashes(contentTree);

		const marked = await this.publisher.getFilesMarkedForPublishing();

		for (const file of marked.notes) {
			const compiledFile = await file.compile();
			const [content, _] = compiledFile.getCompiledFile();

			const localHash = generateBlobHash(content);

			const remoteHash = remoteNoteHashes[file.meta.getCustomPath()];

			if (!remoteHash) {
				unpublishedNotes.push(compiledFile);
			} else if (remoteHash === localHash) {
				compiledFile.setRemoteHash(remoteHash);
				publishedNotes.push(compiledFile);
			} else {
				compiledFile.setRemoteHash(remoteHash);
				changedNotes.push(compiledFile);
			}
		}

		const deletedNotePaths = this.generateDeletedContentPaths(
			remoteNoteHashes,
			//删除笔记和github仓库路径保持一致
			marked.notes.map((f) => {
				const customParentPath = f.meta.getCustomPath();
				let i = 0;

				// 找到第一个非 '/' 字符的位置
				while (
					i < customParentPath.length &&
					customParentPath[i] === "/"
				) {
					i++;
				}

				// 截取字符串从第一个非 '/' 字符的位置开始
				return customParentPath.substring(i);
			}),
		);

		const deletedImagePaths = this.generateDeletedContentPaths(
			remoteImageHashes,
			marked.images,
		);
		// These might already be sorted, as getFilesMarkedForPublishing sorts already
		publishedNotes.sort((a, b) => a.compare(b));
		changedNotes.sort((a, b) => a.compare(b));
		deletedNotePaths.sort((a, b) => a.path.localeCompare(b.path));

		return {
			unpublishedNotes,
			publishedNotes,
			changedNotes,
			deletedNotePaths,
			deletedImagePaths,
		};
	}
}

interface PathToRemove {
	path: string;
	sha: string;
}

export interface PublishStatus {
	unpublishedNotes: Array<CompiledPublishFile>;
	publishedNotes: Array<CompiledPublishFile>;
	changedNotes: Array<CompiledPublishFile>;
	deletedNotePaths: Array<PathToRemove>;
	deletedImagePaths: Array<PathToRemove>;
}

export interface IPublishStatusManager {
	getPublishStatus(): Promise<PublishStatus>;
}
