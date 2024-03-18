import { DG_PATH_VALUE_REGEX } from "../utils/regexes";

jest.mock("obsidian");

describe("dg-path属性值规则测试", () => {
	const dgPathRegExp = DG_PATH_VALUE_REGEX;

	describe("合法路径", () => {
		//不能以特殊字符开头,必须是/开头
		//不允许连续的/
		//不允许任何位置出现特殊字符#^|:[]\
		//不允许任何位置出现空格
		//结尾至多一个/, 可能没有

		it("常规路径", () => {
			expect("/path/a/b/c").toMatch(dgPathRegExp);
		});

		it("结尾可以出现/, 也可以没有", () => {
			expect("/path/a/b/c/").toMatch(dgPathRegExp);
			expect("/path/a/b/c").toMatch(dgPathRegExp);
		});

		it("可以只有1个/", () => {
			expect("/path/a/b/c/").toMatch(dgPathRegExp);
			expect("/path/a/b/c").toMatch(dgPathRegExp);
		});
	});

	describe("非法路径", () => {
		it("空白路径", () => {
			expect("").not.toMatch(dgPathRegExp);
		});

		it("空格开头", () => {
			expect(" /path/a/b/c").not.toMatch(dgPathRegExp);
		});

		it("//开头", () => {
			expect("//path/a/b/c").not.toMatch(dgPathRegExp);
		});

		it("包含obsidian不允许的异常字符#^|[]\\:", () => {
			expect("/path/#a/b/c").not.toMatch(dgPathRegExp);
			expect("/path/^a/b/c").not.toMatch(dgPathRegExp);
			expect("/path/a|bd/b/c").not.toMatch(dgPathRegExp);
			expect("/path/af[sdf/b/c").not.toMatch(dgPathRegExp);
			expect("/path/af]sdf/b/c").not.toMatch(dgPathRegExp);
			expect("/path/af\\sdf/b/c").not.toMatch(dgPathRegExp);
			expect("/path/af:sdf/b/c").not.toMatch(dgPathRegExp);
		});

		it("任意位置出现连续//", () => {
			expect("/path/a//b/c").not.toMatch(dgPathRegExp);
			expect("/path/a/b/c//").not.toMatch(dgPathRegExp);
			expect("//path/a/b/c/").not.toMatch(dgPathRegExp);
		});

		it("任意位置出现空格", () => {
			expect("/path/a/b/c ").not.toMatch(dgPathRegExp);
			expect("/path/a/b/c/ ").not.toMatch(dgPathRegExp);
			expect("/path/a/ b/c/").not.toMatch(dgPathRegExp);
			expect("/path/a/b /c/").not.toMatch(dgPathRegExp);
			expect("/path/a b/c/").not.toMatch(dgPathRegExp);
			expect(" /path/ab/c/").not.toMatch(dgPathRegExp);
			expect(" /path / ab/c/").not.toMatch(dgPathRegExp);
		});
	});
});
