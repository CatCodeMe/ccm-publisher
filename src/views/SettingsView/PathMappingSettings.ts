import { Setting } from "obsidian";
import SettingView from "./SettingView";

export class PathMappingSettings {
	private view: SettingView;
	private containerEl: HTMLElement;

	constructor(view: SettingView, containerEl: HTMLElement) {
		this.view = view;
		this.containerEl = containerEl;

		// 确保 pathMappings 存在
		if (!this.view.settings.pathMappings) {
			this.view.settings.pathMappings = [];
		}

		this.display();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty(); // 清空现有内容

		containerEl.createEl("h2", {
			text: "Path Mappings",
			cls: "setting-category",
		});

		this.renderPathMappings();

		// 添加新映射按钮
		new Setting(containerEl)
			.setClass("path-mapping-add")
			.addButton((button) =>
				button.setButtonText("Add Path Mapping").onClick(async () => {
					this.view.settings.pathMappings.push({
						local: "",
						remote: "",
					});
					await this.view.saveSettings();
					this.display();
				}),
			);
	}

	private renderPathMappings(): void {
		const mappingsContainer =
			this.containerEl.createDiv("path-mappings-list");

		// 确保 pathMappings 存在且是数组
		const mappings = this.view.settings.pathMappings || [];

		mappings.forEach((mapping, index) => {
			new Setting(mappingsContainer)
				.setClass("path-mapping-item")
				.addText((text) =>
					text
						.setPlaceholder("Local Path")
						.setValue(mapping.local || "")
						.onChange(async (value) => {
							this.view.settings.pathMappings[index].local =
								value;

							this.view.debouncedSaveAndUpdate(
								this.view.saveSettings,
							);
						}),
				)
				.addText((text) =>
					text
						.setPlaceholder("Remote Path")
						.setValue(mapping.remote || "")
						.onChange(async (value) => {
							this.view.settings.pathMappings[index].remote =
								value;

							this.view.debouncedSaveAndUpdate(
								this.view.saveSettings,
							);
						}),
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Delete mapping")
						.onClick(async () => {
							this.view.settings.pathMappings.splice(index, 1);
							await this.view.saveSettings();
							this.display();
						}),
				);
		});
	}
}
