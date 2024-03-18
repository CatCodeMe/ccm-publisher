<script lang="ts">
	import {getIcon} from "obsidian";
	import TreeNode from "../../models/TreeNode";
	import {IPublishStatusManager, PublishStatus,} from "../../publisher/PublishStatusManager";
	import TreeView from "src/ui/TreeView/TreeView.svelte";
	import {onMount} from "svelte";
	import Publisher from "src/publisher/Publisher";
	import Icon from "../../ui/Icon.svelte";
	import PathPair from "../../models/PathPair";
	import {GitHubFile} from "../../repositoryConnection/GitHubFile";
	import {flip} from "svelte/animate";

	export let publishStatusManager: IPublishStatusManager;
	export let publisher: Publisher;
	export let showDiff: (path: PathPair) => void;
	export let close: () => void;

	let publishStatus: PublishStatus;
	let showPublishingView: boolean = false;

	let commitMsg = "";
	let stat = {
		unPub: {
			checked: 0,
			total: 0,
		},
		change: {
			checked: 0,
			total: 0,
		},
		del: {
			checked: 0,
			total: 0,
		},
		published: 0,
	};

	async function getPublishStatus() {
		publishStatus = await publishStatusManager.getPublishStatus();

		stat.unPub.total =
			(publishStatus.unpublishedNotes.length || 0) +
			(publishStatus.unpublishedImages.length || 0);

		stat.change.total =
			(publishStatus.changedNotes?.length || 0) +
			(publishStatus.changedImages?.length || 0);

		stat.del.total =
			(publishStatus.deletedNotePaths?.length || 0) +
			(publishStatus.deletedImagePaths?.length || 0);

		stat.published =
			(publishStatus.publishedNotes?.length || 0) +
			(publishStatus.publishedImages?.length || 0);
	}

	onMount(() => getPublishStatus);

	function insertIntoTree(tree: TreeNode, pathPair: PathPair): void {
		let currentNode = tree;

		const pathComponents = pathPair.localPath.split(`/`);

		for (let i = 0; i < pathComponents.length; i++) {
			const part = pathComponents[i];

			if (!currentNode.children) {
				currentNode.children = [];
			}

			let childNode = currentNode.children.find(
				(child) => child.name === part,
			);

			if (!childNode) {
				childNode = {
					name: part,
					isRoot: false,
					path: pathComponents.slice(0, i + 1).join("/"),
					indeterminate: false,
					checked: false,
					remotePath: pathPair.remotePath,
					isImg: pathPair.isImg,
				};
				currentNode.children.push(childNode);
			}

			currentNode = childNode;
		}
	}

	function filePathsToTree(
		filePaths: PathPair[],
		rootName: string = "root",
	): TreeNode {
		const root: TreeNode = {
			name: rootName,
			isRoot: true,
			path: "/",
			indeterminate: false,
			checked: false,
			remotePath: "/",
			isImg: false,
		};

		for (const pathPair of filePaths) {
			insertIntoTree(root, pathPair);
		}

		return root;
	}

	const rotatingCog = () => {
		let cog = getIcon("cog");
		cog?.classList.add("dg-rotate");
		cog?.style.setProperty("margin-right", "3px");

		return cog;
	};
	const bigRotatingCog = () => {
		let cog = getIcon("cog");
		cog?.classList.add("dg-rotate");
		cog?.style.setProperty("margin-right", "3px");
		cog?.style.setProperty("width", "40px");
		cog?.style.setProperty("height", "40px");

		return cog;
	};

	$: publishedNotesTree =
		publishStatus &&
		filePathsToTree(
			//已发布的笔记路径，和github保持一致
			[
				...publishStatus.publishedNotes.map(
					(note) =>
						new PathPair(
							note.meta.getCustomRemotePath(),
							note.meta.getCustomRemotePath(),
							false,
						),
				),
				...publishStatus.publishedImages.map(
					(img) => new PathPair(img.remotePath, img.remotePath, true),
				),
			],
			"Published Notes",
		);

	$: changedNotesTree =
		publishStatus &&
		filePathsToTree(
			[
				...publishStatus.changedNotes.map(
					(note) =>
						new PathPair(
							note.getPath(),
							note.meta.getCustomRemotePath(),
							false,
						),
				),
				...publishStatus.changedImages.map(
					(img) => new PathPair(img.localPath, img.remotePath, true),
				),
			],
			"Changed Notes",
		);

	$: deletedNoteTree =
		publishStatus &&
		filePathsToTree(
			[
				...publishStatus.deletedNotePaths.map(
					(path) =>
						new PathPair(
							path.remotePath,
							path.remotePath,
							false,
							path.sha,
						),
				),
				...publishStatus.deletedImagePaths.map(
					(path) =>
						new PathPair(
							path.remotePath,
							path.remotePath,
							true,
							path.sha,
						),
				),
			],
			"Deleted Notes",
		);

	$: unpublishedNoteTree =
		publishStatus &&
		filePathsToTree(
			[
				...publishStatus.unpublishedNotes.map(
					(note) => new PathPair(note.getPath(), "", false),
				),
				...publishStatus.unpublishedImages.map(
					(img) => new PathPair(img.localPath, "", true),
				),
			],
			"Unpublished Notes",
		);

	$: publishProgress =
		((publishedPaths.length + failedPublish.length) /
			(addOrUpdateImages.length + toUpdateNotes.length)) *
		100;

	const traverseTree = (tree: TreeNode): Array<string> => {
		const paths: Array<string> = [];

		if (tree.children) {
			for (const child of tree.children) {
				paths.push(...traverseTree(child));
			}
		} else {
			if (tree.checked) {
				paths.push(tree.path);
			}
		}

		return paths;
	};

	let processingPaths: Array<string> = [];
	let publishedPaths: string[] = [];
	let failedPublish: string[] = [];

	let addOrUpdateImages: GitHubFile[] = [];
	let toUpdateNotes: GitHubFile[] = [];
	let combineFiles: string[] = [];

	let toPushedFilePath: string[] = [];
	let toDeleteFilesPath: string[] = [];

	const publishMarkedNotes = async () => {
		if (!unpublishedNoteTree || !changedNotesTree) return;

		if (!publishStatus) {
			throw new Error("Publish status is undefined");
		}

		const unpublishedPaths = traverseTree(unpublishedNoteTree!);
		const changedPaths = traverseTree(changedNotesTree!);

		const pathsToDelete = traverseTree(deletedNoteTree!);

		const notesToDelete = pathsToDelete.filter((path) =>
			publishStatus.deletedNotePaths.some((p) => p.remotePath === path),
		);

		const imagesToDelete = pathsToDelete.filter((path) =>
			publishStatus.deletedImagePaths.some((p) => p.remotePath === path),
		);

		const unpublishedToPublish =
			publishStatus.unpublishedNotes.filter((note) =>
				unpublishedPaths.includes(note.getPath()),
			) ?? [];

		const changedToPublish =
			publishStatus?.changedNotes.filter((note) =>
				changedPaths.includes(note.getPath()),
			) ?? [];

		const unpublishedToPublishImages =
			publishStatus.unpublishedImages.filter((note) =>
				unpublishedPaths.includes(note.localPath),
			) ?? [];

		const changedToPublishImages =
			publishStatus.changedImages.filter((note) =>
				changedPaths.includes(note.localPath),
			) ?? [];

		//1. 添加
		//2. 提交
		//3. 更新引用
		const addOrUpdateNotes = [
			...changedToPublish,
			...unpublishedToPublish,
		].map((note) => GitHubFile.noteForUpload(note));
		toPushedFilePath = addOrUpdateNotes.map((f) => f.path);

		const toDeleteFiles = [...notesToDelete, ...imagesToDelete].map(
			(fileRemotePath) => GitHubFile.fileForDelete(fileRemotePath),
		);
		toDeleteFilesPath = toDeleteFiles.map((f) => f.path);

		toUpdateNotes = [
			...addOrUpdateNotes,
			// ...addOrUpdateImages,
			...toDeleteFiles,
		];

		addOrUpdateImages = [
			...changedToPublishImages,
			...unpublishedToPublishImages,
		].map((note) => GitHubFile.imgForUpload(note));

		toPushedFilePath = [
			...toPushedFilePath,
			...addOrUpdateImages.map((f) => f.path),
		];

		combineFiles = [
			...addOrUpdateImages.map((f) => f.path),
			...toUpdateNotes.map((f) => f.path),
		];

		if (toUpdateNotes.length > 0 || addOrUpdateImages.length > 0) {
			showPublishingView = true;

			const uploadResult = await publisher.batchPublish(
				toUpdateNotes,
				commitMsg,
			);

			if (uploadResult) {
				publishedPaths = [
					...publishedPaths,
					...toUpdateNotes.map((gf) => gf.path),
				];
			} else {
				failedPublish = [
					...failedPublish,
					...toUpdateNotes.map((gf) => gf.path),
				];
			}

			for (let i = addOrUpdateImages.length - 1; i >= 0; i--) {
				let image = addOrUpdateImages[i];

				const updateResult = await publisher.updateImage(
					image,
					commitMsg,
				);

				if (updateResult) {
					publishedPaths = [...publishedPaths, image.path];
				} else {
					failedPublish = [...failedPublish, image.path];
				}
			}

			combineFiles = [
				...failedPublish.sort((a, b) => a?.localeCompare(b)),
				...publishedPaths.sort((a, b) => a?.localeCompare(b)),
			];
		} else {
			close();
		}
	};

	const emptyNode: TreeNode = {
		name: "",
		isRoot: false,
		path: "",
		indeterminate: false,
		checked: false,
		remotePath: "",
		isImg: false,
	};
</script>

<div>
	<hr class="title-separator" />
	{#if !publishStatus}
		<div class="loading-msg">
			{@html bigRotatingCog()?.outerHTML}
			<div>Calculating publication status from GitHub</div>
		</div>
	{:else if !showPublishingView}
		<div class="viewContent">
			<TreeView
				tree={unpublishedNoteTree ?? emptyNode}
				{showDiff}
				bind:checkedCnt={stat.unPub.checked}
			/>

			<TreeView
				tree={changedNotesTree ?? emptyNode}
				{showDiff}
				enableShowDiff={true}
				bind:checkedCnt={stat.change.checked}
			/>

			<TreeView
				tree={deletedNoteTree ?? emptyNode}
				{showDiff}
				bind:checkedCnt={stat.del.checked}
			/>

			<TreeView
				readOnly={true}
				tree={publishedNotesTree ?? emptyNode}
				{showDiff}
			/>
		</div>
		<hr class="footer-separator" />
		<input
			id="commit-msg"
			placeholder="commit msg"
			type="text"
			bind:value={commitMsg}
		/>
		<hr class="footer-separator" />

		<div class="footer-select">
			<span title="Unpublished Notes"
				>⬆️<span style="color: red"> {stat.unPub.checked}</span><span
					>/{stat.unPub.total}</span
				>
			</span>

			<span title="Changed Notes"
				><span style="color: dodgerblue">🔂 {stat.change.checked}</span
				><span>/{stat.change.total}</span></span
			>

			<span title="Deleted Notes"
				><span style="color: gray">❌ {stat.del.checked}</span><span
					>/{stat.del.total}</span
				></span
			>

			<span title="Published Notes"
				><span style="color: forestgreen">✅ {stat.published}</span>
			</span>
			<button on:click={publishMarkedNotes}>PUBLISH SELECTED</button>
		</div>
	{:else}
		<div>
			<div class="callout">
				<div class="callout-title-inner">Publishing Notes</div>
				<div>
					{`${publishedPaths.length} of ${
						addOrUpdateImages.length + toUpdateNotes.length
					} notes published`}
				</div>

				{#if failedPublish.length > 0}
					<div class="failed-stat">
						{`(${failedPublish.length} failed)`}
					</div>
				{/if}
				<div class="loading-container">
					<div
						class="loading-bar"
						style="width: {publishProgress}%"
					/>
				</div>
			</div>

			{#each combineFiles as fpath (fpath)}
				<div class="note-list" animate:flip>
					{#if processingPaths.includes(fpath)}
						<span>{@html rotatingCog()?.outerHTML}</span> {fpath}
					{:else if publishedPaths.includes(fpath)}
						<span><Icon name="check" /></span> {fpath}
					{:else if failedPublish.includes(fpath)}
						<span class="failed-path"><Icon name="cross" /> </span>
						{fpath}
					{:else}
						<span><Icon name="clock" /> </span> {fpath}
					{/if}
					{#if publishedPaths.includes(fpath)}
						{#if toPushedFilePath.includes(fpath)}
							<span class="published"> - PUBLISHED</span>
						{:else if toDeleteFilesPath.includes(fpath)}
							<span class="deleted"> - DELETED</span>
						{/if}
					{/if}
				</div>
			{/each}

			<hr class="footer-separator" />
			<div class="footer-done">
				<button on:click={close}>DONE</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.title-separator {
		margin-top: 0;
		margin-bottom: 15px;
	}

	.footer-separator {
		margin-top: 15px;
		margin-bottom: 15px;
	}

	.footer-select {
		display: flex;
		justify-content: space-between;

		& > span {
			display: flex;
			align-items: center;
		}
	}

	.footer-done {
		float: right;
	}

	.loading-msg {
		font-size: 1.2rem;
		display: flex;
		align-items: center;
		flex-direction: column;
	}

	button {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		font-weight: bold;
	}

	.loading-container {
		width: 100%;
		height: 5px;
		margin-top: 10px;
	}

	.loading-bar {
		background-color: var(--interactive-accent);
		height: 100%;
		transition: all 0.5s ease-in-out;
	}

	.published {
		color: rgba(33, 126, 33, 0.5);
	}

	.deleted {
		color: #ff5757;
	}

	.failed-stat {
		color: #ff5757;
	}

	.viewContent {
		max-height: 300px;
		overflow: auto;
	}

	input#commit-msg {
		width: 80%;
		border: 2px solid #ced4da;
		height: 2rem;
		border-radius: var(--radius-s);
	}

	hr {
		border-top: var(--hr-thickness) dashed var(--hr-color);
	}

	.note-list > span:first-child {
		position: relative;
		top: 5px;
	}
	.failed-path {
		color: #ff5757;
	}
</style>
