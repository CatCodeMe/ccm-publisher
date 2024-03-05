<script lang="ts">
	import { getIcon } from "obsidian";
	import TreeNode from "../../models/TreeNode";
	import {
		IPublishStatusManager,
		PublishStatus,
	} from "../../publisher/PublishStatusManager";
	import TreeView from "src/ui/TreeView/TreeView.svelte";
	import { onMount } from "svelte";
	import Publisher from "src/publisher/Publisher";
	import Icon from "../../ui/Icon.svelte";
	import { CompiledPublishFile } from "src/publishFile/PublishFile";
	import PathPair from "../../models/PathPair";

	export let publishStatusManager: IPublishStatusManager;
	export let publisher: Publisher;
	export let showDiff: (path: PathPair) => void;
	export let close: () => void;

	let publishStatus: PublishStatus;
	let showPublishingView: boolean = false;

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
		stat.unPub.total = publishStatus.unpublishedNotes?.length || 0;
		stat.change.total = publishStatus.changedNotes?.length || 0;

		stat.del.total =
			(publishStatus.deletedNotePaths?.length || 0) +
			(publishStatus.deletedImagePaths?.length || 0);

		stat.published = publishStatus.publishedNotes?.length || 0;
	}

	onMount(getPublishStatus);

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
		};

		for (const pathPair of filePaths) {
			// const pathComponents = filePath.localPath.split("/");

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
			publishStatus.publishedNotes.map(
				(note) =>
					new PathPair(
						note.meta.getCustomPath(),
						note.meta.getCustomPath(),
					),
			),
			"Published Notes",
		);

	$: changedNotesTree =
		publishStatus &&
		filePathsToTree(
			publishStatus.changedNotes.map(
				(note) =>
					new PathPair(note.getPath(), note.meta.getCustomPath()),
			),
			"Changed Notes",
		);

	$: deletedNoteTree =
		publishStatus &&
		filePathsToTree(
			[
				...publishStatus.deletedNotePaths,
				...publishStatus.deletedImagePaths,
			].map((path) => new PathPair(path.path, "")),
			"Deleted Notes",
		);

	$: unpublishedNoteTree =
		publishStatus &&
		filePathsToTree(
			publishStatus.unpublishedNotes.map(
				(note) => new PathPair(note.getPath(), ""),
			),
			"Unpublished Notes",
		);

	$: publishProgress =
		((publishedPaths.length + failedPublish.length) /
			(unpublishedToPublish.length +
				changedToPublish.length +
				pathsToDelete.length)) *
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

	let unpublishedToPublish: Array<CompiledPublishFile> = [];
	let changedToPublish: Array<CompiledPublishFile> = [];
	let pathsToDelete: Array<string> = [];

	let processingPaths: Array<string> = [];
	let publishedPaths: Array<string> = [];
	let failedPublish: Array<string> = [];

	const publishMarkedNotes = async () => {
		if (!unpublishedNoteTree || !changedNotesTree) return;

		if (!publishStatus) {
			throw new Error("Publish status is undefined");
		}

		const unpublishedPaths = traverseTree(unpublishedNoteTree!);
		const changedPaths = traverseTree(changedNotesTree!);

		pathsToDelete = traverseTree(deletedNoteTree!);

		const notesToDelete = pathsToDelete.filter((path) =>
			publishStatus.deletedNotePaths.some((p) => p.path === path),
		);

		const imagesToDelete = pathsToDelete.filter((path) =>
			publishStatus.deletedImagePaths.some((p) => p.path === path),
		);

		unpublishedToPublish =
			publishStatus.unpublishedNotes.filter((note) =>
				unpublishedPaths.includes(note.getPath()),
			) ?? [];

		changedToPublish =
			publishStatus?.changedNotes.filter((note) =>
				changedPaths.includes(note.getPath()),
			) ?? [];

		showPublishingView = true;

		for (const note of changedToPublish.concat(unpublishedToPublish)) {
			processingPaths.push(note.getPath());
			let isPublished = await publisher.publish(note);

			processingPaths = processingPaths.filter(
				(path) => path !== note.getPath(),
			);

			if (isPublished) {
				publishedPaths = [...publishedPaths, note.getPath()];
			} else {
				failedPublish = [...failedPublish, note.getPath()];
			}
		}

		for (const path of [...notesToDelete, ...imagesToDelete]) {
			processingPaths.push(path);
			const isNote = path.endsWith(".md");
			let isDeleted: boolean;

			if (isNote) {
				const sha = publishStatus.deletedNotePaths.find(
					(p) => p.path === path,
				)?.sha;

				isDeleted = await publisher.deleteNote(path, sha);
			} else {
				const sha = publishStatus.deletedImagePaths.find(
					(p) => p.path === path,
				)?.sha;
				// TODO: remove with sha
				isDeleted = await publisher.deleteImage(path, sha);
			}

			processingPaths = processingPaths.filter((p) => p !== path);

			if (isDeleted) {
				publishedPaths = [...publishedPaths, path];
			} else {
				failedPublish = [...failedPublish, path];
			}
		}
	};

	const emptyNode: TreeNode = {
		name: "",
		isRoot: false,
		path: "",
		indeterminate: false,
		checked: false,
		remotePath: "",
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
						unpublishedToPublish.length +
						changedToPublish.length +
						pathsToDelete.length
					} notes published`}
				</div>

				{#if failedPublish.length > 0}
					<div>
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

			{#each unpublishedToPublish.concat(changedToPublish) as note}
				<div class="note-list">
					{#if processingPaths.includes(note.getPath())}
						{@html rotatingCog()?.outerHTML}
					{:else if publishedPaths.includes(note.getPath())}
						<Icon name="check" />
					{:else if failedPublish.includes(note.getPath())}
						<Icon name="cross" />
					{:else}
						<Icon name="clock" />
					{/if}
					{note.file.name}
					{#if publishedPaths.includes(note.getPath())}
						<span class="published"> - PUBLISHED</span>
					{/if}
				</div>
			{/each}

			{#each pathsToDelete as path}
				<div class="note-list">
					{#if processingPaths.includes(path)}
						{@html rotatingCog()?.outerHTML}
					{:else if publishedPaths.includes(path)}
						<Icon name="check" />
					{:else}
						<Icon name="clock" />
					{/if}
					{path.split("/").last()}

					{#if publishedPaths.includes(path)}
						<span class="deleted"> - DELETED</span>
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
		color: #8bff8b;
	}

	.deleted {
		color: #ff5757;
	}

	.viewContent {
		max-height: 300px;
		overflow: auto;
		scrollbar-width: thin;
	}
</style>
