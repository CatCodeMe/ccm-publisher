import { debounce, Setting } from "obsidian";
import SettingView from "./SettingView";
import { Octokit } from "@octokit/core";

export class GithubSettings {
	settings: SettingView;
	connectionStatus: "loading" | "connected" | "error";
	private settingsRootElement: HTMLElement;
	connectionStatusElement: HTMLElement;
	branchStatusElement: HTMLElement;

	constructor(settings: SettingView, settingsRootElement: HTMLElement) {
		this.settings = settings;
		this.settingsRootElement = settingsRootElement;
		this.settingsRootElement.id = "github-settings";
		this.settingsRootElement.classList.add("settings-tab-content");
		this.connectionStatus = "loading";

		this.connectionStatusElement = this.settingsRootElement.createEl(
			"span",
			{ cls: "connection-status" },
		);

		this.branchStatusElement = this.settingsRootElement.createSpan(
			"span",
			(span) => {
				span.style.color = "red";
			},
		);
		this.initializeHeader();
		this.initializeGitHubRepoSetting();
		this.initializeGitHubUserNameSetting();
		this.initializeGitHubTokenSetting();
		this.initialBranchName();
		this.initIgnoreFiles();
	}

	initializeHeader = () => {
		this.connectionStatusElement.style.cssText = "margin-left: 10px;";
		this.checkConnectionAndSaveSettings();

		const githubSettingsHeader = createEl("h3", {
			text: "GitHub Authentication (required)",
		});
		githubSettingsHeader.append(this.connectionStatusElement);
		githubSettingsHeader.prepend(this.settings.getIcon("github"));

		this.settingsRootElement.prepend(githubSettingsHeader);
	};

	checkConnectionAndSaveSettings = async () => {
		this.settings.saveSettings();
		this.debouncedUpdateConnectionStatus();
	};

	updateConnectionStatus = async () => {
		const oktokit = new Octokit({
			auth: this.settings.settings.githubToken,
		});

		try {
			const response = await oktokit.request(
				"GET /repos/{owner}/{repo}",
				{
					owner: this.settings.settings.githubUserName,
					repo: this.settings.settings.githubRepo,
				},
			);

			// If other permissions are needed, add them here and indicate to user on insufficient permissions
			// Github now advocates for hyper-specific tokens
			if (response.data.permissions?.admin) {
				this.connectionStatus = "connected";
			}
		} catch (error) {
			this.connectionStatus = "error";
		}

		try {
			if (this.settings.settings.branchName) {
				const response = await oktokit.request(
					"GET /repos/{owner}/{repo}/branches/{branch}",
					{
						owner: this.settings.settings.githubUserName,
						repo: this.settings.settings.githubRepo,
						branch: this.settings.settings.branchName,
					},
				);

				if (response.status === 200) {
					this.branchStatusElement.innerText = "branch exist ✅";
				}
			}
		} catch (error) {
			this.branchStatusElement.innerText =
				"branch don't exist, need create it ❌";
		}
		this.updateConnectionStatusIndicator();
	};

	debouncedUpdateConnectionStatus = debounce(
		this.updateConnectionStatus,
		500,
		true,
	);

	updateConnectionStatusIndicator = () => {
		if (this.connectionStatus === "loading") {
			this.connectionStatusElement.innerText = "⏳";
		}

		if (this.connectionStatus === "connected") {
			this.connectionStatusElement.innerText = "✅";
		}

		if (this.connectionStatus === "error") {
			this.connectionStatusElement.innerText = "❌";
		}
	};

	private initializeGitHubRepoSetting() {
		new Setting(this.settingsRootElement)
			.setName("GitHub Repo Name")
			.setDesc("The name of the GitHub repository")
			.addText((text) =>
				text
					.setPlaceholder("repo_name")
					.setValue(this.settings.settings.githubRepo)
					.onChange(async (value) => {
						this.settings.settings.githubRepo = value;
						await this.checkConnectionAndSaveSettings();
					}),
			);
	}

	private initializeGitHubUserNameSetting() {
		new Setting(this.settingsRootElement)
			.setName("GitHub Username")
			.setDesc("Your GitHub Username (case insensitive)")
			.addText((text) =>
				text
					.setPlaceholder("myusername")
					.setValue(this.settings.settings.githubUserName)
					.onChange(async (value) => {
						this.settings.settings.githubUserName = value;
						await this.checkConnectionAndSaveSettings();
					}),
			);
	}

	private initializeGitHubTokenSetting() {
		const desc = document.createDocumentFragment();

		desc.createEl("span", undefined, (span) => {
			span.innerText =
				"A GitHub token with repo permissions. You can generate it ";

			span.createEl("a", undefined, (link) => {
				link.href =
					"https://github.com/settings/tokens/new?scopes=repo";
				link.innerText = "here!";
			});
		});

		new Setting(this.settingsRootElement)
			.setName("GitHub Token")
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder("Secret Token")
					.setValue(this.settings.settings.githubToken)
					.onChange(async (value) => {
						this.settings.settings.githubToken = value;
						await this.checkConnectionAndSaveSettings();
					}),
			);
	}

	private initialBranchName() {
		const nameELe = document.createDocumentFragment();

		nameELe.createEl("div", undefined, (div) => {
			div.innerText = "Branch Name ";

			div.append(this.branchStatusElement);
		});

		new Setting(this.settingsRootElement)
			.setName(nameELe)
			.setDesc(
				"pushed branch, now only support one branch, default is main",
			)
			.addText((text) =>
				text
					.setPlaceholder("main")
					.setValue(this.settings.settings.branchName)
					.onChange(async (value) => {
						this.settings.settings.branchName = value;
						await this.checkConnectionAndSaveSettings();
					}),
			);
	}

	private initIgnoreFiles() {
		new Setting(this.settingsRootElement)
			.setName("Ignore Files (Optional)")
			.setDesc(
				"ignored directory and files, don't display in publish center modal",
			)
			.addText((text) =>
				text
					.setPlaceholder(".github,index.md,.gitkeep")
					.setValue(this.settings.settings.ignoredDirOrFiles)
					.onChange(async (value) => {
						if (!value) {
							this.settings.settings.ignoredDirOrFiles = "";
						} else {
							this.settings.settings.ignoredDirOrFiles =
								value.trim();
						}
					}),
			);
	}
}
