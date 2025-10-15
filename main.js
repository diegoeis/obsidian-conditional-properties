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
					op: rule.op || "contains",
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
			const op = (rule?.op || "contains");
			if (!ifProp || !Array.isArray(thenActions) || thenActions.length === 0) continue;

			// Check IF condition
			const sourceValue = currentFrontmatter?.[ifProp];
			const match = this._matchesCondition(sourceValue, ifValue, op);
			if (!match) continue;

			// Group THEN actions by property for intelligent merging
			const propertyActions = {};
			console.log("Processing rule with thenActions:", thenActions);
			for (const action of thenActions) {
				const { prop, value, action: actionType } = action || {};
				console.log("Processing action:", { prop, value, actionType });
				if (!prop) continue;

				if (!propertyActions[prop]) {
					propertyActions[prop] = [];
				}
				propertyActions[prop].push({ value, actionType: actionType || "add" });
			}
			console.log("Grouped property actions:", propertyActions);

			// Apply merged actions
			for (const [prop, actions] of Object.entries(propertyActions)) {
				console.log("Applying property:", prop, "with actions:", actions);
				if (prop === ifProp) {
					// Special case: IF property - process each action individually
					let currentValue = Array.isArray(sourceValue) ? [...sourceValue] : (sourceValue ? [sourceValue] : []);
					let hasChanges = false;
					console.log("Starting with sourceValue:", currentValue, "ifValue:", ifValue);

					for (let i = 0; i < actions.length; i++) {
						const { value, actionType } = actions[i];
						console.log(`\n--- Processing THEN action ${i + 1}: type="${actionType}", value="${value}" ---`);

						// Process comma-separated values for this THEN action
						const processedValue = this._processCommaSeparatedValue(value);
						console.log(`Processed value: "${value}" -> ${processedValue}`);

						// Handle both single values and arrays
						const valuesToProcess = Array.isArray(processedValue) ? processedValue : [processedValue];
						console.log(`Values to process: ${valuesToProcess}`);

						if (actionType === "remove") {
							// REMOVE action: remove specified values
							for (const singleValue of valuesToProcess) {
								console.log(`Removing value: "${singleValue}"`);
								const initialLength = currentValue.length;
								currentValue = currentValue.filter(item => !this._valueEquals(item, singleValue));
								if (currentValue.length < initialLength) {
									hasChanges = true;
									console.log(`✓ Removed "${singleValue}" from array`);
								} else {
									console.log(`⚠ Value "${singleValue}" not found to remove`);
								}
								console.log("Current array now:", currentValue);
							}
						} else {
							// ADD action: add values (default behavior)
							for (const singleValue of valuesToProcess) {
								console.log(`Adding value: "${singleValue}"`);

								// Don't remove ifValue when adding - preserve it
								const valueExists = currentValue.some(item => this._valueEquals(item, singleValue));
								
								if (!valueExists) {
									currentValue.push(singleValue);
									hasChanges = true;
									console.log(`✓ Added new value "${singleValue}" to array`);
								} else {
									console.log(`⚠ Value "${singleValue}" already exists`);
								}
								console.log("Current array now:", currentValue);
							}
						}
					}

					console.log("\n=== FINAL RESULT ===");
					console.log("Final result for IF property:", currentValue);
					console.log("Original sourceValue:", sourceValue);
					console.log("Has changes:", hasChanges);

					// Only apply if there were actual changes
					if (hasChanges) {
						newFm[prop] = currentValue.length === 1 ? currentValue[0] : currentValue;
						changed = true;
						console.log("Applied IF property changes");
					} else {
						console.log("No changes needed for IF property");
					}
				} else {
					// Regular property setting - process each action individually
					let currentValue = Array.isArray(currentFrontmatter[prop]) 
						? [...currentFrontmatter[prop]] 
						: (currentFrontmatter[prop] ? [currentFrontmatter[prop]] : []);
					let hasChanges = false;

					for (const actionData of actions) {
						const { value, actionType } = actionData;
						console.log("Processing action for", prop, ":", { value, actionType });

						// Process comma-separated values
						const processedValue = this._processCommaSeparatedValue(value);
						const valuesToProcess = Array.isArray(processedValue) ? processedValue : [processedValue];
						console.log("Values to process:", valuesToProcess);

						if (actionType === "remove") {
							// REMOVE action: remove specified values
							for (const singleValue of valuesToProcess) {
								const initialLength = currentValue.length;
								currentValue = currentValue.filter(item => !this._valueEquals(item, singleValue));
								if (currentValue.length < initialLength) {
									hasChanges = true;
									console.log(`✓ Removed "${singleValue}" from ${prop}`);
								} else {
									console.log(`⚠ Value "${singleValue}" not found in ${prop}`);
								}
							}
						} else {
							// ADD action: add values if they don't exist
							for (const singleValue of valuesToProcess) {
								const valueExists = currentValue.some(item => this._valueEquals(item, singleValue));
								if (!valueExists) {
									currentValue.push(singleValue);
									hasChanges = true;
									console.log(`✓ Added "${singleValue}" to ${prop}`);
								} else {
									console.log(`⚠ Value "${singleValue}" already exists in ${prop}`);
								}
							}
						}
					}

					console.log("Final value for", prop, ":", currentValue);

					// Apply changes if any
					if (hasChanges) {
						newFm[prop] = currentValue.length === 1 ? currentValue[0] : currentValue;
						changed = true;
						console.log("Applied changes for property:", prop);
					} else {
						console.log("No changes needed for property:", prop);
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
			if (op === "contains") return has;
			if (op === "notContains") return !has;
			return false;
		}
		const s = source == null ? "" : String(source);
		const e = expected == null ? "" : String(expected);
		if (op === "contains") return s.includes(e);
		if (op === "notContains") return !s.includes(e);
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
					const formattedItem = this._formatYamlValue(item);
					lines.push(`${spaces}  - ${formattedItem}`);
				}
			} else if (typeof value === 'object' && value !== null) {
				// Handle nested objects
				lines.push(`${spaces}${key}:`);
				lines.push(this._generateFormattedYaml(value, indent + 1));
			} else {
				// Handle simple values
				console.log(`Adding simple value for key "${key}": ${value}`);
				const formattedValue = this._formatYamlValue(value);
				lines.push(`${spaces}${key}: ${formattedValue}`);
			}
		}

		const result = lines.join('\n');
		console.log("Generated YAML lines:", lines);
		console.log("Final YAML result:", result);
		return result;
	}

	_formatYamlValue(value) {
		if (value === null || value === undefined) {
			return '';
		}

		const str = String(value);
		
		// Check if value needs quotes
		// Need quotes if:
		// - Contains special YAML characters: : { } [ ] , & * # ? | - < > = ! % @ `
		// - Starts or ends with whitespace
		// - Is a number-like string that should stay as string
		// - Contains newlines
		// - Is empty
		const needsQuotes = (
			str === '' ||
			str !== str.trim() ||
			/[:\{\}\[\],&*#\?|\-<>=!%@`]/.test(str) ||
			str.includes('\n') ||
			str.includes('"') ||
			str.includes("'")
		);

		if (needsQuotes) {
			// Use double quotes and escape any existing double quotes
			const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			return `"${escaped}"`;
		}

		return str;
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
				this.plugin.settings.rules.push({ ifProp: "", ifValue: "", op: "contains", thenActions: [{ prop: "", value: "", action: "add" }] });
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
			const current = rule.op || "contains";
			d.addOption("contains", "contains");
			d.addOption("notContains", "notContains");
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
		const addActionBtn = thenHeader.createEl("button", { text: "+ Add property", cls: "conditional-add-action" });
		addActionBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;
			e.stopImmediatePropagation();
			
			// Save scroll position before display
			const scrollContainer = this.containerEl.closest('.modal-content') || this.containerEl.parentElement;
			const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
			
			rule.thenActions.push({ prop: "", value: "", action: "add" });
			await this.plugin.saveData(this.plugin.settings);
			this.display();
			
			// Restore scroll position after display
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollTop;
			}
		}, true); // Use capture phase

		const runOne = actions.createEl("button", { text: "Run this rule", cls: "conditional-run-one eis-btn-primary" });
		runOne.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;
			e.stopImmediatePropagation();
			runOne.setAttribute('disabled', 'true');
			try {
				const result = await this.plugin.runScanForRules([this.plugin.settings.rules[idx]]);
				new Notice(`Conditional Properties: ${result.modified} modified / ${result.scanned} scanned (single rule)`);
			} finally {
				runOne.removeAttribute('disabled');
			}
		}, true);

		const del = actions.createEl("button", { text: "Remove", cls: "conditional-remove eis-btn-red" });
		del.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;
			e.stopImmediatePropagation();
			
			// Save scroll position before display
			const scrollContainer = this.containerEl.closest('.modal-content') || this.containerEl.parentElement;
			const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
			
			this.plugin.settings.rules.splice(idx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
			
			// Restore scroll position after display
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollTop;
			}
		}, true);
	}

	_renderThenAction(containerEl, rule, action, actionIdx, ruleIdx) {
		const actionWrap = containerEl.createEl("div", { cls: "conditional-then-action" });

		const actionSetting = new Setting(actionWrap).setName(`Property ${actionIdx + 1}`);

		// Ensure action has action field (backward compatibility)
		if (!action.action) {
			action.action = "add";
		}

		// Add remove button as first element in the setting's control area
		const settingItem = actionSetting.settingEl;
		const removeActionBtn = document.createElement("button");
		removeActionBtn.textContent = "×";
		removeActionBtn.className = "conditional-remove-action eis-btn-red";
		removeActionBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.returnValue = false;
			e.stopImmediatePropagation();
			
			// Save scroll position before display
			const scrollContainer = this.containerEl.closest('.modal-content') || this.containerEl.parentElement;
			const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
			
			rule.thenActions.splice(actionIdx, 1);
			await this.plugin.saveData(this.plugin.settings);
			this.display();
			
			// Restore scroll position after display
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollTop;
			}
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

		// Add action dropdown (ADD/REMOVE)
		actionSetting.addDropdown(d => {
			d.addOption("add", "ADD");
			d.addOption("remove", "REMOVE");
			d.setValue(action.action || "add");
			d.onChange(async (v) => {
				action.action = v;
				await this.plugin.saveData(this.plugin.settings);
			});
		});

		// Label "to value"
		const toLabel = document.createElement('span');
		toLabel.textContent = ' ';
		toLabel.classList.add('conditional-to-label');
		actionSetting.controlEl.appendChild(toLabel);

		actionSetting.addText(t => t
			.setPlaceholder("value (use commas to separate multiple values)")
			.setValue(action.value || "")
			.onChange(async (v) => {
				action.value = v;
				await this.plugin.saveData(this.plugin.settings);
			}));

		// Remove button is now always visible as part of the setting layout
	}
}

module.exports = ConditionalPropertiesPlugin;
