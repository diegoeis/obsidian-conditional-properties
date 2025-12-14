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
				scanCount: 15,
				operatorMigrationVersion: 0
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
				// If no title available, show error message and skip rule
				if (sourceValue === null) {
					console.log(`No title available for file "${file.basename}". Rule skipped.`);
					continue;
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
						if (currentTitle === null) {
							console.log(`No title available for modification in file "${file.basename}"`);
							continue;
						}

						// Format the text with any date placeholders
						const formattedText = this._formatText(text, file);
						
						// Check if the title already has this modification
						const alreadyHasModification = modificationType === 'prefix' 
							? currentTitle.startsWith(formattedText)
							: currentTitle.endsWith(formattedText);
						
						if (alreadyHasModification) {
							console.log(`Title already has the ${modificationType}: "${currentTitle}"`);
							continue; // Skip to next action as the modification is already applied
						}

						// Apply prefix or suffix
						newTitle = modificationType === 'prefix' 
							? formattedText + currentTitle 
							: currentTitle + formattedText;
						
						titleChanged = true;
						console.log(`Title changed to: ${newTitle}`);
					} catch (e) {
						console.error(`Error modifying title for file ${file.path}:`, e);
					}
					continue;
				}

				// Handle property modifications (original functionality)
				if (!prop) continue;
				console.log(`Processing THEN action: prop="${prop}", value="${value}", actionType="${actionType}"`);
								// Process any date placeholders in the value
					const processedValue = this._formatText(value, file);
					console.log(`[DEBUG] Processing action: prop="${prop}", actionType="${actionType}", value="${value}", processedValue="${processedValue}"`);

					if (actionType === "add") {
					// Handle adding to arrays or creating new properties
					if (Array.isArray(newFm[prop])) {
						// If it's already an array, add unique values
						const valuesToAdd = processedValue.split(',').map(v => v.trim()).filter(v => v);
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
						const valuesToAdd = processedValue.split(',').map(v => v.trim()).filter(v => v);
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
						// Create new property with processed value
						newFm[prop] = processedValue;
						changed = true;
						console.log(`Created new property ${prop} with value "${value}"`);
					}
				} else if (actionType === "overwrite") {
					// Overwrite the entire property with processed value
					newFm[prop] = processedValue;
					changed = true;
					console.log(`Overwritten ${prop} with "${processedValue}"`);
				} else if (actionType === "remove") {
					// Process any date placeholders in the value before removal
					const processedValue = this._formatText(value, file);
					
					// Handle removing from arrays or properties
					if (Array.isArray(newFm[prop])) {
						const valuesToRemove = processedValue.split(',').map(v => v.trim()).filter(v => v);
						console.log(`Removing from array: ${valuesToRemove}`);
						valuesToRemove.forEach(v => {
							const initialLength = newFm[prop].length;
							// Process each item in the array to handle date placeholders
							const processedItem = this._formatText(v, file);
							newFm[prop] = newFm[prop].filter(item => !this._valueEquals(item, processedItem));
							if (newFm[prop].length < initialLength) {
								changed = true;
								console.log(`Removed "${processedItem}" from ${prop}`);
							} else {
								console.log(`"${processedItem}" not found in ${prop}`);
							}
						});
					} else if (newFm[prop]) {
						// For non-arrays, check if it matches (after processing date placeholders) and remove
						if (this._valueEquals(newFm[prop], processedValue)) {
							delete newFm[prop];
							changed = true;
							console.log(`Removed property ${prop}`);
						} else {
							console.log(`Value "${processedValue}" not found in ${prop}`);
						}
					}
				} else if (actionType === "delete") {
					console.log(`[DEBUG] ====== INICIANDO AÇÃO DELETE PROPERTY ======`);
					console.log(`[DEBUG] Propriedade a ser deletada: "${prop}"`);
					console.log(`[DEBUG] Propriedades atuais no frontmatter:`, Object.keys(newFm));
					
					// Encontra o nome exato da propriedade (case insensitive)
					const propToDelete = Object.keys(newFm).find(key => {
						const match = key.toLowerCase() === prop.toLowerCase();
						console.log(`[DEBUG] Comparando: "${key}" com "${prop}" - ${match ? 'MATCH' : 'não'}`);
						return match;
					});
					
					console.log(`[DEBUG] Propriedade encontrada para deletar:`, propToDelete);
					
					if (propToDelete) {
					console.log(`[DEBUG] Deletando propriedade "${propToDelete}"`);
					// Define como undefined para garantir que será removido no _writeFrontmatter
					newFm[propToDelete] = undefined;
					changed = true;
					console.log(`[DEBUG] Propriedade "${propToDelete}" marcada para deleção`);
					console.log(`[DEBUG] Propriedades após marcação para deleção:`, Object.keys(newFm).filter(k => newFm[k] !== undefined));
					} else {
						console.log(`[ERRO] Não foi possível encontrar a propriedade "${prop}" para deletar`);
						console.log(`[DEBUG] Propriedades disponíveis:`, Object.keys(newFm));
					}
				}
			}
		}

		// Save changes if any
		console.log(`[DEBUG] Verificando alterações - changed: ${changed}, titleChanged: ${titleChanged}`);
		if (changed || titleChanged) {
			console.log(`[DEBUG] Salvando alterações no arquivo: "${file.basename}" (${file.path})`);
			console.log(`[DEBUG] Novo frontmatter:`, newFm);
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
					? window.moment(file.stat.ctime) 
					: window.moment();
			} catch (e) {
				console.error("Error getting file creation date:", e);
				return window.moment();
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

		// Replace {date} and {date:FORMAT} placeholders
		// Keep the exact formatting the user typed, just replace the {date} part
		return text.replace(/\{date(?::([^}]+))?\}/g, (match, format) => {
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
			// Retorna false se a propriedade não existir
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
		console.log(`Comparing "${String(source || '')}" (normalized: "${normalizedSource}") with "${String(expected || '')}" (normalized: "${normalizedExpected}")`);
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

	async _updateNoteTitle(file, newTitle) {
		let content = await this.app.vault.read(file);
		
		// Find the first heading (h1) in the content
		const headingMatch = content.match(/^#\s+(.+)$/m);
		
		if (headingMatch) {
			// Replace the existing heading
			content = content.replace(/^#\s+.+$/m, `# ${newTitle}`);
		} else {
			// If no heading exists, add one at the top (after YAML if it exists)
			if (content.startsWith('---\n')) {
				const yamlEnd = content.indexOf('\n---\n', 4);
				if (yamlEnd !== -1) {
					const yaml = content.substring(0, yamlEnd + 5);
					const rest = content.substring(yamlEnd + 5).trim();
					content = `${yaml}\n# ${newTitle}\n\n${rest}`.trim() + '\n';
				}
			} else {
				// No YAML, just add the heading at the top
				content = `# ${newTitle}\n\n${content}`.trim() + '\n';
			}
		}
		
		await this.app.vault.modify(file, content);
	}

	async _writeFrontmatter(file, newFrontmatter) {
		console.log(`[DEBUG] _writeFrontmatter - Iniciando escrita do frontmatter`);
		console.log(`[DEBUG] Novos valores do frontmatter:`, newFrontmatter);
		
		const content = await this.app.vault.read(file);
		const hasYaml = content.startsWith("---\n");
		
		if (!hasYaml) {
			console.log(`[DEBUG] Nenhum YAML encontrado, criando novo`);
			// Remove propriedades nulas/indefinidas
			Object.keys(newFrontmatter).forEach(key => {
				if (newFrontmatter[key] === null || newFrontmatter[key] === undefined) {
					delete newFrontmatter[key];
				}
			});
			
			const yamlStr = stringifyYaml(newFrontmatter).trim();
			const newContent = `---\n${yamlStr}\n---\n${content}`;
			await this.app.vault.modify(file, newContent);
			console.log(`[DEBUG] Novo YAML criado com sucesso`);
			return;
		}
		
		const end = content.indexOf("\n---\n", 4);
		if (end === -1) return;
		
		const yamlRaw = content.substring(4, end);
		const body = content.substring(end + 5);
		let fm = {};
		try { 
			fm = parseYaml(yamlRaw) || {}; 
		} catch (e) { 
			console.error("[ERRO] Erro ao fazer parse do YAML:", e);
			fm = {}; 
		}
		
		console.log(`[DEBUG] Frontmatter atual:`, fm);
		
		// Atualiza o frontmatter com as novas propriedades
		const updatedFm = { ...fm };
		
		// Processa as propriedades do novo frontmatter
		Object.keys(newFrontmatter).forEach(key => {
			if (newFrontmatter[key] === null || newFrontmatter[key] === undefined) {
				// Remove a propriedade se estiver marcada como nula/indefinida
				delete updatedFm[key];
			} else {
				// Atualiza o valor da propriedade
				updatedFm[key] = newFrontmatter[key];
			}
		});
		
		console.log(`[DEBUG] Frontmatter atualizado:`, updatedFm);
		
		// Gera o YAML final
		const updatedYaml = stringifyYaml(updatedFm).trim();
		const newContent = `---\n${updatedYaml}\n---\n${body}`;
		
		console.log(`[DEBUG] Salvando alterações no arquivo`);
		await this.app.vault.modify(file, newContent);
		console.log(`[DEBUG] Alterações salvas com sucesso`);
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

			// Header
			containerEl.createEl("h1", { text: "Conditional Properties" });
			containerEl.createEl("p", { text: "Create rules to change note properties values based in custom conditions." });

			// Configurations Section
			containerEl.createEl("h3", { text: "Configurations" });

			// Scan Interval Setting
			new Setting(containerEl)
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

			// Number of Notes Setting (conditionally shown)
			if (this.plugin.settings.scanScope !== 'entireVault') {
				new Setting(containerEl)
					.setName("Number of notes")
					.setDesc("Number of recent created notes to scan (1-1000)")
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

			// Add Export/Import Buttons to Configurations
			const exportImportSetting = new Setting(containerEl)
				.setName("Backup & Restore")
				.setDesc("Export or import your plugin settings");

			exportImportSetting.addButton(btn => {
				btn.setButtonText("Export Settings")
					.setCta()
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
				btn.setButtonText("Import Settings")
					.setWarning();
				btn.buttonEl.classList.add("eis-btn-border");
				btn.onClick(() => importInput.click());
			});

			containerEl.appendChild(importInput);

			// Run Now Button
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
						} finally { 
							btn.setDisabled(false); 
						}
					});
				});

			// Rules Section
			containerEl.createEl("h3", { text: "Rules" });
			this.plugin.settings.rules = this.plugin.settings.rules || [];

			// Add Rule Button
			const addWrap = containerEl.createEl("div", { cls: "setting-item" });
			const addBtn = addWrap.createEl("button", { 
				text: "+ Add Rule", 
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
				this._renderRule(containerEl, rule, originalIndex);
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

		const line1 = new Setting(wrap).setName("IF");
		line1.addDropdown(d => {
			d.addOption("PROPERTY", "Property");
			d.addOption("FIRST_LEVEL_HEADING", "First Level Heading");
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
					await this.plugin.saveData(this.plugin.settings);
				});
			});
			line1.addText(t => t
				.setPlaceholder("heading text")
				.setValue(rule.ifValue || "")
				.onChange(async (v) => {
					rule.ifValue = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
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
					// Se for 'exists' ou 'notExists', limpa o valor
					if (value === 'exists' || value === 'notExists') {
						rule.ifValue = '';
					}
					await this.plugin.saveData(this.plugin.settings);
					// Recarrega a visualização para atualizar a interface
					this.display();
				});
			});
			
			// Adiciona o campo de valor apenas se não for 'exists' ou 'notExists'
			if (rule.op !== 'exists' && rule.op !== 'notExists') {
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
		thenHeader.createEl("strong", { text: "THEN:" });

		rule.thenActions.forEach((action, actionIdx) => {
			this._renderThenAction(wrap, rule, action, actionIdx, idx);
		});

		const actions = wrap.createEl("div", { cls: "conditional-actions" });
		const addActionBtn = actions.createEl("button", { text: "+ Add action", cls: "eis-btn conditional-add-action" });
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
            console.error('Erro ao atualizar estado do campo de valor:', error);
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

		// Action type selector (Title or Property)
		actionSetting.addDropdown(d => {
			d.addOption("property", "Change Property");
			d.addOption("title", "Change Title");
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
		} else {
			// Title modification controls
			actionSetting.addDropdown(d => {
				d.addOption("prefix", "Add prefix");
				d.addOption("suffix", "Add suffix");
				d.setValue(action.modificationType || "prefix");
				d.onChange(async (v) => {
					action.modificationType = v;
					await this.plugin.saveData(this.plugin.settings);
				});
			});

			actionSetting.addText(t => t
				.setPlaceholder("Text to add (use {date} or {date:FORMAT} for dates)")
				.setValue(action.text || "")
				.onChange(async (v) => {
					action.text = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
		}
	}
}

module.exports = ConditionalPropertiesPlugin;
