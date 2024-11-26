import DigitalGardenSettings from "../models/settings";

export class PathMappingService {
	constructor(private settings: DigitalGardenSettings) {}

	transformPath(path: string): string {
		let transformedPath = path;

		// 按路径长度排序，确保最长的匹配优先
		const sortedMappings = [...this.settings.pathMappings].sort(
			(a, b) => b.local.length - a.local.length,
		);

		for (const mapping of sortedMappings) {
			if (mapping.local && transformedPath.startsWith(mapping.local)) {
				transformedPath = transformedPath.replace(
					mapping.local,
					mapping.remote || "",
				);
				break;
			}
		}

		// Remove leading forward slash if present
		while (transformedPath.startsWith("/")) {
			transformedPath = transformedPath.substring(1);
		}

		return transformedPath;
	}
}
