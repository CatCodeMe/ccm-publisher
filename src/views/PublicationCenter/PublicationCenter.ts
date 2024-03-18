import { type App, getIcon, Modal, TFile, Vault } from "obsidian";
import DigitalGardenSettings from "../../models/settings";
import { PublishFile } from "../../publishFile/PublishFile";
import DigitalGardenSiteManager from "../../repositoryConnection/DigitalGardenSiteManager";
import PublishStatusManager from "../../publisher/PublishStatusManager";
import Publisher from "../../publisher/Publisher";
import PublicationCenterSvelte from "./PublicationCenter.svelte";
import DiffView from "./DiffView.svelte";
import * as Diff from "diff";
import PathPair from "../../models/PathPair";
import { DEFAULT_CACHE } from "../../ui/suggest/constants";

export class PublicationCenter {
	modal: Modal;
	settings: DigitalGardenSettings;
	publishStatusManager: PublishStatusManager;
	publisher: Publisher;
	siteManager: DigitalGardenSiteManager;
	vault: Vault;

	publicationCenterUi!: PublicationCenterSvelte;

	constructor(
		app: App,
		publishStatusManager: PublishStatusManager,
		publisher: Publisher,
		siteManager: DigitalGardenSiteManager,
		settings: DigitalGardenSettings,
	) {
		this.modal = new Modal(app);
		this.settings = settings;
		this.publishStatusManager = publishStatusManager;
		this.publisher = publisher;
		this.siteManager = siteManager;
		this.vault = app.vault;

		this.modal.titleEl
			.createEl("span", { text: "Publication Center" })
			.prepend(this.getIcon("book-up"));
	}

	getIcon(name: string): Node {
		const icon = getIcon(name) ?? document.createElement("span");

		if (icon instanceof SVGSVGElement) {
			icon.style.marginRight = "4px";
		}

		return icon;
	}

	private showDiff = async (pathPair: PathPair) => {
		try {
			const remoteContent = await this.siteManager.getNoteContent(
				pathPair.remotePath,
			);

			const localFile = this.vault.getAbstractFileByPath(
				pathPair.localPath,
			);

			const localPublishFile = new PublishFile({
				file: localFile as TFile,
				vault: this.vault,
				compiler: this.publisher.compiler,
				metadataCache: this.publisher.metadataCache,
				settings: this.settings,
			});

			if (localFile instanceof TFile && !pathPair.isImg) {
				const [localContent, _] =
					await this.publisher.compiler.generateMarkdown(
						localPublishFile,
					);

				const diff = Diff.diffLines(remoteContent, localContent);
				let diffView: DiffView | undefined;
				const diffModal = new Modal(this.modal.app);

				diffModal.titleEl
					.createEl("span", { text: `${localFile.basename}` })
					.prepend(this.getIcon("file-diff"));

				diffModal.onOpen = () => {
					diffView = new DiffView({
						target: diffModal.contentEl,
						props: {
							diff: diff,
							localPath: pathPair.localPath,
							remotePath: pathPair.remotePath,
						},
					});
				};

				this.modal.onClose = () => {
					if (diffView) {
						diffView.$destroy();
					}
				};

				diffModal.open();
			}
		} catch (e) {
			console.error(e);
		}
	};
	open = () => {
		this.modal.onClose = () => {
			this.publicationCenterUi.$destroy();

			DEFAULT_CACHE.reset().then(() => {
				console.log("关闭弹窗, 清空缓存");
			});
		};

		this.modal.onOpen = () => {
			this.modal.contentEl.empty();

			this.publicationCenterUi = new PublicationCenterSvelte({
				target: this.modal.contentEl,
				props: {
					publishStatusManager: this.publishStatusManager,
					publisher: this.publisher,
					showDiff: this.showDiff,
					close: () => {
						this.modal.close();
					},
				},
			});
		};

		this.modal.open();
	};
}
