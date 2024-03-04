import { FrontMatterCache, TFile } from "obsidian";
import DigitalGardenSettings from "../models/settings";
import { DateTime } from "luxon";
import { NOTE_PATH_BASE } from "../publisher/Publisher";

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
	getCustomParentPath(): string {
		const customDir = this.frontmatter[FRONTMATTER_KEYS.CUSTOM_PATH];

		if (customDir) {
			return NOTE_PATH_BASE + this.file.name;
		}

		//默认上传到根路径下
		return this.file.path;
	}
}
