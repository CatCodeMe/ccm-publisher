/** Saved to data.json, changing requires a migration */
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
}
