/* eslint-disable */
const { Plugin, Notice, Setting, PluginSettingTab, parseYaml, stringifyYaml } = require("obsidian");

class ConditionalPropertiesPlugin extends Plugin {
	async onload() {
		await this.loadData().then(settings => {
			this.settings = Object.assign({
				rules: [],
				scanIntervalMinutes: 5,
				lastRun: null,
				scanScope: "latestCreated", // "latestCreated", "latestModified", "entireVault"
				scanCount: 15
			}, settings);

			// Migrate old rules format to new format
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
			// Check if rule is in old format (has thenProp/thenValue)
			if (rule.thenProp !== undefined || rule.thenValue !== undefined) {
				// Convert old format to new format
				const migratedRule = {
					ifProp: rule.ifProp || "",
					ifValue: rule.ifValue || "",
					op: rule.op || "equals",
					thenActions: []
				};

				// Add the old THEN action as first action
				if (rule.thenProp) {
					migratedRule.thenActions.push({
						prop: rule.thenProp,
						value: rule.thenValue || ""
					});
				}

				hasChanges = true;
				return migratedRule;
			}

			// Rule is already in new format or has no THEN actions
			return rule;
		});

		// Save migrated settings if changes were made
		if (hasChanges) {
			this.saveData(this.settings);
		}
	}

	async runScan() {
		const { vault, metadataCache } = this.app;
		const files = this._getFilesToScan();
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

	_getFilesToScan() {
		const { vault } = this.app;
		const allFiles = vault.getMarkdownFiles();

		if (this.settings.scanScope === 'entireVault') {
			return allFiles;
		}

		const count = Math.max(1, Number(this.settings.scanCount || 15));

		if (this.settings.scanScope === 'latestModified') {
			return allFiles
				.sort((a, b) => b.stat.mtime - a.stat.mtime)
				.slice(0, count);
		}

		// Default to latestCreated
		return allFiles
			.sort((a, b) => b.stat.ctime - a.stat.ctime)
			.slice(0, count);
	}

	async runScanForRules(rulesSubset) {
		const { vault, metadataCache } = this.app;
		const files = this._getFilesToScan();
		let modifiedCount = 0;
		for (const file of files) {
			const cache = metadataCache.getFileCache(file) || {};
			const frontmatter = cache.frontmatter ?? {};
			const applied = await this.applyRulesToFrontmatter(file, frontmatter, rulesSubset);
			if (applied) modifiedCount++;
		}
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
			const { ifProp, ifValue, thenActions } = rule || {};
			const op = (rule?.op || "equals");
			if (!ifProp || !Array.isArray(thenActions) || thenActions.length === 0) continue;

			// Check IF condition
			const sourceValue = currentFrontmatter?.[ifProp];
			const match = this._matchesCondition(sourceValue, ifValue, op);
			if (!match) continue;

			// Group THEN actions by property for intelligent merging
			const propertyActions = {};
			console.log("Processing rule with thenActions:", thenActions);
			for (const action of thenActions) {
				const { prop, value } = action || {};
				console.log("Processing action:", { prop, value });
				if (!prop) continue;

				if (!propertyActions[prop]) {
					propertyActions[prop] = [];
				}
				propertyActions[prop].push(value);
			}
			console.log("Grouped property actions:", propertyActions);

			// Apply merged actions
			for (const [prop, values] of Object.entries(propertyActions)) {
				console.log("Applying property:", prop, "with values:", values);
				if (prop === ifProp) {
					// Special case: IF property - process each value individually
					let currentValue = [...sourceValue];
					let hasChanges = false;
					console.log("Starting with sourceValue:", currentValue, "ifValue:", ifValue);

					for (let i = 0; i < values.length; i++) {
						const value = values[i];
						console.log(`\n--- Processing THEN value ${i + 1}: "${value}" ---`);

						// Process comma-separated values for this THEN action
						const processedValue = this._processCommaSeparatedValue(value);
						console.log(`Processed value: "${value}" -> ${processedValue}`);

						// Handle both single values and arrays
						const valuesToProcess = Array.isArray(processedValue) ? processedValue : [processedValue];
						console.log(`Values to process: ${valuesToProcess}`);

						for (const singleValue of valuesToProcess) {
							console.log(`Processing single value: "${singleValue}"`);

							// Check if ifValue exists in current array
							const ifValueIndex = currentValue.findIndex(item => {
								const equals = this._valueEquals(item, ifValue);
								console.log(`Comparing "${item}" with ifValue "${ifValue}": ${equals}`);
								return equals;
							});
							console.log(`Found ifValue "${ifValue}" at index:`, ifValueIndex);

							// Check if the THEN value already exists
							const valueExists = currentValue.some(item => {
								const equals = this._valueEquals(item, singleValue);
								console.log(`Checking if THEN value "${singleValue}" exists: comparing with "${item}": ${equals}`);
								return equals;
							});
							console.log(`THEN value "${singleValue}" already exists:`, valueExists);

							if (ifValueIndex !== -1 && !valueExists) {
								// ifValue exists AND new value doesn't exist, replace it
								const oldValue = currentValue[ifValueIndex];
								currentValue[ifValueIndex] = singleValue;
								hasChanges = true;
								console.log(`✓ Replaced "${oldValue}" with "${singleValue}" at index ${ifValueIndex}`);
							} else if (ifValueIndex === -1 && !valueExists) {
								// ifValue doesn't exist AND new value doesn't exist, add it
								currentValue.push(singleValue);
								hasChanges = true;
								console.log(`✓ Added new value "${singleValue}" to array`);
							} else {
								console.log(`⚠ No action needed for "${singleValue}" - conditions not met`);
								console.log(`  - ifValue exists: ${ifValueIndex !== -1}`);
								console.log(`  - value exists: ${valueExists}`);
							}

							console.log("Current array now:", currentValue);
						}
					}

					console.log("\n=== FINAL RESULT ===");
					console.log("Final result for IF property:", currentValue);
					console.log("Original sourceValue:", sourceValue);
					console.log("Has changes:", hasChanges);

					// Only apply if there were actual changes
					if (hasChanges) {
						newFm[prop] = currentValue;
						changed = true;
						console.log("Applied IF property changes");
					} else {
						console.log("No changes needed for IF property");
					}
				} else {
					// Regular property setting - merge all values for this property
					// Process each value individually and combine them properly
					let allProcessedValues = [];

					for (const value of values) {
						const processedValue = this._processCommaSeparatedValue(value);
						console.log("Processing individual value:", value, "->", processedValue);

						if (Array.isArray(processedValue)) {
							allProcessedValues.push(...processedValue);
						} else {
							allProcessedValues.push(processedValue);
						}
					}

					console.log("All processed values:", allProcessedValues);
					const mergedValue = this._mergePropertyValue(currentFrontmatter[prop], allProcessedValues);
					console.log("Merged value for", prop, ":", mergedValue, "current:", currentFrontmatter[prop]);

					// Always apply if different from current value
					if (!this._deepEqual(currentFrontmatter[prop], mergedValue)) {
						newFm[prop] = mergedValue;
						changed = true;
						console.log("Applied merged value for property:", prop);
					} else {
						console.log("No change needed for property:", prop);
					}
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

	_processCommaSeparatedValue(value) {
		console.log("_processCommaSeparatedValue input:", value, typeof value);
		if (!value || typeof value !== 'string') {
			console.log("Invalid input, returning as-is");
			return value;
		}

		// Split by comma and filter out empty values
		const parts = value.split(',').map(part => part.trim()).filter(part => part.length > 0);
		console.log("Split parts:", parts);

		// If only one value, return as simple string
		if (parts.length === 1) {
			console.log("Single value, returning:", parts[0]);
			return parts[0];
		}

		// If multiple values, return as array
		if (parts.length > 1) {
			console.log("Multiple values, returning array:", parts);
			return parts;
		}

		// If no valid parts, return original value
		console.log("No valid parts, returning original");
		return value;
	}

	_mergePropertyValue(existingValue, newValue) {
		console.log("_mergePropertyValue called with:", { existingValue, newValue });
		// Process new value (handle comma-separated strings)
		const newValues = this._processCommaSeparatedValue(newValue);
		console.log("Processed new values:", newValues);

		// If no existing value, return new values
		if (existingValue == null || existingValue === '') {
			console.log("No existing value, returning new values");
			return newValues;
		}

		// Ensure existing value is an array for processing
		let existingArray = [];
		if (Array.isArray(existingValue)) {
			existingArray = [...existingValue];
		} else if (typeof existingValue === 'string') {
			// Convert string to array for merging
			existingArray = this._processCommaSeparatedValue(existingValue);
		} else {
			// For other types, convert to string array
			existingArray = [String(existingValue)];
		}
		console.log("Existing array:", existingArray);

		// If new values is a string, convert to array
		let newArray = [];
		if (Array.isArray(newValues)) {
			newArray = [...newValues];
		} else if (typeof newValues === 'string') {
			newArray = this._processCommaSeparatedValue(newValues);
		} else {
			newArray = [String(newValues)];
		}
		console.log("New array:", newArray);

		// Merge arrays with unique values
		const mergedArray = [...existingArray];
		for (const newVal of newArray) {
			if (!existingArray.some(existingVal => this._valueEquals(existingVal, newVal))) {
				mergedArray.push(newVal);
			}
		}
		console.log("Merged array:", mergedArray);

		// Return appropriate format based on original types and result
		if (mergedArray.length === 1) {
			// If only one value, return as string for consistency
			console.log("Single value, returning:", mergedArray[0]);
			return mergedArray[0];
		} else {
			// Multiple values, return as array
			console.log("Multiple values, returning array:", mergedArray);
			return mergedArray;
		}
	}

	async _writeFrontmatter(file, newFrontmatter) {
		console.log("_writeFrontmatter called with:", newFrontmatter);
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
		console.log("Existing frontmatter:", fm);
		const merged = { ...fm, ...newFrontmatter };
		console.log("Merged frontmatter:", merged);

		// Generate properly formatted YAML
		let yamlStr = "";
		try {
			console.log("Calling _generateFormattedYaml with merged object:", merged);
			yamlStr = this._generateFormattedYaml(merged);
			console.log("Successfully generated formatted YAML");
		} catch (error) {
			console.error("Error generating formatted YAML:", error);
			yamlStr = Object.entries(merged).map(([k, v]) => `${k}: ${v}`).join("\n");
		}

		console.log("Generated YAML:", yamlStr);
		const newContent = `---\n${yamlStr}\n---\n${body}`;
		await this.app.vault.modify(file, newContent);
		console.log("File updated successfully");
	}

	_generateFormattedYaml(obj, indent = 0) {
		console.log("Generating YAML for:", obj, "with indent:", indent);
		const spaces = '  '.repeat(indent);
		const lines = [];

		for (const [key, value] of Object.entries(obj)) {
			console.log(`Processing key "${key}" with value:`, value, `type: ${typeof value}`);
			if (Array.isArray(value) && value.length > 0) {
				console.log(`Formatting array for key "${key}"`);
				// Format arrays with proper YAML list syntax
				lines.push(`${spaces}${key}:`);
				for (const item of value) {
					console.log(`Adding array item: "${item}"`);
					lines.push(`${spaces}  - ${item}`);
				}
			} else if (typeof value === 'object' && value !== null) {
				// Handle nested objects
				lines.push(`${spaces}${key}:`);
				lines.push(this._generateFormattedYaml(value, indent + 1));
			} else {
				// Handle simple values
				console.log(`Adding simple value for key "${key}": ${value}`);
				lines.push(`${spaces}${key}: ${value}`);
			}
		}

		const result = lines.join('\n');
		console.log("Generated YAML lines:", lines);
		console.log("Final YAML result:", result);
		return result;
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

			containerEl.createEl("h3", { text: "Scan Scope" });

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
					this.display(); // Refresh to show/hide count field
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

			containerEl.createEl("h3", { text: "Run now" });

			const runNow = new Setting(containerEl)
			.setName("Run now")
			.setDesc("Execute all rules across selected scope")
				.addButton(btn => {
					btn.setButtonText("Run now");
					btn.buttonEl.classList.add("run-now-button", "eis-btn-primary");
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
			const addBtn = addWrap.createEl("button", { text: "+ Add rule", cls: "eis-btn-primary" });
			addBtn.onclick = async () => {
				this.plugin.settings.rules.push({ ifProp: "", ifValue: "", op: "equals", thenActions: [{ prop: "", value: "" }] });
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

		// Ensure rule has thenActions array
		if (!Array.isArray(rule.thenActions)) {
			rule.thenActions = [{ prop: "", value: "" }];
		}

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

		// THEN section header
		const thenHeader = wrap.createEl("div", { cls: "conditional-rules-header" });
		thenHeader.createEl("strong", { text: "THEN:" });

		// Render each THEN action
		rule.thenActions.forEach((action, actionIdx) => {
			this._renderThenAction(wrap, rule, action, actionIdx, idx);
		});

		// Create actions container
		const actions = wrap.createEl("div", { cls: "conditional-actions" });

		// Add action button
		const addActionBtn = actions.createEl("button", { text: "+ Add property", cls: "conditional-add-action" });
		addActionBtn.onclick = async (e) => {
			e.preventDefault(); // Prevent default behavior that might cause scroll
			rule.thenActions.push({ prop: "", value: "" });
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		};

		const runOne = actions.createEl("button", { text: "Run this rule", cls: "conditional-run-one eis-btn-primary" });
		runOne.onclick = async () => {
			runOne.setAttribute('disabled', 'true');
			try {
				const result = await this.plugin.runScanForRules([this.plugin.settings.rules[idx]]);
				new Notice(`Conditional Properties: ${result.modified} modified / ${result.scanned} scanned (single rule)`);
			} finally {
				runOne.removeAttribute('disabled');
			}
		};

		const del = actions.createEl("button", { text: "Remove", cls: "conditional-remove" });
		del.onclick = async () => {
			this.plugin.settings.rules.splice(idx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		};
	}

	_renderThenAction(containerEl, rule, action, actionIdx, ruleIdx) {
		const actionWrap = containerEl.createEl("div", { cls: "conditional-then-action" });

		const actionSetting = new Setting(actionWrap).setName(`Property ${actionIdx + 1}`);

		// Add remove button as first item in setting-item
		const removeActionBtn = actionWrap.createEl("button", { text: "×", cls: "conditional-remove-action eis-btn-red" });
		removeActionBtn.onclick = async () => {
			rule.thenActions.splice(actionIdx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
		};

		actionSetting.addText(t => t
			.setPlaceholder("property name")
			.setValue(action.prop || "")
			.onChange(async (v) => {
				// Check for duplicate properties in the same rule
				const duplicateCount = rule.thenActions.filter(a => a.prop === v).length;
				if (duplicateCount > 1) {
					new Notice(`Warning: Property "${v}" is defined multiple times in this rule. The last value will be used.`, 3000);
					actionWrap.classList.add('duplicate-prop');
				} else {
					actionWrap.classList.remove('duplicate-prop');
				}
				action.prop = v;
				await this.plugin.saveData(this.plugin.settings);
			}));

		// Label "to value"
		const toLabel = document.createElement('span');
		toLabel.textContent = ' to ';
		toLabel.classList.add('conditional-to-label');
		actionSetting.controlEl.appendChild(toLabel);

		actionSetting.addText(t => t
			.setPlaceholder("value (use commas to separate multiple values)")
			.setValue(action.value || "")
			.onChange(async (v) => {
				action.value = v;
				await this.plugin.saveData(this.plugin.settings);
			}));

		// Only show remove button if more than one action (but it's always created now, just hidden via CSS)
		if (rule.thenActions.length <= 1) {
			removeActionBtn.style.display = 'none';
		}
	}
}

module.exports = ConditionalPropertiesPlugin;
