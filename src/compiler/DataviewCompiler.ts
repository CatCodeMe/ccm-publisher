import { Component } from "obsidian";
import { TCompilerStep } from "./GardenPageCompiler";
import { escapeRegExp } from "../utils/utils";
import { DataviewApi, getAPI } from "obsidian-dataview";
import { PublishFile } from "src/publishFile/PublishFile";

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
		const dataviewJsPrefix = "dataviewjs";
		const dataViewJsRegex = new RegExp(
			"```" + escapeRegExp(dataviewJsPrefix) + "\\s(.+?)```",
			"gsm",
		);
		const dataviewJsMatches = text.matchAll(dataViewJsRegex);

		for (const queryBlock of dataviewJsMatches) {
			try {
				const block = queryBlock[0];
				const query = queryBlock[1];
				
				console.log("开始处理 dataviewjs 代码块");

				let result = await new Promise<string>(async (resolve) => {
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

					// 创建代理对象，保持原有API的上下文和方法
					const customDv = new Proxy(api, {
						get(target, prop) {
							// 重写输出相关方法
							if (prop === 'table') {
								return (headers: string[], rows: any[][]) => {
									console.log("表格数据:", {headers, rows});
									let table = `| ${headers.join(" | ")} |\n`;
									table += `| ${headers.map(() => "---").join(" | ")} |\n`;
									table += rows.map(row => 
										`| ${row.map(cell => cell?.toString().trim() || "").join(" | ")} |`
									).join("\n");
									return table;
								};
							}
							if (prop === 'paragraph') {
								return (text: string) => text + "\n\n";
							}
							// 其他方法保持原样
							return target[prop];
						}
					});
					
					try {
						// 使用Function构造函数执行代码
						const executor = new Function(
							'dv', 
							'component', 
							'container', 
							`try {
								${query}
							} catch(e) {
								console.error("执行失败:", e);
								return "";
							}`
						);
						
						const result = await executor.call({}, customDv, component, div);
						console.log("执行结果:", result);
						resolve(result || "");
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

function tryDVEvaluate(
	query: string,
	file: PublishFile,
	dvApi: DataviewApi,
): string | undefined | null {
	let result = "";

	try {
		const dataviewResult = dvApi.tryEvaluate(query.trim(), {
			this: dvApi.page(file.getPath()) ?? {},
		});
		result = dataviewResult?.toString() ?? "";
	} catch (e) {
		console.warn("dvapi.tryEvaluate did not yield any result", e);
	}

	return result;
}

function tryEval(query: string) {
	let result = "";

	try {
		result = (0, eval)("const dv = DataviewAPI;" + query); //https://esbuild.github.io/content-types/#direct-eval
	} catch (e) {
		console.warn("eval did not yield any result", e);
	}

	return result;
}

async function tryExecuteJs(
	query: string,
	file: PublishFile,
	dvApi: DataviewApi,
) {
	const div = createEl("div");
	const component = new Component();
	component.load();
	await dvApi.executeJs(query, div, component, file.getPath());
	let counter = 0;

	while (!div.querySelector("[data-tag-name]") && counter < 50) {
		await delay(5);
		counter++;
	}

	return div.innerHTML;
}

//delay async function
function delay(milliseconds: number) {
	return new Promise((resolve, _) => {
		setTimeout(resolve, milliseconds);
	});
}
