// Dev-only lint config. This repo ships compiled JS directly (no build
// step, no TypeScript) — this file exists solely to run the same
// eslint-plugin-obsidianmd checks the community-plugin review bot runs on
// every release, so violations are caught locally instead of at review time.
//
// Run with: npm run lint
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ["main.js"],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: "commonjs",
		},
	},
	{
		ignores: ["node_modules/**", "dist/**"],
	},
]);
