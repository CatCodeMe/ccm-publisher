import { debounce, Plugin, TFile, Workspace } from "obsidian";
import Publisher from "./src/publisher/Publisher";
import DigitalGardenSettings from "./src/models/settings";
import { PublicationCenter } from "src/views/PublicationCenter/PublicationCenter";
import PublishStatusManager from "src/publisher/PublishStatusManager";
import ObsidianFrontMatterEngine from "src/publishFile/ObsidianFrontMatterEngine";
import DigitalGardenSiteManager from "src/repositoryConnection/DigitalGardenSiteManager";
import { DigitalGardenSettingTab } from "./src/views/DigitalGardenSettingTab";
import { PublishFile } from "./src/publishFile/PublishFile";
import { FRONTMATTER_KEYS } from "./src/publishFile/FileMetaDataManager";
import { DG_PATH_VALUE_REGEX } from "./src/utils/regexes";
import { DEFAULT_CACHE } from "./src/ui/suggest/constants";
import {
	errorNotice,
	normalNotice,
	successNotice,
} from "./src/utils/NoticeUtils";

const DEFAULT_SETTINGS: DigitalGardenSettings = {
	githubRepo: "",
	githubToken: "",
	githubUserName: "",
	noteSettingsIsInitialized: false,
	ignoredDirOrFiles: ".gitignore, .gitkeep, .github",
	imgBaseDir: "/img/user",
	notesBaseDir: "/",
	branchName: "main",
	publishKey: "dg-publish",
	pathKey: "dg-path",
};

export default class DigitalGarden extends Plugin {
	settings!: DigitalGardenSettings;
	appVersion!: string;

	publishModal!: PublicationCenter;

	async onload() {
		this.appVersion = this.manifest.version;

		console.log("Initializing Quartz Publisher plugin v" + this.appVersion);
		await this.loadSettings();

		this.addSettingTab(new DigitalGardenSettingTab(this.app, this));

		await this.addCommands();

		this.addRibbonIcon(
			"arrow-up-right-square",
			"Quartz Publisher",
			async () => {
				this.openPublishModal();
			},
		);

		const settings = this.getSettings();

		//监听input
		document.addEventListener(
			"input",
			debounce((e) => this.checkPath(e, settings), 1000, true),
		);
	}

	onunload() {
		DEFAULT_CACHE.reset().then(() => console.log("缓存已清空"));
		const settings = this.getSettings();

		document.removeEventListener(
			"input",
			debounce((e) => this.checkPath(e, settings), 1000, true),
		);
	}

	private checkPath(event: Event, settings: DigitalGardenSettings) {
		const target = event.target as HTMLElement;

		if (!target) {
			console.log("没有target");

			return;
		}

		if (target.classList.contains("metadata-input-longtext")) {
			// 检查触发事件的元素是否为.metadata-property-key或其子元素
			const metadataKeyElement = target?.parentElement
				?.previousSibling as HTMLElement;

			if (
				metadataKeyElement &&
				metadataKeyElement.classList.contains("metadata-property-key")
			) {
				const propertyKeyEle = metadataKeyElement.querySelector(
					".metadata-property-key-input",
				) as HTMLInputElement;

				const propertyKeyContent = propertyKeyEle.value;

				// 如果属性key为dg-path
				if (settings.pathKey === propertyKeyContent) {
					const pathContent = target.textContent;

					if (pathContent && pathContent.trim()) {
						if (pathContent.trim() === "/") {
							target.textContent = pathContent.trim();

							return;
						}

						// /^\/(?!\/)(?!.*\/{2,})(?!.*[#^|:[\]\\])(?:[^/\s]|(?<!\/)\/(?![/\s]))*(\/[^/\s]*)?\/?$/;
						//不能以特殊字符开头,必须是/开头
						//不允许连续的/
						//不允许任何位置出现特殊字符#^|:[]\
						//不允许任何位置出现空格
						//结尾至多一个/, 可能没有
						if (!DG_PATH_VALUE_REGEX.test(pathContent)) {
							// 如果包含特殊字符，显示提示信息
							const str = "#^|:[]\\";

							errorNotice(
								`property: ${this.settings.pathKey} don't allow these characters: (${str}) and white-space`,
							);
						} else {
							target.textContent = pathContent.trim();
						}
					}
				}
			}
		}
	}
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getSettings() {
		return this.settings;
	}

	async addCommands() {
		// this.addCommand({
		// 	id: "publish-note",
		// 	name: "Publish Single Note",
		// 	callback: async () => {
		// 		await this.publishSingleNote();
		// 	},
		// });

		this.addCommand({
			id: "dg-open-publish-modal",
			name: "Open Publication Center",
			callback: async () => {
				this.openPublishModal();
			},
		});

		this.addCommand({
			id: "dg-mark-note-for-publish",
			name: "Add publish flag",
			callback: async () => {
				this.setPublishFlagValue(true);
			},
		});

		this.addCommand({
			id: "dg-unmark-note-for-publish",
			name: "Remove publish flag",
			callback: async () => {
				this.setPublishFlagValue(false);
			},
		});

		this.addCommand({
			id: "dg-mark-toggle-publish-status",
			name: "Toggle publication status",
			callback: async () => {
				this.togglePublishFlag();
			},
		});
	}

	private getActiveFile(workspace: Workspace) {
		const activeFile = workspace.getActiveFile();

		if (!activeFile) {
			errorNotice(
				"No file is open/active. Please open a file and try again.",
			);

			return null;
		}

		return activeFile;
	}

	async publishSingleNote() {
		let activeFile: TFile | null = null;

		try {
			const { vault, workspace, metadataCache } = this.app;

			activeFile = this.getActiveFile(workspace);

			if (!activeFile) {
				return;
			}

			if (activeFile.extension !== "md") {
				errorNotice(
					"The current file is not a markdown file. Please open a markdown file and try again.",
				);

				return;
			}

			normalNotice("Publishing note...");

			const publisher = new Publisher(
				vault,
				metadataCache,
				this.settings,
			);
			publisher.validateSettings();

			const publishFile = await new PublishFile({
				file: activeFile,
				vault: vault,
				compiler: publisher.compiler,
				metadataCache: metadataCache,
				settings: this.settings,
			}).compile();

			const publishSuccessful = await publisher.publish(publishFile);

			if (publishSuccessful) {
				successNotice(
					`Successfully published note: ${activeFile.path}`,
				);
			}

			return publishSuccessful;
		} catch (e) {
			console.error(e);

			errorNotice(
				`Unable to publish note: ${activeFile?.path}, something went wrong.`,
			);

			return false;
		}
	}

	async setPublishFlagValue(value: boolean) {
		const activeFile = this.getActiveFile(this.app.workspace);

		if (!activeFile) {
			return;
		}

		const engine = new ObsidianFrontMatterEngine(
			this.app.vault,
			this.app.metadataCache,
			activeFile,
		);

		engine
			.set(this.settings.publishKey || FRONTMATTER_KEYS.PUBLISH, value)
			.apply();
	}
	async togglePublishFlag() {
		const activeFile = this.getActiveFile(this.app.workspace);

		if (!activeFile) {
			return;
		}

		const engine = new ObsidianFrontMatterEngine(
			this.app.vault,
			this.app.metadataCache,
			activeFile,
		);

		await engine
			.set(
				this.settings.publishKey || FRONTMATTER_KEYS.PUBLISH,
				!engine.get(
					this.settings.publishKey || FRONTMATTER_KEYS.PUBLISH,
				),
			)
			.apply();
	}

	openPublishModal() {
		if (!this.publishModal) {
			const siteManager = new DigitalGardenSiteManager(
				this.app.metadataCache,
				this.settings,
			);

			const publisher = new Publisher(
				this.app.vault,
				this.app.metadataCache,
				this.settings,
			);

			const publishStatusManager = new PublishStatusManager(
				siteManager,
				publisher,
			);

			this.publishModal = new PublicationCenter(
				this.app,
				publishStatusManager,
				publisher,
				siteManager,
				this.settings,
			);
		}
		this.publishModal.open();
	}
}
