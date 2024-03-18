import { debounce, getIcon } from "obsidian";

import DigitalGardenSettings from "../../models/settings";
import { GithubSettings } from "./GithubSettings";
import { normalNotice, successNotice } from "../../utils/NoticeUtils";
import { NoteSettings } from "./NoteSettings";

export default class SettingView {
	settings: DigitalGardenSettings;
	saveSettings: () => Promise<void>;
	private settingsRootElement: HTMLElement;

	debouncedSaveAndUpdate = debounce(this.saveSiteSettings, 500, true);

	constructor(
		settingsRootElement: HTMLElement,
		settings: DigitalGardenSettings,
		saveSettings: () => Promise<void>,
	) {
		this.settingsRootElement = settingsRootElement;
		this.settingsRootElement.classList.add("dg-settings");
		this.settings = settings;
		this.saveSettings = saveSettings;
	}

	getIcon(name: string): Node {
		return getIcon(name) ?? document.createElement("span");
	}

	async initialize() {
		this.settingsRootElement.empty();

		this.settingsRootElement.createEl("h1", {
			text: "Publisher Settings",
		});

		const githubSettings = this.settingsRootElement.createEl("div", {
			cls: "connection-status",
		});

		new GithubSettings(this, githubSettings);

		const noteSettings = this.settingsRootElement.createEl("div", {
			cls: "note-setting",
		});
		new NoteSettings(this, noteSettings);
	}

	private async saveSiteSettings(saveSettings: () => Promise<void>) {
		normalNotice("Updating settings...");
		await saveSettings();
		successNotice("Settings successfully updated!");
	}
}
