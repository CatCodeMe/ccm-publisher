import { FrontMatterCache, TFile } from "obsidian";
import DigitalGardenSettings from "../models/settings";
import { PathMappingService } from "../services/PathMappingService";

// This should soon contain all the magic keys instead of them being hardcoded (with documentation)
export enum FRONTMATTER_KEYS {
	// The file should be published to the garden
	PUBLISH = "dg-publish",
	CUSTOM_PATH = "dg-path",
}

export class FileMetadataManager {
	file: TFile;
	frontmatter: FrontMatterCache;
	settings: DigitalGardenSettings;
	private pathMappingService: PathMappingService;

	constructor(
		file: TFile,
		frontmatter: FrontMatterCache,
		settings: DigitalGardenSettings,
	) {
		this.file = file;
		this.frontmatter = frontmatter;
		this.settings = settings;
		this.pathMappingService = new PathMappingService(settings);
	}

	getCustomRemotePath(): string {
		let customDir =
			this.frontmatter[
				this.settings.pathKey || FRONTMATTER_KEYS.CUSTOM_PATH
			];

		let sourcePath: string;
		let transformedPath: string;

		if (!customDir) {
			sourcePath = this.file.path;
			transformedPath = this.pathMappingService.transformPath(sourcePath);

			console.log(
				`Path transformation: ${sourcePath} -> ${transformedPath}`,
			);

			return transformedPath;
		}

		if (customDir === "/") {
			return this.file.name;
		}

		if (customDir.startsWith("/")) {
			let i = 0;

			// 找到第一个非 '/' 字符的位置
			while (i < customDir.length && customDir[i] === "/") {
				i++;
			}
			// 截取字符串从第一个非 '/' 字符的位置开始
			customDir = customDir.substring(i);
		}

		//替换非法路径前缀，/，#，空格,
		if (!customDir.endsWith("/")) {
			customDir = customDir + "/";
		}

		//e.g.  path1/path2/name.md
		sourcePath = customDir + this.file.name;
		transformedPath = this.pathMappingService.transformPath(sourcePath);

		return transformedPath;
	}
}
