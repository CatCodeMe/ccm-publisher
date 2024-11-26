/** Saved to data.json, changing requires a migration */
export interface PathMapping {
	local: string;
	remote: string;
}

export default interface DigitalGardenSettings {
	githubToken: string;
	githubRepo: string;
	githubUserName: string;

	noteSettingsIsInitialized: boolean;

	ignoredDirOrFiles: string;
	branchName: string;
	notesBaseDir: string;
	imgBaseDir: string;

	publishKey: string;
	pathKey: string;
	refImgKey: string[];

	pathMappings: PathMapping[];
}
