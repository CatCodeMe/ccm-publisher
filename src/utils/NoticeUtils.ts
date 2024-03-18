import { Notice } from "obsidian";

function successNotice(msg: string, durationMs?: number) {
	const notice = new Notice("", durationMs);
	notice.noticeEl.setCssProps({ "background-color": "var(--color-green)" });
	notice.noticeEl.innerHTML = `<span">${msg}</span>`;
}

function normalNotice(msg: string, durationMs?: number) {
	const notice = new Notice("", durationMs);
	notice.noticeEl.setCssProps({ "background-color": "var(--color-blue)" });
	notice.noticeEl.innerHTML = `<span">${msg}</span>`;
}

function errorNotice(msg: string, durationMs?: number) {
	const notice = new Notice("", durationMs);
	notice.noticeEl.setCssProps({ "background-color": "var(--color-red)" });
	notice.noticeEl.innerHTML = `<span">${msg}</span>`;
}

export { successNotice, errorNotice, normalNotice };
