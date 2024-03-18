import { Octokit } from "@octokit/core";
import { GitHubFile } from "./GitHubFile";

interface IOctokitterInput {
	githubToken: string;
	githubUserName: string;
	gardenRepository: string;
	branchName?: string;
}

interface IPutPayload {
	path: string;
	sha?: string;
	content: string;
	branch?: string;
	message?: string;
}

export class RepositoryConnection {
	private githubUserName: string;
	private gardenRepository: string;
	private branchName?: string;
	octokit: Octokit;

	constructor({
		gardenRepository,
		githubToken,
		githubUserName,
		branchName,
	}: IOctokitterInput) {
		this.gardenRepository = gardenRepository;
		this.githubUserName = githubUserName;
		this.branchName = branchName;

		this.octokit = new Octokit({ auth: githubToken });
	}

	getRepositoryName() {
		return this.githubUserName + "/" + this.gardenRepository;
	}

	getBasePayload() {
		return {
			owner: this.githubUserName,
			repo: this.gardenRepository,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
				Accept: "application/vnd.github+json",
			},
		};
	}

	/** Get filetree with path and sha of each file from repository */
	async getContent(branch: string) {
		try {
			const response = await this.octokit.request(
				`GET /repos/{owner}/{repo}/git/trees/{tree_sha}`,
				{
					...this.getBasePayload(),
					tree_sha: branch,
					recursive: "true",
					// invalidate cache
					headers: {
						"If-None-Match": "",
					},
				},
			);

			if (response.status === 200) {
				return response.data;
			}
		} catch (error) {
			throw new Error(
				`Could not get file ${""} from repository ${this.getRepositoryName()}`,
			);
		}
	}

	async getFile(path: string, branch: string) {
		console.log(
			`Getting file ${path} from repository ${this.getRepositoryName()}`,
		);

		try {
			const response = await this.octokit.request(
				"GET /repos/{owner}/{repo}/contents/{path}",
				{
					...this.getBasePayload(),
					path,
					ref: branch,
				},
			);

			if (
				response.status === 200 &&
				!Array.isArray(response.data) &&
				response.data.type === "file"
			) {
				return response.data;
			}
		} catch (error) {
			throw new Error(
				`Could not get file ${path} from repository ${this.getRepositoryName()}`,
			);
		}
	}

	async updateFile({ path, sha, content, branch, message }: IPutPayload) {
		const payload = {
			...this.getBasePayload(),
			path,
			message: message ?? `Update file ${path}`,
			content,
			sha,
			branch,
		};

		try {
			return await this.octokit.request(
				"PUT /repos/{owner}/{repo}/contents/{path}",
				payload,
			);
		} catch (error) {
			console.error(error);
		}
	}

	async batchPublishFiles(files: GitHubFile[], commitMsg?: string) {
		const baseTree = await this.getContent(this.branchName || "HEAD");

		const baseTreeSha = baseTree?.sha;

		const uploadResp = await this.octokit.request(
			"POST /repos/{owner}/{repo}/git/trees",
			{
				...this.getBasePayload(),
				base_tree: baseTreeSha,
				tree: files,
			},
		);
		const uploadSha = uploadResp.data.sha;

		const commitPayLoad = {
			...this.getBasePayload(),
			message: commitMsg || "push files",
			parents: [baseTreeSha],
			tree: uploadSha,
		};

		const commitResp = await this.octokit.request(
			"POST https://api.github.com/repos/{owner}/{repo}/git/commits",
			commitPayLoad,
		);

		const commitSha = commitResp.data.sha;

		const updateRefPayLoad = {
			...this.getBasePayload(),
			sha: commitSha,
			force: true,
		};

		await this.octokit.request(
			`PATCH https://api.github.com/repos/{owner}/{repo}/git/refs/heads/${this.branchName || "main"}`,
			updateRefPayLoad,
		);
	}
}

export type TRepositoryContent = Awaited<
	ReturnType<typeof RepositoryConnection.prototype.getContent>
>;
