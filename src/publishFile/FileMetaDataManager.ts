import { FrontMatterCache, TFile } from "obsidian";
import DigitalGardenSettings from "../models/settings";
import { DateTime } from "luxon";

// This should soon contain all the magic keys instead of them being hardcoded (with documentation)
export enum FRONTMATTER_KEYS {
	// The file should be published to the garden
	PUBLISH = "dg-publish",
	HOME = "dg-home",
	CUSTOM_PATH = "dg-path",
}

export class FileMetadataManager {
	file: TFile;
	frontmatter: FrontMatterCache;
	settings: DigitalGardenSettings;

	constructor(
		file: TFile,
		frontmatter: FrontMatterCache,
		settings: DigitalGardenSettings,
	) {
		this.file = file;
		this.frontmatter = frontmatter;
		this.settings = settings;
	}

	isHome(): boolean {
		return !!this.frontmatter[FRONTMATTER_KEYS.HOME];
	}

	getCreatedAt(): string {
		const createdKey = this.settings.createdTimestampKey;

		if (createdKey) {
			const customCreatedDate = this.frontmatter[createdKey];

			if (!customCreatedDate) {
				return "";
			}

			return customCreatedDate;
		}

		return DateTime.fromMillis(this.file.stat.ctime).toISO() as string;
	}

	getUpdatedAt(): string {
		const updatedKey = this.settings.updatedTimestampKey;

		if (updatedKey) {
			const customUpdatedDate = this.frontmatter[updatedKey];

			if (!customUpdatedDate) {
				return "";
			}

			return this.frontmatter[updatedKey];
		}

		return DateTime.fromMillis(this.file.stat.mtime).toISO() as string;
	}
	getCustomPath(): string {
		let customDir = this.frontmatter[FRONTMATTER_KEYS.CUSTOM_PATH];

		if (!customDir || customDir.trim() === "") {
			return this.file.path;
		}

		//todo slugify 支持中文和obsidian的规则
		//替换非法路径前缀，/，#，空格,
		// const result = customDir.replace(/^[/\s#]+/, "");
		if (!customDir.trim().endsWith("/")) {
			customDir = customDir.trim() + "/";
		}

		return customDir + this.file.name;
	}
}
