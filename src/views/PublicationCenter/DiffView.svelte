<script lang="ts">
	import * as Diff from "diff";
	export let diff: Diff.Change[];
	export let localPath: string;
	export let remotePath: string;
</script>

<div>
	<div class="info callout">
		Differences between your local file and the published file.
		<br />
		The content may look a bit different from your note. This is because it shows
		the note after being processed by the plugin.
	</div>
	<div class="path-container">
		<div class="title">localPath</div>
		<div class="content">{localPath}</div>
		<div class="title">remotePath</div>
		<div class="content">{remotePath}</div>
	</div>
	<hr />
	{#if diff}
		<div>
			{#each diff as part}
				{#if part.added}
					<pre
						style="display: block; background-color: rgba(5, 191, 5, 0.5); color: var(--text-on-accent)">{part.value}</pre>
				{:else if part.removed}
					<pre
						style="display: block; background-color: rgba(221, 22, 11, 0.5); color: var(--text-on-accent)">{part.value}</pre>
				{:else}
					<pre>{part.value}</pre>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	pre {
		display: block;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.path-container {
		display: flex;
		flex-wrap: wrap;
		flex-direction: row;
		/*width: 400px; !* 设置容器宽度 *!*/
	}

	.title {
		font-style: italic;
		font-weight: bold; /* 加粗标题 */
		border: 1px none;
		background-color: rgba(33, 126, 33, 0.5); /* 设置标题背景色 */
		margin-top: 10px;
	}

	.content {
		text-align: left; /* 内容左对齐 */
		width: 100%;
		word-wrap: break-word; /* 控制长单词和 URL 的换行方式 */
		margin-top: 10px;
	}
</style>
