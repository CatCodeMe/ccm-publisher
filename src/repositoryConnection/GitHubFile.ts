import { CompiledPublishFile } from "../publishFile/PublishFile";
import { Asset } from "../compiler/GardenPageCompiler";

export class GitHubFile {
	content?: string | undefined;
	path: string;
	sha?: string | null | undefined;
	type?: "tree" | "blob" | "commit" | undefined;
	mode: "100644" | "100755" | "040000" | "160000" | "120000" | undefined =
		"100644";
	constructor(remotePath: string) {
		this.path = remotePath;
	}

	static noteForUpload(file: CompiledPublishFile): GitHubFile {
		const gitHubFile = new GitHubFile(file.meta.getCustomRemotePath());
		gitHubFile.type = "blob";
		const [text, _] = file.compiledFile;
		gitHubFile.content = text;

		return gitHubFile;
	}

	static imgForUpload(asset: Asset): GitHubFile {
		const gitHubFile = new GitHubFile(asset.remotePath);
		gitHubFile.type = "blob";
		gitHubFile.content = asset.content;

		if (asset.remoteHash) {
			gitHubFile.sha = asset.remoteHash;
		}

		return gitHubFile;
	}

	static fileForDelete(remotePath: string): GitHubFile {
		const gitHubFile = new GitHubFile(remotePath);
		gitHubFile.type = "blob";
		gitHubFile.sha = null;

		return gitHubFile;
	}
}
