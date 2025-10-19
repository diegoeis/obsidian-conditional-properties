/* eslint-disable */
const { Plugin, Notice, Setting, PluginSettingTab, parseYaml, stringifyYaml } = require("obsidian");

class ConditionalPropertiesPlugin extends Plugin {
	async onload() {
		await this.loadData().then(settings => {
			this.settings = Object.assign({
				rules: [],
				scanIntervalMinutes: 5,
				lastRun: null,
				scanScope: "latestCreated",
				scanCount: 15
			}, settings);

			this._migrateRules();
		});
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

	_migrateRules() {
		let hasChanges = false;
		this.settings.rules = this.settings.rules.map(rule => {
			if (rule.thenProp !== undefined || rule.thenValue !== undefined) {
				const migratedRule = {
					ifType: "PROPERTY",
					ifProp: rule.ifProp || "",
					ifValue: rule.ifValue || "",
					op: rule.op || "contains",
					thenActions: []
				};
				if (rule.thenProp) {
					migratedRule.thenActions.push({
						prop: rule.thenProp,
						value: rule.thenValue || "",
						action: "add"
					});
				}
				hasChanges = true;
				return migratedRule;
			}
			if (rule.ifType === "TITLE") {
				rule.ifType = "HEADING_FIRST_LEVEL";
				hasChanges = true;
			}
			if (rule.ifType === undefined) {
				rule.ifType = "PROPERTY";
				hasChanges = true;
			}
			return rule;
		});
		if (hasChanges) {
			this.saveData(this.settings);
		}
	}

	async runScan() {
		const { vault, metadataCache } = this.app;
		const files = this._getFilesToScan();
		console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
		console.log(`🔍 STARTING SCAN: ${files.length} notes to process`);
		console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
		let modifiedCount = 0;
		for (const file of files) {
			console.log(`📄 Scanning: "${file.basename}" (${file.path})`);
			const cache = metadataCache.getFileCache(file) || {};
			const frontmatter = cache.frontmatter ?? {};
			const applied = await this.applyRulesToFrontmatter(file, frontmatter);
			if (applied) modifiedCount++;
		}
		this.settings.lastRun = new Date().toISOString();
		await this.saveData(this.settings);
		console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
		console.log(`✅ SCAN COMPLETE: ${modifiedCount} modified / ${files.length} scanned`);
		console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
		return { scanned: files.length, modified: modifiedCount };
	}

	_getFilesToScan() {
		const { vault } = this.app;
		const allFiles = vault.getMarkdownFiles();
		if (this.settings.scanScope === 'entireVault') {
			return allFiles;
		}
		const count = Math.max(1, Number(this.settings.scanCount || 15));
		if (this.settings.scanScope === 'latestModified') {
			return allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, count);
		}
		return allFiles.sort((a, b) => b.stat.ctime - a.stat.ctime).slice(0, count);
	}

	async runScanForRules(rulesSubset) {
		const { vault, metadataCache } = this.app;
		const files = this._getFilesToScan();
		console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
		console.log(`🔍 STARTING SINGLE RULE SCAN: ${files.length} notes to process`);
		console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
		let modifiedCount = 0;
		for (const file of files) {
			console.log(`📄 Scanning: "${file.basename}" (${file.path})`);
			const cache = metadataCache.getFileCache(file) || {};
			const frontmatter = cache.frontmatter ?? {};
			const applied = await this.applyRulesToFrontmatter(file, frontmatter, rulesSubset);
			if (applied) modifiedCount++;
		}
		console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
		console.log(`✅ SINGLE RULE SCAN COMPLETE: ${modifiedCount} modified / ${files.length} scanned`);
		console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
		return { scanned: files.length, modified: modifiedCount };
	}

	async runScanOnFile(file) {
		const cache = this.app.metadataCache.getFileCache(file) || {};
		const frontmatter = cache.frontmatter ?? {};
		return await this.applyRulesToFrontmatter(file, frontmatter);
	}

	async applyRulesToFrontmatter(file, currentFrontmatter, rulesOverride) {
		const rules = Array.isArray(rulesOverride) ? rulesOverride : this.settings.rules;
		if (!Array.isArray(rules) || rules.length === 0) return false;
		let changed = false;
		const newFm = { ...currentFrontmatter };
		for (const rule of rules) {
			const { ifType, ifProp, ifValue, thenActions } = rule || {};
			const op = (rule?.op || "contains");
			if (!Array.isArray(thenActions) || thenActions.length === 0) continue;

			let sourceValue;
			if (ifType === "HEADING_FIRST_LEVEL") {
				sourceValue = await this._getNoteTitle(file);
				// If no title available, show error message and skip rule
				if (sourceValue === null) {
					console.log(`No title available for file "${file.basename}". Rule skipped.`);
					// TODO: Show user message in UI if this rule is being configured
					continue;
				}
			} else {
				sourceValue = currentFrontmatter?.[ifProp];
				if (!ifProp) continue;
			}

			const match = this._matchesCondition(sourceValue, ifValue, op, ifType);
			if (!match) continue;

			// Process THEN actions (simplified for brevity)
			for (const action of thenActions) {
				const { prop, value, action: actionType } = action || {};
				if (!prop) continue;
				console.log(`Processing THEN action: prop="${prop}", value="${value}", actionType="${actionType}"`);
				if (actionType === "add") {
					// Handle adding to arrays or creating new properties
					if (Array.isArray(newFm[prop])) {
						// If it's already an array, add unique values
						const valuesToAdd = value.split(',').map(v => v.trim()).filter(v => v);
						console.log(`Adding to existing array: ${valuesToAdd}`);
						valuesToAdd.forEach(v => {
							if (!newFm[prop].includes(v)) {
								newFm[prop].push(v);
								changed = true;
								console.log(`Added "${v}" to ${prop}`);
							} else {
								console.log(`"${v}" already exists in ${prop}`);
							}
						});
					} else if (newFm[prop]) {
						// Convert to array and add
						const currentArray = Array.isArray(newFm[prop]) ? newFm[prop] : [newFm[prop]];
						const valuesToAdd = value.split(',').map(v => v.trim()).filter(v => v);
						console.log(`Converting to array and adding: ${valuesToAdd}`);
						valuesToAdd.forEach(v => {
							if (!currentArray.includes(v)) {
								currentArray.push(v);
								changed = true;
								console.log(`Added "${v}" to ${prop}`);
							} else {
								console.log(`"${v}" already exists in ${prop}`);
							}
						});
						newFm[prop] = currentArray.length === 1 ? currentArray[0] : currentArray;
					} else {
						// Create new property
						newFm[prop] = value;
						changed = true;
						console.log(`Created new property ${prop} with value "${value}"`);
					}
				} else if (actionType === "remove") {
					// Handle removing from arrays or properties
					if (Array.isArray(newFm[prop])) {
						const valuesToRemove = value.split(',').map(v => v.trim()).filter(v => v);
						console.log(`Removing from array: ${valuesToRemove}`);
						valuesToRemove.forEach(v => {
							const initialLength = newFm[prop].length;
							newFm[prop] = newFm[prop].filter(item => !this._valueEquals(item, v));
							if (newFm[prop].length < initialLength) {
								changed = true;
								console.log(`Removed "${v}" from ${prop}`);
							} else {
								console.log(`"${v}" not found in ${prop}`);
							}
						});
					} else if (newFm[prop]) {
						// For non-arrays, check if it matches and remove
						if (this._valueEquals(newFm[prop], value)) {
							delete newFm[prop];
							changed = true;
							console.log(`Removed property ${prop}`);
						} else {
							console.log(`Value "${value}" not found in ${prop}`);
						}
					}
				} else if (actionType === "overwrite") {
					// Overwrite the entire property
					newFm[prop] = value;
					changed = true;
					console.log(`Overwritten ${prop} with "${value}"`);
				} else if (actionType === "delete") {
					// Delete the property
					delete newFm[prop];
					changed = true;
					console.log(`Deleted property ${prop}`);
				}
			}
		}
		if (!changed) return false;
		console.log(`✓ MODIFIED NOTE: "${file.basename}" (${file.path})`);
		await this._writeFrontmatter(file, newFm);
		return true;
	}

	_matchesCondition(source, expected, op, ifType) {
		if (Array.isArray(source)) {
			const has = source.some(v => this._valueMatches(v, expected));
			if (op === "contains") return has;
			if (op === "notContains") return !has;
			return false;
		}
		const s = source == null ? "" : String(source);
		const e = expected == null ? "" : String(expected);
		if (ifType === "HEADING_FIRST_LEVEL") {
			if (op === "contains") return s.includes(e);
			if (op === "notContains") return !s.includes(e);
		} else {
			if (op === "contains") return this._valueMatches(s, e);
			if (op === "notContains") return !this._valueMatches(s, e);
		}
		return false;
	}

	_valueMatches(source, expected) {
		// Convert both to strings for comparison
		const sourceStr = String(source || '');
		const expectedStr = String(expected || '');

		// For arrays, check if any item matches
		if (Array.isArray(source)) {
			return source.some(item => this._valueMatches(item, expected));
		}

		// Normalize: remove wiki links [[ ]] and quotes " " for comparison purposes only
		const normalize = (str) => {
			// Remove wiki link brackets [[ ]]
			let normalized = str.replace(/\[\[([^\]]+)\]\]/g, '$1');
			// Remove surrounding quotes if they wrap the entire string
			if (normalized.startsWith('"') && normalized.endsWith('"')) {
				normalized = normalized.slice(1, -1);
			}
			return normalized.trim();
		};

		const normalizedSource = normalize(sourceStr);
		const normalizedExpected = normalize(expectedStr);

		console.log(`Comparing "${sourceStr}" (normalized: "${normalizedSource}") with "${expectedStr}" (normalized: "${normalizedExpected}")`);

		return normalizedSource === normalizedExpected;
	}

	_valueEquals(a, b) {
		return this._valueMatches(a, b);
	}

	async _getNoteTitle(file) {
		// Get file content
		const content = await this.app.vault.read(file) || '';
		
		// Check for H1 title after YAML frontmatter
		const lines = content.split('\n');
		let inFrontmatter = false;
		let foundH1 = false;
		let h1Title = null;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// Detect YAML frontmatter
			if (line === '---' && !inFrontmatter && i === 0) {
				inFrontmatter = true;
				continue;
			}
			if (line === '---' && inFrontmatter) {
				inFrontmatter = false;
				continue;
			}
			
			// Skip YAML content
			if (inFrontmatter) continue;
			
			// Look for H1 title (line starting with # )
			if (line.startsWith('# ') && !foundH1) {
				h1Title = line.substring(2).trim(); // Remove # and trim
				foundH1 = true;
				break;
			}
		}
		
		// Prioritize H1 if found
		if (h1Title) {
			return h1Title;
		}
		
		// Check for inline title if showInlineTitle is enabled
		const showInlineTitle = this.app.vault.getConfig('showInlineTitle');
		if (showInlineTitle) {
			// Get the file's display name (which would be the inline title)
			return file.basename;
		}
		
		// No title available
		return null;
	}

	async _writeFrontmatter(file, newFrontmatter) {
		const content = await this.app.vault.read(file);
		const hasYaml = content.startsWith("---\n");
		if (!hasYaml) {
			const yamlStr = stringifyYaml(newFrontmatter);
			const newContent = `---\n${yamlStr}\n---\n${content}`;
			await this.app.vault.modify(file, newContent);
			return;
		}
		const end = content.indexOf("\n---\n", 4);
		if (end === -1) return;
		const yamlRaw = content.substring(4, end);
		const body = content.substring(end + 5);
		let fm = {};
		try { fm = parseYaml(yamlRaw) || {}; } catch { fm = {}; }
		const updatedYaml = stringifyYaml({ ...fm, ...newFrontmatter });
		const newContent = `---\n${updatedYaml}\n---\n${body}`;
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

		new Setting(containerEl)
			.setName("Scan scope")
			.setDesc("Choose which notes to scan")
			.addDropdown(dropdown => {
				dropdown.addOption("latestCreated", "Latest Created notes");
				dropdown.addOption("latestModified", "Latest Modified notes");
				dropdown.addOption("entireVault", "Entire vault");
				dropdown.setValue(this.plugin.settings.scanScope || "latestCreated");
				dropdown.onChange(async (value) => {
					this.plugin.settings.scanScope = value;
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
			});

		if (this.plugin.settings.scanScope !== 'entireVault') {
			new Setting(containerEl)
				.setName("Number of notes")
				.setDesc("Number of notes to scan (1-1000)")
				.addText(text => text
					.setPlaceholder("15")
					.setValue(String(this.plugin.settings.scanCount || 15))
					.onChange(async (value) => {
						const num = Math.max(1, Math.min(1000, Number(value) || 15));
						this.plugin.settings.scanCount = num;
						await this.plugin.saveData(this.plugin.settings);
					}));
		}

		const runNow = new Setting(containerEl)
			.setName("Run now")
			.setDesc("Execute all rules across selected scope")
			.addButton(btn => {
				btn.setButtonText("Run now");
				btn.buttonEl.classList.add("run-now-button", "eis-btn");
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
		const addWrap = containerEl.createEl("div", { cls: "conditional-add-wrap" });
		const addBtn = addWrap.createEl("button", { text: "+ Add rule", cls: "eis-btn" });
		addBtn.onclick = async () => {
			this.plugin.settings.rules.push({ ifType: "PROPERTY", ifProp: "", ifValue: "", op: "contains", thenActions: [{ prop: "", value: "", action: "add" }] });
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		};

		this.plugin.settings.rules.slice().reverse().forEach((rule, idxReversed) => {
			const originalIndex = this.plugin.settings.rules.length - 1 - idxReversed;
			this._renderRule(containerEl, rule, originalIndex);
		});
	}

	_renderRule(containerEl, rule, idx) {
		const wrap = containerEl.createEl("div", { cls: "conditional-rule" });
		if (!Array.isArray(rule.thenActions)) {
			rule.thenActions = [{ prop: "", value: "", action: "add" }];
		}
		if (!rule.ifType) {
			rule.ifType = "PROPERTY";
		}

		const line1 = new Setting(wrap).setName("IF");
		line1.addDropdown(d => {
			d.addOption("PROPERTY", "Property");
			d.addOption("HEADING_FIRST_LEVEL", "Heading First Level");
			d.setValue(rule.ifType || "PROPERTY");
			d.onChange(async (v) => {
				rule.ifType = v;
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});
		});

		if (rule.ifType === "HEADING_FIRST_LEVEL") {
			// For TITLE: show operator and value (check is done during execution)
			line1.addDropdown(d => {
				const current = rule.op || "contains";
				d.addOption("contains", "contains");
				d.addOption("notContains", "notContains");
				d.setValue(current);
				d.onChange(async (v) => { rule.op = v; await this.plugin.saveData(this.plugin.settings); });
			});
			line1.addText(t => t
				.setPlaceholder("heading text")
				.setValue(rule.ifValue || "")
				.onChange(async (v) => { rule.ifValue = v; await this.plugin.saveData(this.plugin.settings); }));
		} else {
			line1.addText(t => t
				.setPlaceholder("property")
				.setValue(rule.ifProp || "")
				.onChange(async (v) => { rule.ifProp = v; await this.plugin.saveData(this.plugin.settings); }));
			line1.addDropdown(d => {
				d.addOption("contains", "contains");
				d.addOption("notContains", "notContains");
				d.setValue(rule.op || "contains");
				d.onChange(async (v) => { rule.op = v; await this.plugin.saveData(this.plugin.settings); });
			});
			line1.addText(t => t
				.setPlaceholder("value")
				.setValue(rule.ifValue || "")
				.onChange(async (v) => { rule.ifValue = v; await this.plugin.saveData(this.plugin.settings); }));
		}

		const thenHeader = wrap.createEl("div", { cls: "conditional-rules-header" });
		thenHeader.createEl("strong", { text: "THEN:" });

		rule.thenActions.forEach((action, actionIdx) => {
			this._renderThenAction(wrap, rule, action, actionIdx, idx);
		});

		const actions = wrap.createEl("div", { cls: "conditional-actions" });
		const addActionBtn = actions.createEl("button", { text: "+ Add property", cls: "eis-btn conditional-add-action" });
		addActionBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			rule.thenActions.push({ prop: "", value: "", action: "add" });
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		}, true);

		const runOne = actions.createEl("button", { text: "Run this rule", cls: "eis-btn-border conditional-run-one" });
		runOne.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			runOne.setAttribute('disabled', 'true');
			try {
				const result = await this.plugin.runScanForRules([this.plugin.settings.rules[idx]]);
				new Notice(`Conditional Properties: ${result.modified} modified / ${result.scanned} scanned (single rule)`);
			} finally {
				runOne.removeAttribute('disabled');
			}
		}, true);

		const del = actions.createEl("button", { text: "Remove", cls: "conditional-remove eis-btn-red eis-btn-border" });
		del.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.plugin.settings.rules.splice(idx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		}, true);
	}

	_renderThenAction(containerEl, rule, action, actionIdx, ruleIdx) {
		const actionWrap = containerEl.createEl("div", { cls: "conditional-then-action" });
		const actionSetting = new Setting(actionWrap).setName(`Property ${actionIdx + 1}`);
		if (!action.action) {
			action.action = "add";
		}

		// Add remove button as first element in the setting's control area
		const settingItem = actionSetting.settingEl;
		const removeActionBtn = document.createElement("button");
		removeActionBtn.textContent = "×";
		removeActionBtn.className = "conditional-remove-action eis-btn eis-btn-red";
		removeActionBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			rule.thenActions.splice(actionIdx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		}, true);

		// Insert button as first child of setting-item
		if (settingItem.firstChild) {
			settingItem.insertBefore(removeActionBtn, settingItem.firstChild);
		} else {
			settingItem.appendChild(removeActionBtn);
		}

		actionSetting.addText(t => t
			.setPlaceholder("property name")
			.setValue(action.prop || "")
			.onChange(async (v) => {
				action.prop = v;
				await this.plugin.saveData(this.plugin.settings);
			}));
		actionSetting.addDropdown(d => {
			d.addOption("add", "ADD VALUE");
			d.addOption("remove", "REMOVE VALUE");
			d.addOption("overwrite", "OVERWRITE ALL VALUES WITH");
			d.addOption("delete", "DELETE PROPERTY");
			d.setValue(action.action || "add");
			d.onChange(async (v) => {
				action.action = v;
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});
		});
		if (action.action !== "delete") {
			actionSetting.addText(t => t
				.setPlaceholder("value (use commas to separate multiple values)")
				.setValue(action.value || "")
				.onChange(async (v) => {
					action.value = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
		}
	}
}

module.exports = ConditionalPropertiesPlugin;
