<script lang="ts">
	import Node from "./TreeNode.svelte";
	import TreeNode from "src/models/TreeNode";

	export let tree: TreeNode;
	export let readOnly: boolean = false;
	export let enableShowDiff: boolean = false;
	export let showDiff: (path: string) => void;
	export let checkedCnt: number = 0;
	const treeMap: Record<string, TreeNode> = {
		/* child label: parent node */
	};
	function initTreeMap(tree: TreeNode) {
		if (tree.children) {
			for (const child of tree.children) {
				treeMap[child.path] = tree;
				initTreeMap(child);
			}
		}
	}
	initTreeMap(tree);

	function rebuildChildren(node: TreeNode, checkAsParent = true) {
		if (node.children) {
			for (const child of node.children) {
				if (checkAsParent) child.checked = !!node.checked;
				rebuildChildren(child, checkAsParent);
			}

			node.indeterminate =
				node.children.some((c) => c.indeterminate) ||
				(node.children.some((c) => !!c.checked) &&
					node.children.some((c) => !c.checked));
		}
	}

	function rebuildTree(
		e: { detail: { node: TreeNode } },
		checkAsParent = true,
	) {
		const node = e.detail.node;
		let parent = treeMap[node.path];
		rebuildChildren(node, checkAsParent);
		let rootNode: TreeNode;

		while (parent) {
			const allCheck = parent?.children?.every((c) => !!c.checked);

			if (allCheck) {
				parent.indeterminate = false;
				parent.checked = true;
			} else {
				const haveCheckedOrIndeterminate = parent?.children?.some(
					(c) => !!c.checked || c.indeterminate,
				);

				parent.indeterminate = !!haveCheckedOrIndeterminate;
				parent.checked = false;
			}

			rootNode = parent;
			parent = treeMap[parent.path];
		}
		tree = tree;

		if (node.isRoot) {
			rootNode = node;
		}
		checkedCnt = countCheckedLeafNodes(rootNode);
	}

	function countCheckedLeafNodes(node: TreeNode): number {
		let count = 0;

		if (!node) {
			return 0;
		}

		// 检查当前节点是否为叶子节点并且 checked 为 true
		if (node.checked && !node.children) {
			count++;
		} else {
			// 递归检查当前节点的子节点
			if (node.children) {
				for (const child of node.children) {
					count += countCheckedLeafNodes(child);
				}
			}
		}

		return count;
	}

	// init the tree state
	rebuildTree({ detail: { node: tree } }, false);
</script>

<div>
	<Node
		{tree}
		{readOnly}
		{enableShowDiff}
		on:toggle={rebuildTree}
		on:showDiff={(e) => showDiff(e.detail.node.path)}
	/>
</div>

<style>
</style>
