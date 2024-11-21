import { Component } from "obsidian";
import { TCompilerStep } from "./GardenPageCompiler";
import { escapeRegExp } from "../utils/utils";
import { DataviewApi, getAPI } from "obsidian-dataview";
import { errorNotice } from "../utils/NoticeUtils";

export class DataviewCompiler {
	private dvApi: DataviewApi;

	constructor() {
		this.dvApi = getAPI();

		if (!this.dvApi) {
			console.error("Dataview API not found!");
		}
	}

	compile: TCompilerStep = (file) => async (text) => {
		let replacedText = text;
		const dataViewRegex = /```dataview\s(.+?)```/gms;

		if (!this.dvApi) {
			console.warn("Dataview API not available");

			return replacedText;
		}

		const matches = text.matchAll(dataViewRegex);

		const dataviewJsPrefix = this.dvApi.settings.dataviewJsKeyword;

		const dataViewJsRegex = new RegExp(
			"```" + escapeRegExp(dataviewJsPrefix) + "\\s(.+?)```",
			"gsm",
		);
		const dataviewJsMatches = text.matchAll(dataViewJsRegex);

		const inlineQueryPrefix = this.dvApi.settings.inlineQueryPrefix;

		const inlineDataViewRegex = new RegExp(
			"`" + escapeRegExp(inlineQueryPrefix) + "(.+?)`",
			"gsm",
		);
		const inlineMatches = text.matchAll(inlineDataViewRegex);

		const inlineJsQueryPrefix = this.dvApi.settings.inlineJsQueryPrefix;

		const inlineJsDataViewRegex = new RegExp(
			"`" + escapeRegExp(inlineJsQueryPrefix) + "(.+?)`",
			"gsm",
		);
		const inlineJsMatches = text.matchAll(inlineJsDataViewRegex);

		if (
			!matches &&
			!inlineMatches &&
			!dataviewJsMatches &&
			!inlineJsMatches
		) {
			return text;
		}

		//Code block queries
		for (const queryBlock of matches) {
			try {
				const block = queryBlock[0];
				const query = queryBlock[1];

				const { isInsideCallout, finalQuery } =
					this.sanitizeQuery(query);

				let markdown = await this.dvApi.tryQueryMarkdown(
					finalQuery,
					file.getPath(),
				);

				if (isInsideCallout) {
					markdown = this.surroundWithCalloutBlock(markdown);
				}

				replacedText = replacedText.replace(block, `${markdown}`);
			} catch (e) {
				console.log(e);

				errorNotice(
					"Unable to render dataview query. Please update the dataview plugin to the latest version.",
				);

				return queryBlock[0];
			}
		}

		for (const queryBlock of dataviewJsMatches) {
			try {
				const block = queryBlock[0];
				const query = queryBlock[1];

				console.log("开始处理 dataviewjs 代码块");

				// eslint-disable-next-line no-async-promise-executor
				const result = await new Promise<string>(async (resolve) => {
					const div = createEl("div");
					const component = new Component();
					component.load();

					// 获取原始的dataview API
					const api = getAPI();

					if (!api) {
						console.error("Dataview API not found");
						resolve("");

						return;
					}

					let tableResult = ""; // 存储表格结果
					let paragraphResult = ""; // 存储段落结果

					// 创建代理对象，保持原有API的上下文和方法
					const customDv = new Proxy(api, {
						get(target, prop) {
							// 重写输出相关方法
							if (prop === "table") {
								return (headers: string[], rows: any[][]) => {
									let table = `| ${headers.join(" | ")} |\n`;
									table += `| ${headers.map(() => "---").join(" | ")} |\n`;

									table += rows
										.map(
											(row) =>
												`| ${row.map((cell) => cell?.toString().trim() || "").join(" | ")} |`,
										)
										.join("\n");
									tableResult = table; // 保存表格结果

									return table;
								};
							}

							if (prop === "paragraph") {
								return (text: string) => {
									paragraphResult = text + "\n\n"; // 保存段落结果

									return text;
								};
							}

							// 其他方法保持原样
							return target[prop];
						},
					});

					try {
						// 执行代码
						await Function(
							"dv",
							"component",
							"container",
							`${query}`,
						).call({}, customDv, component, div);

						// 返回段落和表格的组合结果
						resolve(paragraphResult + tableResult);
					} catch (e) {
						console.error("执行失败:", e);
						resolve("");
					}
				});

				console.log("最终输出:", result);
				replacedText = replacedText.replace(block, result);
			} catch (e) {
				console.error("Dataviewjs rendering error:", e);

				return queryBlock[0];
			}
		}

		return replacedText;
	};

	/**
	 * Splits input in lines.
	 * Prepends the callout/quote sign to each line,
	 * returns all the lines as a single string
	 *
	 */
	surroundWithCalloutBlock(input: string): string {
		const tmp = input.split("\n");

		return " " + tmp.join("\n> ");
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
		const sanitized = [];

		for (const part of parts) {
			if (part.startsWith(">")) {
				isInsideCallout = true;
				sanitized.push(part.substring(1).trim());
			} else {
				sanitized.push(part);
			}
		}
		let finalQuery = query;

		if (isInsideCallout) {
			finalQuery = sanitized.join("\n");
		}

		return { isInsideCallout, finalQuery };
	}
}
