import { debounce, Setting } from "obsidian";
import SettingView from "./SettingView";
import { DG_PATH_VALUE_REGEX } from "../../utils/regexes";
import { errorNotice } from "../../utils/NoticeUtils";
import { PathMappingSettings } from "./PathMappingSettings";

export class NoteSettings {
	settings: SettingView;
	private settingsRootElement: HTMLElement;

	constructor(settings: SettingView, settingsRootElement: HTMLElement) {
		this.settings = settings;
		this.settingsRootElement = settingsRootElement;
		this.settingsRootElement.id = "note-settings";
		this.settingsRootElement.classList.add("settings-tab-content");

		this.initializeHeader();
		this.initialNotesBaseDir();
		this.initialImgBaseDir();
		this.initialPublishKey();
		this.initialPathKey();

		// Add path mapping settings
		const pathMappingContainer = this.settingsRootElement.createEl("div", {
			cls: "path-mapping-settings",
		});
		new PathMappingSettings(this.settings, pathMappingContainer);
	}

	initializeHeader = () => {
		const header = createEl("h3", {
			text: "Note Settings",
		});
		header.prepend(this.settings.getIcon("notebook"));

		this.settingsRootElement.prepend(header);
	};

	checkPath = async (inputPath: string, item: string) => {
		if (!DG_PATH_VALUE_REGEX.test(inputPath)) {
			// 如果包含特殊字符，显示提示信息
			const str = "#^|:[]\\";

			errorNotice(
				`${item} don't allow these character: ${str} and white-space`,
			);

			return false;
		}

		return true;
	};

	debouncedCheckPath = debounce(this.checkPath, 500, true);

	private initialNotesBaseDir() {
		new Setting(this.settingsRootElement)
			.setName("Note Base Directory")
			.setDesc(
				"your notes will be pushed to this directory, if you don't need a specific directory",
			)
			.addText((text) =>
				text
					.setPlaceholder("/")
					.setValue(this.settings.settings.notesBaseDir)
					.onChange(async (value) => {
						if (!value || value.trim().length === 0) {
							errorNotice("note base directory can't be empty");

							return;
						}

						if (
							this.debouncedCheckPath(
								value.trim(),
								"【Note Base Directory】",
							)
						) {
							this.settings.settings.notesBaseDir = value.trim();
							await this.settings.saveSettings();
						}
					}),
			);
	}

	private initialImgBaseDir() {
		new Setting(this.settingsRootElement)
			.setName("Image and Resources Base Directory")
			.setDesc(
				"like Note Base Directory, but for resources that embedded in you notes",
			)
			.addText((text) =>
				text
					.setPlaceholder("/img/user/")
					.setValue(this.settings.settings.imgBaseDir)
					.onChange(async (value) => {
						if (!value || value.trim().length === 0) {
							errorNotice("image directory can't be empty");

							return;
						}

						if (
							this.debouncedCheckPath(
								value.trim(),
								"【Image and Resources Base Directoryl】",
							)
						) {
							this.settings.settings.imgBaseDir = value.trim();
							await this.settings.saveSettings();
						}
					}),
			);
	}

	private initialPublishKey() {
		new Setting(this.settingsRootElement)
			.setName("Publish Key In Frontmatter")
			.setDesc(
				"name of publish-key, notes will be published when value is true",
			)
			.addText((text) =>
				text
					.setPlaceholder("dg-publish")
					.setValue(this.settings.settings.publishKey)
					.onChange(async (value) => {
						this.settings.settings.publishKey = value.trim();
						await this.settings.saveSettings();
					}),
			);
	}

	private initialPathKey() {
		new Setting(this.settingsRootElement)
			.setName("Path Key In Frontmatter")
			.setDesc(
				"name of custom path key, notes will be published to correspond directory",
			)
			.addText((text) =>
				text
					.setPlaceholder("dg-path")
					.setValue(this.settings.settings.pathKey)
					.onChange(async (value) => {
						this.settings.settings.publishKey = value.trim();
						await this.settings.saveSettings();
					}),
			);
	}
}
