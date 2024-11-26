import { Component } from "obsidian";
import { TCompilerStep } from "./GardenPageCompiler";
import { escapeRegExp } from "../utils/utils";
import { DataviewApi, getAPI, Link } from "obsidian-dataview";
import { errorNotice } from "../utils/NoticeUtils";
import { PublishFile } from "../publishFile/PublishFile";

// 定义类型
interface DataviewCell {
	path?: string;
	display?: string;
	toString(): string;
}

type DataviewValue =
	| string
	| number
	| boolean
	| Date
	| Link
	| DataviewCell
	| null;

interface DataviewProxy extends DataviewApi {
	formatTableMarkdown(headers: string[], rows: DataviewValue[][]): string;
	formatCell(cell: DataviewValue): string;
	formatListMarkdown(items: DataviewValue[]): string;
}

export class DataviewCompiler {
	private readonly dvApi: DataviewApi;

	constructor() {
		this.dvApi = getAPI();

		if (!this.dvApi) {
			console.error("Dataview API not found!");
		}
	}

	compile: TCompilerStep =
		(publishFile: PublishFile) => async (text: string) => {
			if (!this.dvApi) {
				console.warn("Dataview API not available");

				return text;
			}

			let replacedText = text;

			// 处理 dataview 代码块
			replacedText = await this.processDataviewBlocks(
				replacedText,
				publishFile,
			);

			// 处理 dataviewjs 代码块
			replacedText = await this.processDataviewJsBlocks(
				replacedText,
				publishFile,
			);

			return replacedText;
		};

	private async processDataviewBlocks(
		text: string,
		file: PublishFile,
	): Promise<string> {
		const dataViewRegex = /```dataview\s(.+?)```/gms;
		let replacedText = text;

		const matches = text.matchAll(dataViewRegex);

		for (const match of matches) {
			try {
				const [block, query] = match;

				const { isInsideCallout, finalQuery } =
					this.sanitizeQuery(query);

				// 使用 tryQueryMarkdown 直接获取 markdown 格式结果
				let markdown = await this.dvApi.tryQueryMarkdown(
					finalQuery,
					file.getPath(),
				);

				if (isInsideCallout) {
					markdown = this.surroundWithCalloutBlock(markdown);
				}

				replacedText = replacedText.replace(block, markdown);
			} catch (e) {
				console.error("Dataview query error:", e);

				errorNotice(
					"Unable to render dataview query. Please update the dataview plugin.",
				);
			}
		}

		return replacedText;
	}

	private async processDataviewJsBlocks(
		text: string,
		file: PublishFile,
	): Promise<string> {
		const dataviewJsPrefix =
			this.dvApi.settings.dataviewJsKeyword || "dataviewjs";

		const dataViewJsRegex = new RegExp(
			`\`\`\`${escapeRegExp(dataviewJsPrefix)}\\s(.+?)\`\`\``,
			"gms",
		);
		let replacedText = text;

		const matches = text.matchAll(dataViewJsRegex);

		for (const match of matches) {
			try {
				const [block, query] = match;

				const { isInsideCallout, finalQuery } =
					this.sanitizeQuery(query);
				let result = await this.executeDataviewJs(finalQuery, file);

				if (isInsideCallout) {
					result = this.surroundWithCalloutBlock(result);
				}

				replacedText = replacedText.replace(block, result);
			} catch (e) {
				console.error("DataviewJS execution error:", e);
			}
		}

		return replacedText;
	}

	private async executeDataviewJs(
		query: string,
		file: PublishFile,
	): Promise<string> {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise<string>(async (resolve) => {
			const div = createEl("div");
			const component = new Component();
			component.load();

			const api = getAPI();

			if (!api) {
				console.error("Dataview API not found");
				resolve("");

				return;
			}

			let output = "";

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			const customDv = new Proxy(api, {
				get(target: DataviewApi, prop: string | symbol) {
					if (prop === "current") {
						return () => file;
					}

					if (prop === "page") {
						return (path: string) => target.page(path);
					}

					if (prop === "pages") {
						return (source?: string) => target.pages(source);
					}

					if (prop === "table") {
						return (headers: string[], rows: DataviewValue[][]) => {
							output += (
								this as unknown as DataviewProxy
							).formatTableMarkdown(headers, rows);

							return output;
						};
					}

					if (prop === "paragraph") {
						return (text: string) => {
							output += text + "\n\n";

							return text;
						};
					}

					if (prop === "list") {
						return (items: DataviewValue[]) => {
							output += (
								this as unknown as DataviewProxy
							).formatListMarkdown(items);

							return output;
						};
					}

					if (prop === "header") {
						return (text: string, level: number = 1) => {
							output += "#".repeat(level) + " " + text + "\n\n";

							return output;
						};
					}

					if (prop === "span") {
						return (text: string) => {
							output += text;

							return output;
						};
					}

					return target[prop as keyof DataviewApi];
				},

				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				//@ts-expect-error
				formatTableMarkdown(
					headers: string[],
					rows: DataviewValue[][],
				): string {
					let table = `| ${headers.join(" | ")} |\n`;
					table += `| ${headers.map(() => "---").join(" | ")} |\n`;

					table += rows
						.map(
							(row) =>
								`| ${row.map((cell) => (this as unknown as DataviewProxy).formatCell(cell)).join(" | ")} |`,
						)
						.join("\n");

					return table + "\n\n";
				},

				formatCell(cell: DataviewValue): string {
					if (cell == null) return "";

					if (typeof cell === "object") {
						if ("path" in cell && typeof cell.path === "string") {
							const display =
								"display" in cell ? cell.display : cell.path;

							if (display == undefined) {
								return `[[${cell.path}]]`;
							}

							return `[[${cell.path}|${display}]]`;
						}

						return cell.toString().trim();
					}

					return String(cell).trim();
				},

				formatListMarkdown(items: DataviewValue[]): string {
					return (
						items
							.map(
								(item) =>
									`- ${(this as unknown as DataviewProxy).formatCell(item)}`,
							)
							.join("\n") + "\n\n"
					);
				},
			}) as DataviewProxy;

			try {
				const context = {
					dv: customDv,
					luxon: window.luxon,
					moment: window.moment,
					current: file,
				};

				const wrappedQuery = `
					with (this) {
						${query}
					}
				`;

				await Function(
					"dv",
					"component",
					"container",
					wrappedQuery,
				).call(context, customDv, component, div);
				resolve(output);
			} catch (e) {
				console.error("DataviewJS execution failed:", e);
				resolve("");
			} finally {
				component.unload();
			}
		});
	}

	/**
	 * Splits input in lines.
	 * Prepends the callout/quote sign to each line,
	 * returns all the lines as a single string
	 *
	 */
	surroundWithCalloutBlock(input: string): string {
		if (!input.trim()) return "";

		// 处理多行内容，确保每行都有正确的前缀
		const lines = input.split("\n");

		return lines
			.map((line) => (line.trim() ? `> ${line}` : ">"))
			.join("\n");
	}

	/**
	 * Checks if a query is inside a callout block.
	 * Removes the callout symbols and re-join sanitized parts.
	 * Also returns the boolean that indicates if the query was inside a callout.
	 * @param query
	 * @returns
	 */
	sanitizeQuery(query: string): {
		isInsideCallout: boolean;
		finalQuery: string;
	} {
		let isInsideCallout = false;
		const parts = query.split("\n");
		const sanitized: string[] = [];

		for (const part of parts) {
			const trimmedPart = part.trimStart();

			if (trimmedPart.startsWith(">")) {
				isInsideCallout = true;
				// 移除所有的 > 符号和前导空格
				sanitized.push(trimmedPart.replace(/^>+\s*/, ""));
			} else {
				sanitized.push(part);
			}
		}

		return {
			isInsideCallout,
			finalQuery: sanitized.join("\n"),
		};
	}
}
