/* eslint-disable */
const { Plugin, Notice, Setting, PluginSettingTab, parseYaml, stringifyYaml } = require("obsidian");

class ConditionalPropertiesPlugin extends Plugin {
	async onload() {
		this.settings = Object.assign({ rules: [], scanIntervalMinutes: 5, lastRun: null }, await this.loadData());
		this.registerInterval(this._setupScheduler());
		this.addCommand({
			id: "conditional-properties-run-now",
			name: "Run conditional rules on vault",
			callback: async () => {
				const result = await this.runScan();
				new Notice(`Conditional Properties: ${result.modified} modified / ${result.scanned} scanned`);
			}
		});
		this.addCommand({
			id: "conditional-properties-run-current-file",
			name: "Run conditional rules on current file",
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) { new Notice("No active file."); return; }
				const modified = await this.runScanOnFile(file);
				new Notice(modified ? "Conditional Properties: file modified" : "Conditional Properties: no changes");
			}
		});
		this.addSettingTab(new ConditionalPropertiesSettingTab(this.app, this));
	}

	onunload() {}

	_setupScheduler() {
		const minutes = Math.max(5, Number(this.settings.scanIntervalMinutes || 5));
		return window.setInterval(async () => {
			try {
				await this.runScan();
			} catch (e) {
				console.error("ConditionalProperties scheduler error", e);
			}
		}, minutes * 60 * 1000);
	}

	async runScan() {
		const { vault, metadataCache } = this.app;
		const files = vault.getMarkdownFiles();
		let modifiedCount = 0;
		for (const file of files) {
			const cache = metadataCache.getFileCache(file) || {};
			const frontmatter = cache.frontmatter ?? {};
			const applied = await this.applyRulesToFrontmatter(file, frontmatter);
			if (applied) modifiedCount++;
		}
		this.settings.lastRun = new Date().toISOString();
		await this.saveData(this.settings);
		return { scanned: files.length, modified: modifiedCount };
	}

	async runScanOnFile(file) {
		const cache = this.app.metadataCache.getFileCache(file) || {};
		const frontmatter = cache.frontmatter ?? {};
		return await this.applyRulesToFrontmatter(file, frontmatter);
	}

	async applyRulesToFrontmatter(file, currentFrontmatter) {
		if (!Array.isArray(this.settings.rules) || this.settings.rules.length === 0) return false;
		let changed = false;
		const newFm = { ...currentFrontmatter };
		for (const rule of this.settings.rules) {
			const { ifProp, ifValue, thenProp, thenValue } = rule || {};
			const op = (rule?.op || "equals");
			if (!ifProp || !thenProp) continue;
			const sourceValue = currentFrontmatter?.[ifProp];
			const match = this._matchesCondition(sourceValue, ifValue, op);
			if (!match) continue;

			if (thenProp === ifProp) {
				const replaced = this._replaceInMultiValue(sourceValue, ifValue, thenValue);
				if (!this._deepEqual(replaced, sourceValue)) {
					newFm[thenProp] = replaced;
					changed = true;
				}
			} else {
				if (!this._deepEqual(newFm[thenProp], thenValue)) {
					newFm[thenProp] = thenValue;
					changed = true;
				}
			}
		}
		if (!changed) return false;
		await this._writeFrontmatter(file, newFm);
		return true;
	}

	_matchesCondition(source, expected, op) {
		// Normalize
		if (Array.isArray(source)) {
			const has = source.some(v => this._valueEquals(v, expected));
			if (op === "equals") return has; // equals means any array item equals expected
			if (op === "contains") return has; // contains behaves same as equals for arrays
			if (op === "notEquals") return !has;
			return false;
		}
		const s = source == null ? "" : String(source);
		const e = expected == null ? "" : String(expected);
		if (op === "equals") return s === e;
		if (op === "contains") return s.includes(e);
		if (op === "notEquals") return s !== e;
		return false;
	}

	_replaceInMultiValue(source, needle, replacement) {
		if (Array.isArray(source)) {
			return source.map(v => (this._valueEquals(v, needle) ? replacement : v));
		}
		const s = source == null ? "" : String(source);
		const n = needle == null ? "" : String(needle);
		if (!n) return replacement;
		// simple token replace; for advanced tokenization, future versions can extend
		return s === n ? replacement : s.replaceAll(n, String(replacement));
	}

	_valueEquals(a, b) {
		return String(a) === String(b);
	}

	_deepEqual(a, b) {
		try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
	}

	async _writeFrontmatter(file, newFrontmatter) {
		const content = await this.app.vault.read(file);
		const hasYaml = content.startsWith("---\n");
		let body = content;
		let fm = {};
		if (hasYaml) {
			const end = content.indexOf("\n---\n", 4);
			if (end !== -1) {
				const yamlRaw = content.substring(4, end);
				body = content.substring(end + 5);
				try { fm = parseYaml(yamlRaw) || {}; } catch { fm = {}; }
			}
		}
		const merged = { ...fm, ...newFrontmatter };
		let yamlStr = "";
		try { yamlStr = stringifyYaml(merged); } catch {
			yamlStr = Object.entries(merged).map(([k, v]) => `${k}: ${v}`).join("\n");
		}
		const newContent = `---\n${yamlStr}\n---\n${body}`;
		await this.app.vault.modify(file, newContent);
	}
}

class ConditionalPropertiesSettingTab extends PluginSettingTab {
	constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
	display() {
		const { containerEl } = this;
		containerEl.empty();
			containerEl.createEl("h1", { text: "Conditional Properties" });
			containerEl.createEl("p", { text: "Create rules to change note properties values based in custom conditions." });
			containerEl.createEl("h3", { text: "Configurations" });

			new Setting(containerEl)
			.setName("Scan interval (minutes)")
			.setDesc("Minimum 5 minutes")
			.addText(text => text
				.setPlaceholder("5")
				.setValue(String(this.plugin.settings.scanIntervalMinutes || 5))
				.onChange(async (value) => {
					this.plugin.settings.scanIntervalMinutes = Math.max(5, Number(value) || 5);
					await this.plugin.saveData(this.plugin.settings);
					new Notice("Interval updated. Restart Obsidian to apply immediately.");
				}));

			const runNow = new Setting(containerEl)
			.setName("Run now on entire vault")
			.setDesc("Execute all rules across all notes")
				.addButton(btn => {
					btn.setButtonText("Run now");
					btn.buttonEl.classList.add("run-now-button");
					btn.onClick(async () => {
				btn.setDisabled(true);
				try {
					const result = await this.plugin.runScan();
					new Notice(`Conditional Properties: ${result.modified} modified / ${result.scanned} scanned`);
					} finally { btn.setDisabled(false); }
					});
				});

			this.plugin.settings.rules = this.plugin.settings.rules || [];
			containerEl.createEl("h3", { text: "Add rules" });
			// Add button ABOVE the list
			const addWrap = containerEl.createEl("div", { cls: "conditional-add-wrap" });
			const addBtn = addWrap.createEl("button", { text: "+ Add rule" });
			addBtn.onclick = async () => {
				this.plugin.settings.rules.push({ ifProp: "", ifValue: "", op: "equals", thenProp: "", thenValue: "" });
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			};

			// Render rules with newest first
			this.plugin.settings.rules.slice().reverse().forEach((rule, idxReversed) => {
				// Map back to original index
				const originalIndex = this.plugin.settings.rules.length - 1 - idxReversed;
				this._renderRule(containerEl, rule, originalIndex);
			});
	}

	_renderRule(containerEl, rule, idx) {
		const wrap = containerEl.createEl("div", { cls: "conditional-rule" });
		// Line 1: IF property [field] [operator] value [field]
		const line1 = new Setting(wrap).setName("IF property");
		line1.addText(t => t
			.setPlaceholder("property")
			.setValue(rule.ifProp || "")
			.onChange(async (v) => { rule.ifProp = v; await this.plugin.saveData(this.plugin.settings); }));
		line1.addDropdown(d => {
			const current = rule.op || "equals";
			d.addOption("equals", "equals");
			d.addOption("contains", "contains");
			d.addOption("notEquals", "notEquals");
			d.setValue(current);
			d.onChange(async (v) => { rule.op = v; await this.plugin.saveData(this.plugin.settings); });
		});
		line1.addText(t => t
			.setPlaceholder("value")
			.setValue(rule.ifValue || "")
			.onChange(async (v) => { rule.ifValue = v; await this.plugin.saveData(this.plugin.settings); }));

		// Line 2: THEN set property [field] to value [field]
		const line2 = new Setting(wrap).setName("THEN set property");
		line2.addText(t => t
			.setPlaceholder("target property")
			.setValue(rule.thenProp || "")
			.onChange(async (v) => { rule.thenProp = v; await this.plugin.saveData(this.plugin.settings); }));
		// Add a tiny label "to value" between inputs
		const toLabel = document.createElement('span');
		toLabel.textContent = ' to value ';
		toLabel.classList.add('conditional-to-label');
		line2.controlEl.appendChild(toLabel);
		line2.addText(t => t
			.setPlaceholder("new value")
			.setValue(rule.thenValue || "")
			.onChange(async (v) => { rule.thenValue = v; await this.plugin.saveData(this.plugin.settings); }));

		const del = wrap.createEl("button", { text: "Remove", cls: "conditional-remove" });
		del.onclick = async () => {
			this.plugin.settings.rules.splice(idx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		};
	}
}

module.exports = ConditionalPropertiesPlugin;


