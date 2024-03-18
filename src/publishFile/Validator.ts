import { FrontMatterCache } from "obsidian";
import { errorNotice } from "../utils/NoticeUtils";

export const hasPublishFlag = (
	frontMatter?: FrontMatterCache,
	publishKeyName?: string,
): boolean => !!frontMatter?.[publishKeyName || "dg-publish"];

export function isPublishFrontmatterValid(
	frontMatter?: FrontMatterCache,
	publishKeyName?: string,
): boolean {
	if (!hasPublishFlag(frontMatter, publishKeyName)) {
		errorNotice(
			`Note does not have the ${publishKeyName || "dg-publish"}: true set. Please add this and try again.`,
		);

		return false;
	}

	return true;
}
