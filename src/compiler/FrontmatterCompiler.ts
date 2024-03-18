import { FrontMatterCache } from "obsidian";
import DigitalGardenSettings from "../models/settings";
import { PublishFile } from "../publishFile/PublishFile";

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
		const fileFrontMatter = { ...frontmatter };
		delete fileFrontMatter["position"];

		const publishKey = this.settings.publishKey;

		const publishedFrontMatter: TPublishedFrontMatter = {
			[publishKey]: true,
		};

		const fullFrontMatter = { ...fileFrontMatter, ...publishedFrontMatter };
		const frontMatterString = JSON.stringify(fullFrontMatter);

		return `---\n${frontMatterString}\n---\n`;
	}
}
