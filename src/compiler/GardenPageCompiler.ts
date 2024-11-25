import {
	arrayBufferToBase64,
	getLinkpath,
	MetadataCache,
	TFile,
	Vault,
} from "obsidian";
import DigitalGardenSettings from "../models/settings";
import {
	fixSvgForXmlSerializer,
	formatPath,
	localImgHashFromBuffer,
} from "../utils/utils";
import { fixMarkdownHeaderSyntax } from "../utils/markdown";
import {
	CODE_FENCE_REGEX,
	CODEBLOCK_REGEX,
	EXCALIDRAW_REGEX,
	FRONTMATTER_REGEX,
	TRANSCLUDED_SVG_REGEX,
} from "../utils/regexes";
import { DataviewCompiler } from "./DataviewCompiler";
import { PublishFile } from "../publishFile/PublishFile";
import { DEFAULT_CACHE } from "../ui/suggest/constants";

export interface Asset {
	content: string;
	remotePath: string;
	// not set yet
	remoteHash?: string;
	localHash?: string;
	localPath: string;
}
export interface Assets {
	images: Array<Asset>;
}

export type TCompiledFile = [string, Assets];

export type TCompilerStep = (
	publishFile: PublishFile,
) =>
	| ((partiallyCompiledContent: string) => Promise<string>)
	| ((partiallyCompiledContent: string) => string);

export class GardenPageCompiler {
	private readonly vault: Vault;
	private readonly settings: DigitalGardenSettings;
	private metadataCache: MetadataCache;

	constructor(
		vault: Vault,
		settings: DigitalGardenSettings,
		metadataCache: MetadataCache,
	) {
		this.vault = vault;
		this.settings = settings;
		this.metadataCache = metadataCache;
	}

	runCompilerSteps =
		(file: PublishFile, compilerSteps: TCompilerStep[]) =>
		async (text: string): Promise<string> => {
			return await compilerSteps.reduce(
				async (previousStep, compilerStep) => {
					const previousStepText = await previousStep;

					return compilerStep(file)(previousStepText);
				},
				Promise.resolve(text),
			);
		};

	async generateMarkdown(file: PublishFile): Promise<TCompiledFile> {
		const vaultFileText = await file.cachedRead();

		// ORDER MATTERS!
		const COMPILE_STEPS: TCompilerStep[] = [
			this.convertFrontMatter,
			// this.createBlockIDs,
			// this.createTranscludedText(0),
			this.convertDataViews,
			this.convertLinksToFullPath,
			this.removeObsidianComments,
			//todo 待测试svg图片, 为什么是单独处理的
			this.createSvgEmbeds,
		];

		const compiledText = await this.runCompilerSteps(
			file,
			COMPILE_STEPS,
		)(vaultFileText);

		const [text, images] = await this.convertImageLinks(file)(compiledText);

		return [text, { images }];
	}

	removeObsidianComments: TCompilerStep = () => (text) => {
		const obsidianCommentsRegex = /%%.+?%%/gms;
		const obsidianCommentsMatches = text.match(obsidianCommentsRegex);

		const codeBlocks = text.match(CODEBLOCK_REGEX) || [];
		const codeFences = text.match(CODE_FENCE_REGEX) || [];
		const excalidraw = text.match(EXCALIDRAW_REGEX) || [];
		const matchesToSkip = [...codeBlocks, ...codeFences, ...excalidraw];

		if (!obsidianCommentsMatches) return text;

		for (const commentMatch of obsidianCommentsMatches) {
			//If comment is in a code block, code fence, or excalidrawing, leave it in
			if (matchesToSkip.findIndex((x) => x.contains(commentMatch)) > -1) {
				continue;
			}

			text = text.replace(commentMatch, "");
		}

		return text;
	};

	convertFrontMatter: TCompilerStep = (file) => (text) => {
		const compiledFrontmatter = file.getCompiledFrontmatter();

		return text.replace(FRONTMATTER_REGEX, () => compiledFrontmatter);
	};

	convertDataViews: TCompilerStep = (file) => async (text) => {
		const dataviewCompiler = new DataviewCompiler();

		return await dataviewCompiler.compile(file)(text);
	};

	convertLinksToFullPath: TCompilerStep = (file) => async (text) => {
		let convertedText = text;

		const linkedFileRegex = /\[\[(.+?)]]/g;
		const linkedFileMatches = convertedText.match(linkedFileRegex);

		if (linkedFileMatches) {
			for (const linkMatch of linkedFileMatches) {
				try {
					const textInsideBrackets = linkMatch.substring(
						linkMatch.indexOf("[") + 2,
						linkMatch.lastIndexOf("]") - 1,
					);

					// eslint-disable-next-line prefer-const
					let [linkedFileName, linkDisplayName] =
						textInsideBrackets.split("|");

					if (linkedFileName.endsWith("\\")) {
						linkedFileName = linkedFileName.substring(
							0,
							linkedFileName.length - 1,
						);
					}

					// linkDisplayName = linkDisplayName || linkedFileName;
					let headerPath = "";

					// detect links to headers or blocks
					if (linkedFileName.includes("#")) {
						const headerSplit = linkedFileName.split("#");
						linkedFileName = headerSplit[0];

						//currently no support for linking to nested heading with multiple #s
						headerPath =
							headerSplit.length > 1 ? `#${headerSplit[1]}` : "";
					}
					const fullLinkedFilePath = getLinkpath(linkedFileName);

					const linkedFile = this.metadataCache.getFirstLinkpathDest(
						fullLinkedFilePath,
						file.getPath(),
					);

					if (!linkedFile) {
						continue;
					}

					const publishLinkedFile = new PublishFile({
						file: linkedFile,
						compiler: this,
						metadataCache: this.metadataCache,
						vault: this.vault,
						settings: this.settings,
					});

					if (linkedFile.path.includes(".excalidraw.md")) {
						//TODO 暂不支持直接嵌入excalidraw
						continue;
					}

					if (linkedFile.extension === "md") {
						const remotePath = publishLinkedFile
							.getFileMetadataManager()
							.getCustomRemotePath();

						// 总是去掉 .md 扩展名
						const replacePath = remotePath.substring(
							0,
							remotePath.lastIndexOf("."),
						);

						if (!linkDisplayName) {
							convertedText = convertedText.replace(
								linkMatch,
								`[[${replacePath}${headerPath}]]`,
							);
						} else {
							convertedText = convertedText.replace(
								linkMatch,
								`[[${replacePath}${headerPath}|${linkDisplayName}]]`,
							);
						}
					}
				} catch (e) {
					console.log(e);
				}
			}
		}

		return convertedText;
	};

	createSvgEmbeds: TCompilerStep = (file) => async (text) => {
		function setWidth(svgText: string, size: string): string {
			const parser = new DOMParser();
			const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
			const svgElement = svgDoc.getElementsByTagName("svg")[0];
			svgElement.setAttribute("width", size);
			fixSvgForXmlSerializer(svgElement);
			const svgSerializer = new XMLSerializer();

			return svgSerializer.serializeToString(svgDoc);
		}

		const transcludedSvgs = text.match(TRANSCLUDED_SVG_REGEX);

		if (transcludedSvgs) {
			for (const svg of transcludedSvgs) {
				try {
					const [imageName, size] = svg
						.substring(svg.indexOf("[") + 2, svg.indexOf("]"))
						.split("|");
					const imagePath = getLinkpath(imageName);

					const linkedFile = this.metadataCache.getFirstLinkpathDest(
						imagePath,
						file.getPath(),
					);

					if (!linkedFile) {
						continue;
					}

					let svgText = await this.vault.read(linkedFile);

					if (svgText && size) {
						svgText = setWidth(svgText, size);
					}

					if (svgText) {
						//Remove whitespace, as markdown-it will insert a <p> tag otherwise
						svgText = svgText.replace(/[\t\n\r]/g, "");
					}
					text = text.replace(svg, svgText);
				} catch {
					continue;
				}
			}
		}

		//!()[image.svg]
		const linkedSvgRegex = /!\[(.*?)\]\((.*?)(\.(svg))\)/g;
		const linkedSvgMatches = text.match(linkedSvgRegex);

		if (linkedSvgMatches) {
			for (const svg of linkedSvgMatches) {
				try {
					const [_imageName, size] = svg
						.substring(svg.indexOf("[") + 2, svg.indexOf("]"))
						.split("|");
					const pathStart = svg.lastIndexOf("(") + 1;
					const pathEnd = svg.lastIndexOf(")");

					const imagePath = svg.substring(pathStart, pathEnd);

					if (imagePath.startsWith("http")) {
						continue;
					}

					const linkedFile = this.metadataCache.getFirstLinkpathDest(
						imagePath,
						file.getPath(),
					);

					if (!linkedFile) {
						continue;
					}

					let svgText = await this.vault.read(linkedFile);

					if (svgText && size) {
						svgText = setWidth(svgText, size);
					}
					text = text.replace(svg, svgText);
				} catch {
					continue;
				}
			}
		}

		return text;
	};

	extractImageLinks = async (file: PublishFile) => {
		const text = await file.cachedRead();
		const assets = [];

		//![[image.png]]
		const transcludedImageRegex =
			/!\[\[(.*?)(\.(png|jpg|jpeg|gif|webp))\|(.*?)\]\]|!\[\[(.*?)(\.(png|jpg|jpeg|gif|webp))\]\]/g;
		const transcludedImageMatches = text.match(transcludedImageRegex);

		if (transcludedImageMatches) {
			for (let i = 0; i < transcludedImageMatches.length; i++) {
				try {
					const imageMatch = transcludedImageMatches[i];

					const [imageName, _] = imageMatch
						.substring(
							imageMatch.indexOf("[") + 2,
							imageMatch.indexOf("]"),
						)
						.split("|");
					const imagePath = getLinkpath(imageName);

					const linkedFile = this.metadataCache.getFirstLinkpathDest(
						imagePath,
						file.getPath(),
					);

					if (!linkedFile) {
						continue;
					}

					assets.push(linkedFile.path);
				} catch (e) {
					console.error(
						`extractImageLinks, transcludedImageMatches error:${transcludedImageMatches[i]}`,
						e,
					);
				}
			}
		}

		//![](image.png)
		const imageRegex = /!\[(.*?)\]\((.*?)(\.(png|jpg|jpeg|gif|webp))\)/g;
		const imageMatches = text.match(imageRegex);

		if (imageMatches) {
			for (let i = 0; i < imageMatches.length; i++) {
				try {
					const imageMatch = imageMatches[i];

					const pathStart = imageMatch.lastIndexOf("(") + 1;
					const pathEnd = imageMatch.lastIndexOf(")");

					const imagePath = imageMatch.substring(pathStart, pathEnd);

					if (imagePath.startsWith("http")) {
						continue;
					}

					const decodedImagePath = decodeURI(imagePath);

					const linkedFile = this.metadataCache.getFirstLinkpathDest(
						decodedImagePath,
						file.getPath(),
					);

					if (!linkedFile) {
						continue;
					}

					assets.push(linkedFile.path);
				} catch (e) {
					console.error(
						`extractImageLinks, imageMatches error:${imageMatches[i]}`,
						e,
					);
				}
			}
		}

		//处理frontmatter中的图片引用，一起上传
		for (let i = 0; i < this.settings.refImgKey.length; i++) {
			const k = this.settings.refImgKey[i];
			//目前支持  //![[image.png]] , [[image.png]] 两种风格
			const imgRef = file.meta.frontmatter[k];

			if (!imgRef) {
				continue;
			}
			const match = imgRef.match(transcludedImageRegex);

			if (match) {
				try {
					const [imageName, _] = imgRef
						.substring(imgRef.indexOf("[") + 2, imgRef.indexOf("]"))
						.split("|");
					const imagePath = getLinkpath(imageName);

					const linkedFile = this.metadataCache.getFirstLinkpathDest(
						imagePath,
						file.getPath(),
					);

					if (linkedFile) {
						assets.push(linkedFile.path);
					}
				} catch (e) {
					console.error(
						`extractImageLinks in frontmatter, transcludedImageMatches error:${imgRef}`,
						e,
					);
				}
			}
		}

		return assets;
	};

	convertImageLinks =
		(file: PublishFile) =>
		async (text: string): Promise<[string, Array<Asset>]> => {
			const filePath = file.getPath();
			const assets = [];

			let imageText = text;

			//![[image.png]]
			const transcludedImageRegex =
				/!\[\[(.*?)(\.(png|jpg|jpeg|gif|webp))\|(.*?)\]\]|!?\[\[(.*?)(\.(png|jpg|jpeg|gif|webp))\]\]/g;
			const transcludedImageMatches = text.match(transcludedImageRegex);

			if (transcludedImageMatches) {
				for (let i = 0; i < transcludedImageMatches.length; i++) {
					try {
						const imageMatch = transcludedImageMatches[i];

						//Alt 1: [image.png|100]
						//Alt 2: [image.png|meta1 meta2|100]
						//Alt 3: [image.png|meta1 meta2]
						const [imageName, ...metaDataAndSize] = imageMatch
							.substring(
								imageMatch.indexOf("[") + 2,
								imageMatch.indexOf("]"),
							)
							.split("|");

						const lastValue =
							metaDataAndSize[metaDataAndSize.length - 1];

						const hasSeveralValues = metaDataAndSize.length > 0;

						const lastValueIsSize =
							hasSeveralValues && !isNaN(parseInt(lastValue));

						const lastValueIsMetaData =
							!lastValueIsSize && hasSeveralValues;

						const size = lastValueIsSize ? lastValue : null;

						let metaData = "";

						const metaDataIsMiddleValues =
							metaDataAndSize.length > 1;

						//Alt 2: [image.png|meta1 meta2|100]
						if (metaDataIsMiddleValues) {
							metaData = metaDataAndSize
								.slice(0, metaDataAndSize.length - 1)
								.join(" ");
						}

						//Alt 2: [image.png|meta1 meta2]
						if (lastValueIsMetaData) {
							metaData = `${lastValue}`;
						}

						const imagePath = getLinkpath(imageName);

						const linkedFile =
							this.metadataCache.getFirstLinkpathDest(
								imagePath,
								filePath,
							);

						if (!linkedFile) {
							continue;
						}

						const imgInfo =
							await this.buildLocalImgInfo(linkedFile);

						const remoteImgPath = `${this.getImgBaseDir()}${linkedFile.path}`;
						let name = "";

						if (metaData && size) {
							name = `${imageName}|${metaData}|${size}`;
						} else if (size) {
							name = `${imageName}|${size}`;
						} else if (metaData && metaData !== "") {
							name = `${imageName}|${metaData}`;
						} else {
							name = imageName;
						}

						const imageMarkdown = `![${name}](${encodeURI(
							remoteImgPath,
						)})`;

						assets.push({
							remotePath: remoteImgPath,
							content: imgInfo.content,
							localHash: imgInfo.localHash,
							localPath: linkedFile.path,
						});

						imageText = imageText.replace(
							imageMatch,
							imageMarkdown,
						);
					} catch (e) {
						console.error(
							`convertImageLinks, transcludedImageMatches error: ${transcludedImageMatches[i]}`,
							e,
						);
					}
				}
			}

			//![](image.png)
			const imageRegex =
				/!\[(.*?)\]\((.*?)(\.(png|jpg|jpeg|gif|webp))\)/g;
			const imageMatches = text.match(imageRegex);

			if (imageMatches) {
				for (let i = 0; i < imageMatches.length; i++) {
					try {
						const imageMatch = imageMatches[i];

						const nameStart = imageMatch.indexOf("[") + 1;
						const nameEnd = imageMatch.indexOf("]");

						const imageName = imageMatch.substring(
							nameStart,
							nameEnd,
						);

						const pathStart = imageMatch.lastIndexOf("(") + 1;
						const pathEnd = imageMatch.lastIndexOf(")");

						const imagePath = imageMatch.substring(
							pathStart,
							pathEnd,
						);

						if (imagePath.startsWith("http")) {
							continue;
						}

						const decodedImagePath = decodeURI(imagePath);

						const linkedFile =
							this.metadataCache.getFirstLinkpathDest(
								decodedImagePath,
								filePath,
							);

						if (!linkedFile) {
							continue;
						}

						const imgInfo =
							await this.buildLocalImgInfo(linkedFile);
						const remoteImgPath = `${this.getImgBaseDir()}${linkedFile.path}`;
						const imageMarkdown = `![${imageName}](${remoteImgPath})`;

						assets.push({
							remotePath: remoteImgPath,
							content: imgInfo.content,
							localHash: imgInfo.localHash,
							localPath: linkedFile.path,
						});

						imageText = imageText.replace(
							imageMatch,
							imageMarkdown,
						);
					} catch (e) {
						console.error(
							`convertImageLinks, imageMatches error: ${imageMatches[i]}`,
							e,
						);
					}
				}
			}

			//处理frontmatter中的图片引用，一起上传
			for (let i = 0; i < this.settings.refImgKey.length; i++) {
				const k = this.settings.refImgKey[i];
				//目前支持  //![[image.png]] , [[image.png]] 两种风格
				const imgRef = file.meta.frontmatter[k];

				if (!imgRef) {
					continue;
				}
				const match = imgRef.match(transcludedImageRegex);

				console.log(imgRef, match);

				if (match) {
					try {
						const [imageName, _] = imgRef
							.substring(
								imgRef.indexOf("[") + 2,
								imgRef.indexOf("]"),
							)
							.split("|");
						const imagePath = getLinkpath(imageName);

						const linkedFile =
							this.metadataCache.getFirstLinkpathDest(
								imagePath,
								file.getPath(),
							);

						console.log(linkedFile);

						if (linkedFile) {
							const remoteImgPath = `${this.getImgBaseDir()}${linkedFile.path}`;

							const imgInfo =
								await this.buildLocalImgInfo(linkedFile);

							assets.push({
								remotePath: remoteImgPath,
								content: imgInfo.content,
								localHash: imgInfo.localHash,
								localPath: linkedFile.path,
							});
						}
					} catch (e) {
						console.error(
							`extractImageLinks in frontmatter, transcludedImageMatches error:${imgRef}`,
							e,
						);
					}
				}
			}
			console.log(assets);

			return [imageText, assets];
		};

	generateTransclusionHeader(
		headerName: string | undefined,
		transcludedFile: TFile,
	) {
		if (!headerName) {
			return headerName;
		}

		const titleVariable = "{{title}}";

		if (headerName.includes(titleVariable)) {
			headerName = headerName.replace(
				titleVariable,
				transcludedFile.basename,
			);
		}

		return fixMarkdownHeaderSyntax(headerName);
	}

	private async buildLocalImgInfo(linkedFile: TFile): Promise<Asset> {
		return await DEFAULT_CACHE.wrap(
			linkedFile.path,
			async () => {
				const image = await this.vault.readBinary(linkedFile);
				const imageBase64 = arrayBufferToBase64(image);
				const localHash = localImgHashFromBuffer(Buffer.from(image));

				return {
					remotePath: `${this.getImgBaseDir()}${linkedFile.path}`,
					localPath: linkedFile.path,
					content: imageBase64,
					localHash: localHash,
				};
			},
			600 * 1000, //ms
		);
	}

	private getImgBaseDir(): string {
		return formatPath(this.settings.imgBaseDir);
	}
}
