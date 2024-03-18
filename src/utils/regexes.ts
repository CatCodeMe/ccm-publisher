export const FRONTMATTER_REGEX = /^\s*?---\n([\s\S]*?)\n---/g;
export const BLOCKREF_REGEX = /(\^\w+(\n|$))/g;

export const CODE_FENCE_REGEX = /`(.*?)`/g;

export const CODEBLOCK_REGEX = /```.*?\n[\s\S]+?```/g;

export const EXCALIDRAW_REGEX = /:\[\[(\d*?,\d*?)\],.*?\]\]/g;

export const TRANSCLUDED_SVG_REGEX =
	/!\[\[(.*?)(\.(svg))\|(.*?)\]\]|!\[\[(.*?)(\.(svg))\]\]/g;

//dg_path 属性值正则校验
export const DG_PATH_VALUE_REGEX =
	/^\/(?!\/)(?!.*\/{2,})(?!.*[#^|:[\]\\])(?:[^/\s]|(?<!\/)\/(?![/\s]))*(\/[^/\s]*)?\/?$/;
