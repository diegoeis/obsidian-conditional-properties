/* eslint-disable */
const { Plugin, Notice, Setting, PluginSettingTab, parseYaml, stringifyYaml, moment } = require("obsidian");

class ConditionalPropertiesPlugin extends Plugin {
	async onload() {
		await this.loadData().then(settings => {
			this.settings = Object.assign({
				rules: [],
				scanIntervalMinutes: 5,
				lastRun: null,
				scanScope: "latestCreated",
				scanCount: 15,
				operatorMigrationVersion: 0
			}, settings);

			this._migrateRules();
		});
		this.registerInterval(this._setupScheduler());
		this.addCommand({
			id: "run-now",
			name: "Run conditional rules on vault",
			callback: async () => {
				const result = await this.runScan();
				new Notice(`Conditional Properties: ${result.modified} modified / ${result.scanned} scanned`);
			}
		});
		this.addCommand({
			id: "run-current-file",
			name: "Run conditional rules on current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (checking) {
					return file !== null;
				}
				if (!file) { new Notice("No active file."); return; }
				this.runScanOnFile(file).then(modified => {
					new Notice(modified ? "Conditional Properties: file modified" : "Conditional Properties: no changes");
				});
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
		if (!this.settings) return;
		const migrationVersion = this.settings.operatorMigrationVersion || 0;
		if (migrationVersion >= 2) return;

		let hasChanges = false;
		const ensureRuleArray = Array.isArray(this.settings.rules) ? this.settings.rules : [];
		const convertLegacyOperator = (op) => {
			if (!op || op === "contains") {
				if (op !== "exactly") hasChanges = true;
				return "exactly";
			}
			if (op === "notContains") {
				hasChanges = true;
				return "notContains";
			}
			return op;
		};
		const removeNotExactly = (op) => {
			if (op === "notExactly") {
				hasChanges = true;
				return "notContains";
			}
			return op;
		};

		this.settings.rules = ensureRuleArray.map(rule => {
			let migratedRule = rule;
			if (rule.thenProp !== undefined || rule.thenValue !== undefined) {
				migratedRule = {
					ifType: "PROPERTY",
					ifProp: rule.ifProp || "",
					ifValue: rule.ifValue || "",
					op: removeNotExactly(convertLegacyOperator(rule.op)),
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
			} else {
				if (rule.ifType === "TITLE" || rule.ifType === "HEADING_FIRST_LEVEL") {
					migratedRule = { ...migratedRule, ifType: "FIRST_LEVEL_HEADING" };
					hasChanges = true;
				} else if (rule.ifType === undefined) {
					migratedRule = { ...migratedRule, ifType: "PROPERTY" };
					hasChanges = true;
				}
				const updatedOp = removeNotExactly(convertLegacyOperator(migratedRule.op));
				if (updatedOp !== migratedRule.op) {
					migratedRule = { ...migratedRule, op: updatedOp };
				}
				if (Array.isArray(migratedRule.ifConditions)) {
					const convertedConditions = migratedRule.ifConditions.map(condition => {
						if (!condition) return condition;
						const nextOp = removeNotExactly(convertLegacyOperator(condition.op));
						if (nextOp !== condition.op) {
							hasChanges = true;
							return { ...condition, op: nextOp };
						}
						return condition;
					});
					if (convertedConditions !== migratedRule.ifConditions) {
						migratedRule = { ...migratedRule, ifConditions: convertedConditions };
					}
				}
			}
			return migratedRule;
		});

		this.settings.operatorMigrationVersion = 2;
		if (hasChanges || migrationVersion !== 2) {
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
			return allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, count);
		}
		return allFiles.sort((a, b) => b.stat.ctime - a.stat.ctime).slice(0, count);
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
		const rules = rulesOverride || this.settings.rules || [];
		if (!rules.length) return false;

		// Create a copy to avoid modifying the original
		const newFm = { ...(currentFrontmatter || {}) };
		let changed = false;
		let titleChanged = false;
		let newTitle = null;

		for (const rule of rules) {
			const { ifType, ifProp, ifValue, thenActions } = rule || {};
			const op = (rule?.op || "exactly"); // Default operator for new rules
			if (!Array.isArray(thenActions) || thenActions.length === 0) continue;

			let sourceValue;
			if (ifType === "FIRST_LEVEL_HEADING") {
				sourceValue = await this._getNoteTitle(file);

				// Permitir null apenas para operadores que testam ausência/vazio
				const allowsNull = op === "notExists" || op === "isEmpty";

				if (sourceValue === null && !allowsNull) {
					continue; // Pula apenas se operador NÃO permite null
				}
			} else {
				sourceValue = currentFrontmatter?.[ifProp];
				if (!ifProp) continue;
			}

			const match = this._matchesCondition(sourceValue, ifValue, op, ifType);
			if (!match) continue;

			// Process THEN actions
			for (const action of thenActions) {
				const { type = 'property', prop, value, action: actionType, modificationType, text } = action || {};
				
				// Handle title modification
				if (type === 'title' && text) {
					try {
						const currentTitle = await this._getNoteTitle(file);

						// Format the text with any placeholders
						const formattedText = this._formatText(text, file);

						// Handle different modification types
						if (modificationType === 'overwrite') {
							// Se título não existe (null), sempre criar
							// Se título existe, verificar duplicação
							if (currentTitle !== null && currentTitle === formattedText) {
								continue; // Skip if title is already the target value
							}
							newTitle = formattedText;
						} else {
							// Existing prefix/suffix logic
							// Para prefix/suffix, precisamos de um título existente
							if (currentTitle === null) {
								continue; // Skip prefix/suffix if no title exists
							}

							const alreadyHasModification = modificationType === 'prefix'
								? currentTitle.startsWith(formattedText)
								: currentTitle.endsWith(formattedText);

							if (alreadyHasModification) {
								continue; // Skip to next action as the modification is already applied
							}

							// Apply prefix or suffix
							newTitle = modificationType === 'prefix'
								? formattedText + currentTitle
								: currentTitle + formattedText;
						}

						titleChanged = true;
					} catch (e) {
						console.error(`Error modifying title for file ${file.path}:`, e);
					}
					continue;
				}

				// Handle property modifications (original functionality)
				if (!prop) continue;
				// Process any date placeholders in the value
				const processedValue = this._formatText(value, file);

				if (actionType === "add") {
					// Handle adding to arrays or creating new properties
					if (Array.isArray(newFm[prop])) {
						// If it's already an array, add unique values
						const valuesToAdd = processedValue.split(',').map(v => v.trim()).filter(v => v);
						valuesToAdd.forEach(v => {
							if (!newFm[prop].includes(v)) {
								newFm[prop].push(v);
								changed = true;
							}
						});
					} else if (newFm[prop]) {
						// Convert to array and add
						const currentArray = Array.isArray(newFm[prop]) ? newFm[prop] : [newFm[prop]];
						const valuesToAdd = processedValue.split(',').map(v => v.trim()).filter(v => v);
						valuesToAdd.forEach(v => {
							if (!currentArray.includes(v)) {
								currentArray.push(v);
								changed = true;
							}
						});
						newFm[prop] = currentArray.length === 1 ? currentArray[0] : currentArray;
					} else {
						// Create new property with processed value
						newFm[prop] = processedValue;
						changed = true;
					}
				} else if (actionType === "overwrite") {
					// Overwrite the entire property with processed value
					newFm[prop] = processedValue;
					changed = true;
				} else if (actionType === "remove") {
					// Process any date placeholders in the value before removal
					const processedValue = this._formatText(value, file);

					// Handle removing from arrays or properties
					if (Array.isArray(newFm[prop])) {
						const valuesToRemove = processedValue.split(',').map(v => v.trim()).filter(v => v);
						valuesToRemove.forEach(v => {
							const initialLength = newFm[prop].length;
							// Process each item in the array to handle date placeholders
							const processedItem = this._formatText(v, file);
							newFm[prop] = newFm[prop].filter(item => !this._valueEquals(item, processedItem));
							if (newFm[prop].length < initialLength) {
								changed = true;
							}
						});
					} else if (newFm[prop]) {
						// For non-arrays, check if it matches (after processing date placeholders) and remove
						if (this._valueEquals(newFm[prop], processedValue)) {
							delete newFm[prop];
							changed = true;
						}
					}
				} else if (actionType === "delete") {
					// Encontra o nome exato da propriedade (case insensitive)
					const propToDelete = Object.keys(newFm).find(key => {
						return key.toLowerCase() === prop.toLowerCase();
					});

					if (propToDelete) {
						// Define como undefined para garantir que será removido no _writeFrontmatter
						newFm[propToDelete] = undefined;
						changed = true;
					}
				}
			}
		}

		// Save changes if any
		if (changed || titleChanged) {
			if (titleChanged) {
				// Update the title in the file content
				await this._updateNoteTitle(file, newTitle);
			}
			if (changed) {
				await this._writeFrontmatter(file, newFm);
			}
			return true;
		}

		return false;
	}

	/**
	 * Formats text by replacing {date} placeholders with the file's creation date
	 * @param {string} text - The text containing placeholders
	 * @param {TFile} file - The file to get creation date from
	 * @returns {string} The formatted text with placeholders replaced
	 */
	_formatText(text, file) {
		// Get file creation date or use current date as fallback
		const getMomentDate = () => {
			try {
				// Try to get file creation date, fallback to current date
				return file && file.stat && file.stat.ctime
					? moment(file.stat.ctime)
					: moment();
			} catch (e) {
				console.error("Error getting file creation date:", e);
				return moment();
			}
		};

		// Handle date formatting
		const formatDate = (format) => {
			try {
				const momentDate = getMomentDate();
				// Use Obsidian's built-in date format if no specific format provided
				if (!format) {
					return momentDate.format(this.app.vault.config.dateFormat || 'YYYY-MM-DD');
				}
				return momentDate.format(format);
			} catch (e) {
				console.error("Error formatting date:", e);
				return "[date-format-error]";
			}
		};

		// Get filename (basename without extension)
		const getFilename = () => {
			try {
				return file && file.basename ? file.basename : "[no-filename]";
			} catch (e) {
				console.error("Error getting filename:", e);
				return "[filename-error]";
			}
		};

		// Replace {date}, {date:FORMAT}, and {filename} placeholders
		// Keep the exact formatting the user typed, just replace the placeholders
		return text.replace(/\{(date|filename)(?::([^}]+))?\}/g, (match, type, format) => {
			if (type === 'filename') {
				return getFilename();
			}
			// type === 'date'
			return formatDate(format);
		});
	}

	_matchesCondition(source, expected, op, ifType) {
		// Para os operadores 'exists' e 'notExists', verificamos apenas a existência da propriedade
		if (op === "exists") {
			// Retorna true se a propriedade existir (não for undefined ou null)
			return source !== undefined && source !== null;
		}

		if (op === "notExists") {
			// Retorna true se a propriedade não existir (for undefined ou null)
			return source === undefined || source === null;
		}

		// Para o operador 'isEmpty', verificamos se a propriedade existe mas está vazia
		if (op === "isEmpty") {
			// Para FIRST_LEVEL_HEADING: null significa que não existe (considerar como vazio)
			if (ifType === "FIRST_LEVEL_HEADING" && (source === undefined || source === null)) {
				return true;
			}
			// Para propriedades: retorna false se a propriedade não existir
			if (source === undefined || source === null) {
				return false;
			}
			// Verifica se é um array vazio
			if (Array.isArray(source)) {
				return source.length === 0;
			}
			// Verifica se é string vazia após normalização
			const normalizedSource = this._normalizeValue(source);
			return normalizedSource === "";
		}

		// Para os outros operadores, mantemos a lógica existente
		const normalizedExpected = this._normalizeValue(expected);
		const evaluate = (value) => {
			const normalizedSource = this._normalizeValue(value);
			switch (op) {
				case "exactly":
					return normalizedSource === normalizedExpected;
				case "contains":
					if (normalizedExpected === "") return false;
					return normalizedSource.includes(normalizedExpected);
				case "notContains":
					if (normalizedExpected === "") return true;
					return !normalizedSource.includes(normalizedExpected);
				default:
					return false;
			}
		};
		if (Array.isArray(source)) {
			if (op === "notContains") {
				return source.every(item => evaluate(item));
			}
			return source.some(item => evaluate(item));
		}
		return evaluate(source == null ? "" : source);
	}

	_normalizeValue(value) {
		const strValue = String(value ?? "");
		let normalized = strValue.replace(/\[\[([^\]]+)\]\]/g, "$1");
		if (normalized.startsWith('"') && normalized.endsWith('"') && normalized.length > 1) {
			normalized = normalized.slice(1, -1);
		}
		return normalized.trim();
	}

	_valueMatches(source, expected) {
		if (Array.isArray(source)) {
			return source.some(item => this._valueMatches(item, expected));
		}
		const normalizedSource = this._normalizeValue(source);
		const normalizedExpected = this._normalizeValue(expected);
		return normalizedSource === normalizedExpected;
	}

	_valueEquals(a, b) {
		return this._valueMatches(a, b);
	}

	async _getNoteTitle(file) {
		// Use MetadataCache to get heading information
		const cache = this.app.metadataCache.getFileCache(file);

		if (cache && cache.headings && cache.headings.length > 0) {
			// Find the first level 1 heading
			const firstH1 = cache.headings.find(heading => heading.level === 1);
			if (firstH1) {
				return firstH1.heading;
			}
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

	async _updateNoteTitle(file, newTitle) {
		await this.app.vault.process(file, (content) => {
			// Find the first heading (h1) in the content
			const headingMatch = content.match(/^#\s+(.+)$/m);

			if (headingMatch) {
				// Replace the existing heading
				return content.replace(/^#\s+.+$/m, `# ${newTitle}`);
			} else {
				// If no heading exists, add one at the top (after YAML if it exists)
				if (content.startsWith('---\n')) {
					const yamlEnd = content.indexOf('\n---\n', 4);
					if (yamlEnd !== -1) {
						const yaml = content.substring(0, yamlEnd + 5);
						const rest = content.substring(yamlEnd + 5).trim();
						return `${yaml}\n# ${newTitle}\n\n${rest}`.trim() + '\n';
					}
				}
				// No YAML, just add the heading at the top
				return `# ${newTitle}\n\n${content}`.trim() + '\n';
			}
		});
	}

	async _writeFrontmatter(file, newFrontmatter) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Process the new frontmatter properties
			Object.keys(newFrontmatter).forEach(key => {
				if (newFrontmatter[key] === null || newFrontmatter[key] === undefined) {
					// Remove the property if marked as null/undefined
					delete fm[key];
				} else {
					// Update the property value
					fm[key] = newFrontmatter[key];
				}
			});
		});
	}
}

class ConditionalPropertiesSettingTab extends PluginSettingTab {
	constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

	async exportSettings() {
		try {
			const settings = JSON.stringify(this.plugin.settings, null, 2);
			const blob = new Blob([settings], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `conditional-properties-settings-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			new Notice('Settings exported successfully!');
		} catch (error) {
			console.error('Error exporting settings:', error);
			new Notice('Failed to export settings: ' + error.message, 5000);
		}
	}

	async importSettings(file) {
		try {
			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					const settings = JSON.parse(e.target.result);
					// Validate the imported settings
					if (!settings || typeof settings !== 'object') {
						throw new Error('Invalid settings format');
					}

					// Merge with default settings to ensure all required fields are present
					this.plugin.settings = {
						rules: [],
						scanIntervalMinutes: 5,
						lastRun: null,
						scanScope: "latestCreated",
						scanCount: 15,
						operatorMigrationVersion: 2,
						...settings
					};

					await this.plugin.saveData(this.plugin.settings);
					new Notice('Settings imported successfully! The plugin will now reload.');
					this.display();
				} catch (parseError) {
					console.error('Error parsing settings file:', parseError);
					new Notice('Failed to parse settings file. Please check the file format.', 5000);
				}
			};
			reader.onerror = () => {
				new Notice('Error reading file', 5000);
			};
			reader.readAsText(file);
		} catch (error) {
			console.error('Error importing settings:', error);
			new Notice('Failed to import settings: ' + error.message, 5000);
		}
	}

	display() {
		try {
			const { containerEl } = this;
			containerEl.empty();
			const rootEl = containerEl.createEl("div", { attr: { id: "eis-cp-plugin" } });

			// Scan Interval Setting
			new Setting(rootEl)
				.setName("Scan interval (minutes)")
				.setDesc("Minimum 5 minutes")
				.addText(text => {
					text.setPlaceholder("5")
					.setValue(String(this.plugin.settings.scanIntervalMinutes || 5))
					.onChange(async (value) => {
						this.plugin.settings.scanIntervalMinutes = Math.max(5, Number(value) || 5);
						await this.plugin.saveData(this.plugin.settings);
						new Notice("Interval updated. Restart Obsidian to apply immediately.");
					});
				});

			// Scan Scope Setting
			new Setting(rootEl)
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

			// Number of Notes Setting (conditionally shown)
			if (this.plugin.settings.scanScope !== 'entireVault') {
				new Setting(rootEl)
					.setName("Notes to scan")
					.setDesc("Number of notes to scan (applies to Latest Created or Latest Modified scope, 1-1000)")
					.addText(text => {
						text.setPlaceholder("15")
						.setValue(String(this.plugin.settings.scanCount || 15))
						.onChange(async (value) => {
							const num = Math.max(1, Math.min(1000, Number(value) || 15));
							this.plugin.settings.scanCount = num;
							await this.plugin.saveData(this.plugin.settings);
						});
					});
			}

			// Add Export/Import Buttons
			const exportImportSetting = new Setting(rootEl)
				.setName("Backup and restore")
				.setDesc("Export or import your plugin settings");

			exportImportSetting.addButton(btn => {
				btn.setButtonText("Export settings")
					.onClick(() => this.exportSettings());
			});

			// Hidden file input for import
			const importInput = document.createElement('input');
			importInput.type = 'file';
			importInput.accept = '.json';
			importInput.style.display = 'none';
			importInput.addEventListener('change', (e) => {
				const file = e.target.files[0];
				if (file) {
					this.importSettings(file);
				}
				importInput.value = ''; // Reset input
			});

			exportImportSetting.addButton(btn => {
				btn.setButtonText("Import settings").setCta();
				btn.buttonEl.classList.add("eis-btn-border");
				btn.onClick(() => importInput.click());
			});

			rootEl.appendChild(importInput);

			// Run Now Button
			const runNow = new Setting(rootEl)
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
						} finally {
							btn.setDisabled(false);
						}
					});
				});

			// Rules Section
			new Setting(rootEl)
				.setName("Rules")
				.setHeading();
			this.plugin.settings.rules = this.plugin.settings.rules || [];

			// Add Rule Button
			const addWrap = rootEl.createEl("div", { cls: "setting-item" });
			const addBtn = addWrap.createEl("button", {
				text: "Add rule",
				cls: "mod-cta eis-btn"
			});

			addBtn.onclick = async () => {
				this.plugin.settings.rules.push({ 
					ifType: "PROPERTY", 
					ifProp: "", 
					ifValue: "", 
					op: "exactly", 
					thenActions: [{ 
						prop: "", 
						value: "", 
						action: "add" 
					}] 
				});
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			};

			// Render Rules
			this.plugin.settings.rules.slice().reverse().forEach((rule, idxReversed) => {
				const originalIndex = this.plugin.settings.rules.length - 1 - idxReversed;
				this._renderRule(rootEl, rule, originalIndex);
			});

		} catch (error) {
			console.error("Error in display():", error);
			new Notice("An error occurred while loading the settings. Check the console for details.", 5000);
		}
	}

	_renderRule(containerEl, rule, idx) {
		const wrap = containerEl.createEl("div", { cls: "conditional-rule" });
		if (!Array.isArray(rule.thenActions)) {
			rule.thenActions = [{ prop: "", value: "", action: "add" }];
		}
		if (!rule.ifType) {
			rule.ifType = "PROPERTY";
		}

		const line1 = new Setting(wrap).setName("If");
		line1.addDropdown(d => {
			d.addOption("PROPERTY", "Property");
			d.addOption("FIRST_LEVEL_HEADING", "First level heading");
			d.setValue(rule.ifType || "PROPERTY");
			d.onChange(async (v) => {
				rule.ifType = v;
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});
		});

		if (rule.ifType === "FIRST_LEVEL_HEADING") {
			// For TITLE: show operator and value (check is done during execution)
			line1.addDropdown(d => {
				this._configureOperatorDropdown(d, rule.op || "exactly", async (value) => {
					rule.op = value;
					// Se for 'exists', 'notExists' ou 'isEmpty', limpa o valor
					if (value === 'exists' || value === 'notExists' || value === 'isEmpty') {
						rule.ifValue = '';
					}
					await this.plugin.saveData(this.plugin.settings);
					// Recarrega a visualização para atualizar a interface
					this.display();
				});
			});

			// Adiciona o campo de texto apenas se não for 'exists', 'notExists' ou 'isEmpty'
			if (rule.op !== 'exists' && rule.op !== 'notExists' && rule.op !== 'isEmpty') {
				line1.addText(t => t
					.setPlaceholder("heading text")
					.setValue(rule.ifValue || "")
					.onChange(async (v) => {
						rule.ifValue = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			}
		} else {
			// Adiciona o campo de nome da propriedade
			const propInput = line1.addText(t => t
				.setPlaceholder("property")
				.setValue(rule.ifProp || "")
				.onChange(async (v) => {
					rule.ifProp = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
			
			// Adiciona o dropdown de operadores
			const dropdown = line1.addDropdown(d => {
				this._configureOperatorDropdown(d, rule.op || "exactly", async (value) => {
					rule.op = value;
					// Se for 'exists', 'notExists' ou 'isEmpty', limpa o valor
					if (value === 'exists' || value === 'notExists' || value === 'isEmpty') {
						rule.ifValue = '';
					}
					await this.plugin.saveData(this.plugin.settings);
					// Recarrega a visualização para atualizar a interface
					this.display();
				});
			});

			// Adiciona o campo de valor apenas se não for 'exists', 'notExists' ou 'isEmpty'
			if (rule.op !== 'exists' && rule.op !== 'notExists' && rule.op !== 'isEmpty') {
				line1.addText(t => t
					.setPlaceholder("value")
					.setValue(rule.ifValue || "")
					.onChange(async (v) => {
						rule.ifValue = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			}
		}

		const thenHeader = wrap.createEl("div", { cls: "conditional-rules-header" });
		thenHeader.createEl("strong", { text: "Then:" });

		rule.thenActions.forEach((action, actionIdx) => {
			this._renderThenAction(wrap, rule, action, actionIdx, idx);
		});

		const actions = wrap.createEl("div", { cls: "conditional-actions" });
		const addActionBtn = actions.createEl("button", { text: "Add action", cls: "eis-btn conditional-add-action" });
		addActionBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			rule.thenActions.push({
				type: "property",
				prop: "",
				value: "",
				action: "add"
			});
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

	_configureOperatorDropdown(dropdown, currentValue, onChange) {
		const options = [
			{ value: "exactly", label: "exactly match" },
			{ value: "contains", label: "contains" },
			{ value: "notContains", label: "does not contain" },
			{ value: "exists", label: "exists" },
			{ value: "notExists", label: "does not exist" },
			{ value: "isEmpty", label: "is empty" }
		];
		options.forEach(({ value, label }) => dropdown.addOption(value, label));
		const fallback = options.some(option => option.value === currentValue) ? currentValue : "exactly";
		dropdown.setValue(fallback);
		dropdown.onChange(async (value) => {
			if (typeof onChange === "function") {
				await onChange(value);
			}
		});
	}
	
     // Atualiza o estado do campo de valor com base no operador selecionado
    _updateValueInputState(inputEl, operator) {
        // Verifica se o elemento de entrada é válido
        if (!inputEl) return;

        try {
            // Esconde o campo de valor se o operador for 'exists', 'notExists' ou 'isEmpty'
            const shouldHide = operator === 'exists' || operator === 'notExists' || operator === 'isEmpty';

            if (shouldHide) {
                inputEl.style.display = 'none';
                inputEl.disabled = true;
            } else {
                inputEl.style.display = '';
                inputEl.disabled = false;
                inputEl.removeAttribute('title');
                inputEl.classList.remove('disabled-input');
            }
        } catch (error) {
            console.error('Error updating value field state:', error);
        }
    }

	_renderThenAction(containerEl, rule, action, actionIdx, ruleIdx) {
		const actionWrap = containerEl.createEl("div", { cls: "conditional-then-action" });
		const actionSetting = new Setting(actionWrap).setName(`Action ${actionIdx + 1}`);
		
		// Initialize action type if not set
		if (!action.type) {
			action.type = "property";
		}
		if (!action.action && action.type === "property") {
			action.action = "add";
		}

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

		// Action type selector (Title or Property)
		actionSetting.addDropdown(d => {
			d.addOption("property", "Change property");
			d.addOption("title", "Change title");
			d.setValue(action.type || "property");
			d.onChange(async (v) => {
				action.type = v;
				if (v === "title") {
					action.action = "modify";
				}
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});
		});

		if (action.type === "property") {
			// Property modification controls
			actionSetting.addText(t => t
				.setPlaceholder("property name")
				.setValue(action.prop || "")
				.onChange(async (v) => {
					action.prop = v;
					await this.plugin.saveData(this.plugin.settings);
				}));

			actionSetting.addDropdown(d => {
				d.addOption("add", "Add value");
				d.addOption("remove", "Remove value");
				d.addOption("overwrite", "Overwrite all values with");
				d.addOption("delete", "Delete property");
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
		} else {
			// Title modification controls
			actionSetting.addDropdown(d => {
				d.addOption("prefix", "Add prefix");
				d.addOption("suffix", "Add suffix");
				d.addOption("overwrite", "Overwrite to");
				d.setValue(action.modificationType || "prefix");
				d.onChange(async (v) => {
					action.modificationType = v;
					await this.plugin.saveData(this.plugin.settings);
				});
			});

			actionSetting.addText(t => t
				.setPlaceholder("Text (use {date}, {date:FORMAT}, or {filename})")
				.setValue(action.text || "")
				.onChange(async (v) => {
					action.text = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
		}

		// Append remove button after other controls so it renders last
		const controlEl = actionSetting.controlEl || settingItem.querySelector(".setting-item-control");
		if (controlEl) {
			controlEl.appendChild(removeActionBtn);
		} else {
			settingItem.appendChild(removeActionBtn);
		}
	}
}

module.exports = ConditionalPropertiesPlugin;
