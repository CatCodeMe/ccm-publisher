import { FrontMatterCache } from "obsidian";
import DigitalGardenSettings from "../models/settings";
import { PublishFile } from "../publishFile/PublishFile";
import { formatPath } from "../utils/utils";

export type TFrontmatter = Record<string, unknown> & {
	"dg-path"?: string;
};

export type TPublishedFrontMatter = Record<string, unknown> & {
	tags?: string[];
	metatags?: string;
	pinned?: boolean;
	permalink?: string;
	hide?: boolean;
};

export class FrontmatterCompiler {
	private readonly settings: DigitalGardenSettings;
	constructor(settings: DigitalGardenSettings) {
		this.settings = settings;
	}

	compile(file: PublishFile, frontmatter: FrontMatterCache): string {
		if (!frontmatter) {
			return "";
		}

		const clone = { ...frontmatter };

		const publishedFrontmatter = this.convertFrontmatterImageLinks(
			clone,
			file,
		);

		return JSON.stringify(publishedFrontmatter, null, 2);
	}

	private convertFrontmatterImageLinks(
		frontmatter: FrontMatterCache,
		file: PublishFile,
	): TPublishedFrontMatter {
		const result: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(frontmatter)) {
			if (typeof value === "string") {
				result[key] = this.convertImageLink(value, file);
			} else {
				result[key] = value;
			}
		}

		return result as TPublishedFrontMatter;
	}

	private convertImageLink(text: string, file: PublishFile): string {
		const imageRegex =
			/!\[\[(.*?)(\.(png|jpg|jpeg|gif|webp))\|(.*?)\]\]|!\[\[(.*?)(\.(png|jpg|jpeg|gif|webp))\]\]/g;

		return text.replace(
			imageRegex,
			(match, name1, ext1, _, meta, name2, ext2) => {
				const imageName = name1 || name2;
				const extension = ext1 || ext2;

				const linkedFile = file.metadataCache.getFirstLinkpathDest(
					imageName + extension,
					file.getPath(),
				);

				if (!linkedFile) {
					return match;
				}

				const remoteImgPath = `${formatPath(this.settings.imgBaseDir)}${linkedFile.path}`;
				return encodeURI(remoteImgPath);
			},
		);
	}
}
