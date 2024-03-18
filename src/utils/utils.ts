import { Base64 } from "js-base64";
import sha1 from "crypto-js/sha1";
import { PathRewriteRules } from "../repositoryConnection/DigitalGardenSiteManager";
import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gitHashObject = require("git-hash-object");
const REWRITE_RULE_DELIMITER = ":";

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;

	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}

	return Base64.btoa(binary);
}

function extractBaseUrl(url: string) {
	return (
		url &&
		url.replace("https://", "").replace("http://", "").replace(/\/$/, "")
	);
}

function generateUrlPath(filePath: string, slugifyPath = true): string {
	if (!filePath) {
		return filePath;
	}

	const extensionLessPath = filePath.contains(".")
		? filePath.substring(0, filePath.lastIndexOf("."))
		: filePath;

	if (!slugifyPath) {
		return extensionLessPath + "/";
	}

	return (
		extensionLessPath
			.split("/")
			// .map((x) =>
			// 	slugify(x, {
			// 		preserveLeadingUnderscore: true,
			// 		preserveCharacters: ["_"],
			// 	}),
			// )
			.join("/") + "/"
	);
}

function generateBlobHash(content: string) {
	const byteLength = new TextEncoder().encode(content).byteLength;
	const header = `blob ${byteLength}\0`;
	const gitBlob = header + content;

	return sha1(gitBlob).toString();
}

function localImgHashFromBuffer(buffer: Buffer) {
	return gitHashObject(buffer);
}

function localImgHashFromFullPath(path: string) {
	try {
		const buffer = getFileBuffer(path);

		return gitHashObject(buffer);
	} catch (err) {
		console.error(err);

		return "";
	}
}

function getFileBuffer(filePath: string): Buffer {
	// eslint-disable-next-line no-useless-catch
	try {
		return fs.readFileSync(filePath);
	} catch (err) {
		throw err;
	}
}

function kebabize(str: string) {
	return str
		.split("")
		.map((letter, idx) => {
			return letter.toUpperCase() === letter
				? `${idx !== 0 ? "-" : ""}${letter.toLowerCase()}`
				: letter;
		})
		.join("");
}

const wrapAround = (value: number, size: number): number => {
	return ((value % size) + size) % size;
};

function getRewriteRules(pathRewriteRules: string): PathRewriteRules {
	return pathRewriteRules
		.split("\n")
		.filter((line: string) => line.includes(REWRITE_RULE_DELIMITER))
		.map((line: string) => {
			const [searchPath, newPath] = line.split(REWRITE_RULE_DELIMITER);

			return { from: searchPath, to: newPath };
		});
}

function getGardenPathForNote(
	vaultPath: string,
	rules: PathRewriteRules,
): string {
	for (const { from, to } of rules) {
		if (vaultPath && vaultPath.startsWith(from)) {
			const newPath = vaultPath.replace(from, to);

			// remote leading slash if to = ""
			if (newPath.startsWith("/")) {
				return newPath.replace("/", "");
			}

			return newPath;
		}
	}

	return vaultPath;
}

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function fixSvgForXmlSerializer(svgElement: SVGSVGElement): void {
	// Insert a comment in the style tags to prevent XMLSerializer from self-closing it during serialization.
	const styles = svgElement.getElementsByTagName("style");

	if (styles.length > 0) {
		for (let i = 0; i < styles.length; i++) {
			const style = styles[i];

			if (!style.textContent?.trim()) {
				style.textContent = "/**/";
			}
		}
	}
}

function sanitizePermalink(permalink: string): string {
	if (!permalink.endsWith("/")) {
		permalink += "/";
	}

	if (!permalink.startsWith("/")) {
		permalink = "/" + permalink;
	}

	return permalink;
}

/**
 * remove / prefix, add / suffix
 * @param path
 */
function formatPath(path: string): string {
	if (!path) {
		return "";
	}

	if (path.trim() === "/") {
		return "";
	}

	if (path.startsWith("/")) {
		let i = 0;

		// 找到第一个非 '/' 字符的位置
		while (i < path.length && path[i] === "/") {
			i++;
		}
		// 截取字符串从第一个非 '/' 字符的位置开始
		path = path.substring(i);
	}

	if (!path.endsWith("/")) {
		path = path + "/";
	}

	return path;
}

export {
	arrayBufferToBase64,
	extractBaseUrl,
	generateUrlPath,
	generateBlobHash,
	localImgHashFromFullPath,
	localImgHashFromBuffer,
	kebabize,
	wrapAround,
	getRewriteRules,
	getGardenPathForNote,
	escapeRegExp,
	fixSvgForXmlSerializer,
	sanitizePermalink,
	formatPath,
};
