<script lang="ts">
	import { getIcon } from "obsidian";
	import {
		ConflictStatus,
		IPublishStatusManager,
	} from "../../publisher/PublishStatusManager";
	import { onMount } from "svelte";

	export let publishStatusManager: IPublishStatusManager;

	let conflictStatus: Array<ConflictStatus>;
	let showPublishingView: boolean = false;

	async function getConflictStatus() {
		conflictStatus = await publishStatusManager.checkConflictPath();
	}

	onMount(getConflictStatus);

	const bigRotatingCog = () => {
		let cog = getIcon("cog");
		cog?.classList.add("dg-rotate");
		cog?.style.setProperty("margin-right", "3px");
		cog?.style.setProperty("width", "40px");
		cog?.style.setProperty("height", "40px");

		return cog;
	};
</script>

<div>
	<hr class="title-separator" />
	{#if !conflictStatus}
		<div class="loading-msg">
			{@html bigRotatingCog()?.outerHTML}
			<div>Calculating publication status from GitHub</div>
		</div>
	{:else if !showPublishingView}
		<div class="viewContent">
			<ul>
				{#each conflictStatus as item}
					<li>
						<p>{item.remotePath}</p>
						<ul>
							{#each item.locaPaths as local}
								<li>{local}</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		</div>

		<hr class="footer-separator" />

		<div class="footer-select">
			<button>PUBLISH SELECTED</button>
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

	.viewContent {
		max-height: 300px;
		overflow: auto;
	}

	hr {
		border-top: var(--hr-thickness) dashed var(--hr-color);
	}
</style>
