/* eslint-disable */
const { Plugin, Notice, Setting, PluginSettingTab, ButtonComponent, DropdownComponent, parseYaml, stringifyYaml, moment } = require("obsidian");

class ConditionalPropertiesPlugin extends Plugin {
	async onload() {
		const loaded = await this.loadData();
		this.settings = Object.assign({
			rules: [],
			scanIntervalMinutes: 5,
			lastRun: null,
			scanScope: "latestCreated",
			scanCount: 15,
			operatorMigrationVersion: 0
		}, loaded);
		await this._migrateRules();
		this.registerInterval(this._setupScheduler());
		this.addCommand({
			id: "run-now",
			name: "Run conditional rules on vault",
			checkCallback: (checking) => {
				if (checking) return !this.isScanRunning();
				this.runScan().then(result => {
					if (result.busy) return;
					this._notifyScanResult(result, "vault");
				});
			}
		});
		this.addCommand({
			id: "stop-scan",
			name: "Stop running scan",
			checkCallback: (checking) => {
				if (checking) return this.isScanRunning();
				this.requestStopScan();
				new Notice("Conditional Properties: stop requested — finishing current file");
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

	async _writeMigrationBackup() {
		try {
			const adapter = this.app.vault.adapter;
			const pluginDir = this.manifest && this.manifest.dir
				? this.manifest.dir
				: `${this.app.vault.configDir}/plugins/${this.manifest ? this.manifest.id : "conditional-properties"}`;
			const dataPath = `${pluginDir}/data.json`;
			const backupPath = `${pluginDir}/data.backup.json`;
			const exists = await adapter.exists(dataPath);
			if (!exists) return;
			const raw = await adapter.read(dataPath);
			await adapter.write(backupPath, raw);
		} catch (e) {
			console.error("ConditionalProperties: failed to write migration backup", e);
		}
	}

	async _migrateRules() {
		if (!this.settings) return;
		const migrationVersion = this.settings.operatorMigrationVersion || 0;
		if (migrationVersion >= 3) return;

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

		// v3 migration — flatten single-condition legacy rules into conditions[] + match
		const needsV3Migration = this.settings.rules.some(rule =>
			rule && !Array.isArray(rule.conditions) && (
				rule.ifType !== undefined ||
				rule.ifProp !== undefined ||
				rule.ifValue !== undefined ||
				rule.op !== undefined
			)
		);

		if (needsV3Migration && migrationVersion < 3) {
			// Backup BEFORE any mutation so user can recover the pre-v3 data.json
			await this._writeMigrationBackup();

			this.settings.rules = this.settings.rules.map(rule => {
				if (!rule) return rule;
				if (Array.isArray(rule.conditions)) return rule;

				const condition = {
					ifType: rule.ifType || "PROPERTY",
					ifProp: rule.ifProp || "",
					ifValue: rule.ifValue || "",
					op: rule.op || "exactly"
				};
				const migrated = {
					match: "any",
					conditions: [condition],
					thenActions: Array.isArray(rule.thenActions) ? rule.thenActions : []
				};
				return migrated;
			});
			hasChanges = true;
		}

		// Also ensure rules already in the new shape have a sane match value
		this.settings.rules = this.settings.rules.map(rule => {
			if (!rule || !Array.isArray(rule.conditions)) return rule;
			if (rule.match !== "any" && rule.match !== "all") {
				return { ...rule, match: "any" };
			}
			return rule;
		});

		this.settings.operatorMigrationVersion = 3;
		if (hasChanges || migrationVersion !== 3) {
			this.saveData(this.settings);
		}
	}

	async runScan() {
		if (this._scanRunning) {
			return { scanned: 0, modified: 0, stopped: false, busy: true };
		}
		const { metadataCache } = this.app;
		const files = this._getFilesToScan();
		let modifiedCount = 0;
		let scannedCount = 0;
		let stopped = false;
		this._scanRunning = true;
		this._cancelScan = false;
		this._emitScanStateChange();
		try {
			for (const file of files) {
				if (this._cancelScan) { stopped = true; break; }
				const cache = metadataCache.getFileCache(file) || {};
				const frontmatter = cache.frontmatter ?? {};
				const applied = await this.applyRulesToFrontmatter(file, frontmatter);
				if (applied) modifiedCount++;
				scannedCount++;
			}
			this.settings.lastRun = new Date().toISOString();
			await this.saveData(this.settings);
		} finally {
			this._scanRunning = false;
			this._cancelScan = false;
			this._emitScanStateChange();
		}
		return { scanned: scannedCount, total: files.length, modified: modifiedCount, stopped };
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
		if (this._scanRunning) {
			return { scanned: 0, modified: 0, stopped: false, busy: true };
		}
		const { metadataCache } = this.app;
		const files = this._getFilesToScan();
		let modifiedCount = 0;
		let scannedCount = 0;
		let stopped = false;
		this._scanRunning = true;
		this._cancelScan = false;
		this._emitScanStateChange();
		try {
			for (const file of files) {
				if (this._cancelScan) { stopped = true; break; }
				const cache = metadataCache.getFileCache(file) || {};
				const frontmatter = cache.frontmatter ?? {};
				const applied = await this.applyRulesToFrontmatter(file, frontmatter, rulesSubset);
				if (applied) modifiedCount++;
				scannedCount++;
			}
		} finally {
			this._scanRunning = false;
			this._cancelScan = false;
			this._emitScanStateChange();
		}
		return { scanned: scannedCount, total: files.length, modified: modifiedCount, stopped };
	}

	_notifyScanResult(result, label) {
		const base = `Conditional Properties: ${result.modified} modified / ${result.scanned} scanned`;
		if (result.stopped) {
			const skipped = (result.total || 0) - (result.scanned || 0);
			new Notice(`${base} — stopped (skipped ${skipped} of ${result.total})`);
		} else {
			new Notice(label === "rule" ? `${base} (single rule)` : base);
		}
	}

	requestStopScan() {
		if (this._scanRunning) {
			this._cancelScan = true;
		}
	}

	isScanRunning() {
		return !!this._scanRunning;
	}

	onScanStateChange(callback) {
		// Lightweight pub/sub so the settings tab can react without polling.
		// Returns an unsubscribe function.
		if (!this._scanStateListeners) this._scanStateListeners = new Set();
		this._scanStateListeners.add(callback);
		return () => this._scanStateListeners.delete(callback);
	}

	_emitScanStateChange() {
		if (!this._scanStateListeners) return;
		for (const cb of this._scanStateListeners) {
			try { cb(); } catch (e) { console.error("ConditionalProperties: listener error", e); }
		}
	}

	async runScanOnFile(file) {
		const cache = this.app.metadataCache.getFileCache(file) || {};
		const frontmatter = cache.frontmatter ?? {};
		return await this.applyRulesToFrontmatter(file, frontmatter);
	}

	async applyRulesToFrontmatter(file, currentFrontmatter, rulesOverride) {
		const rules = rulesOverride || this.settings.rules || [];
		if (!rules.length) return false;

		// Deep-clone the frontmatter snapshot so we never mutate the array/object
		// references that live inside Obsidian's metadataCache. A shallow `{...}`
		// copy still shares array references (e.g. tags), which caused mutations
		// to leak into the cache and made subsequent runs see stale "already
		// applied" state.
		const newFm = JSON.parse(JSON.stringify(currentFrontmatter || {}));
		let changed = false;
		let titleChanged = false;
		let newTitle = null;

		for (let ruleIdx = 0; ruleIdx < rules.length; ruleIdx++) {
			const rule = rules[ruleIdx];
			const { thenActions } = rule || {};
			if (!Array.isArray(thenActions) || thenActions.length === 0) continue;

			const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
			if (conditions.length === 0) continue;

			const matchMode = rule.match === "all" ? "all" : "any";

			const evaluateCondition = async (cond) => {
				try {
					const cType = cond.ifType || "PROPERTY";
					const cOp = cond.op || "exactly";
					let sourceValue;
					if (cType === "FIRST_LEVEL_HEADING") {
						sourceValue = await this._getNoteTitle(file);
						const allowsNull = cOp === "notExists" || cOp === "isEmpty";
						if (sourceValue === null && !allowsNull) return false;
					} else {
						if (!cond.ifProp) return false;
						sourceValue = currentFrontmatter?.[cond.ifProp];
					}
					return this._matchesCondition(sourceValue, cond.ifValue, cOp, cType, cond.ifProp);
				} catch (e) {
					console.error(`ConditionalProperties: condition error in rule ${ruleIdx}`, e);
					return false;
				}
			};

			let matched;
			if (matchMode === "all") {
				matched = true;
				for (const cond of conditions) {
					if (!(await evaluateCondition(cond))) { matched = false; break; }
				}
			} else {
				matched = false;
				for (const cond of conditions) {
					if (await evaluateCondition(cond)) { matched = true; break; }
				}
			}

			if (!matched) continue;

			// Process THEN actions
			for (const action of thenActions) {
				const { type = 'property', prop, value, action: actionType, modificationType, text } = action || {};
				
				// Handle title modification
				if (type === 'title' && text) {
					try {
						const currentTitle = await this._getNoteTitle(file);

						// Format the text with any placeholders
						const formattedText = this._formatText(text, file, newFm);

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
				const processedValue = this._formatText(value, file, newFm);
				const propType = this._getPropertyType(prop);
				const isScalarTyped = propType === "checkbox" || propType === "date" || propType === "datetime";

				if (actionType === "add") {
					if (isScalarTyped) {
						// Checkbox / date / datetime are scalar by nature — `add` collapses
						// into `overwrite` so users never end up with `[true, false]` arrays
						// or two ISO dates in a field meant to hold one value.
						newFm[prop] = this._coerceValueForProperty(prop, processedValue, propType);
						changed = true;
					} else if (Array.isArray(newFm[prop])) {
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
					// Overwrite the entire property with processed value (typed when applicable)
					newFm[prop] = this._coerceValueForProperty(prop, processedValue, propType);
					changed = true;
				} else if (actionType === "remove") {
					// Process any date placeholders in the value before removal
					const processedValue = this._formatText(value, file, newFm);

					// Handle removing from arrays or properties
					if (Array.isArray(newFm[prop])) {
						const valuesToRemove = processedValue.split(',').map(v => v.trim()).filter(v => v);
						valuesToRemove.forEach(v => {
							const initialLength = newFm[prop].length;
							// Process each item in the array to handle date placeholders
							const processedItem = this._formatText(v, file, newFm);
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
				} else if (actionType === "rename") {
					// Rename property: prop -> newPropName
					const { newPropName } = action;

					if (!newPropName) continue; // Skip if no new name specified

					// Find the exact property name (case insensitive)
					const propToRename = Object.keys(newFm).find(key => {
						return key.toLowerCase() === prop.toLowerCase();
					});

					if (propToRename) {
						// Check if target property name already exists
						const targetExists = Object.keys(newFm).some(key => {
							return key.toLowerCase() === newPropName.toLowerCase();
						});

						if (!targetExists) {
							// Copy value to new property name
							newFm[newPropName] = newFm[propToRename];
							// Mark old property for deletion
							newFm[propToRename] = undefined;
							changed = true;
						}
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
	_formatText(text, file, fm) {
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

		// Resolve a frontmatter property reference to a string. Missing /
		// null / undefined collapses to "". Arrays join with ", ". Other
		// scalars stringify via String(). Falls back to the live metadata
		// cache when `fm` is not supplied (defensive — all in-tree callers
		// now pass the in-progress newFm).
		const getProperty = (name) => {
			try {
				const key = (name || "").trim();
				if (!key) return "";
				let source = fm;
				if (!source && file) {
					const cache = this.app.metadataCache.getFileCache(file);
					source = cache && cache.frontmatter ? cache.frontmatter : null;
				}
				if (!source) return "";
				const value = source[key];
				if (value === undefined || value === null) return "";
				if (Array.isArray(value)) return value.join(", ");
				return String(value);
			} catch (e) {
				console.error("Error resolving property placeholder:", e);
				return "";
			}
		};

		// Two-pass replace so {date}/{date:FORMAT}/{filename} keep their
		// existing semantics and never get mistaken for a property lookup.
		// Pass 1 — reserved placeholders.
		let out = text.replace(/\{(date|filename)(?::([^}]+))?\}/g, (match, type, format) => {
			if (type === 'filename') {
				return getFilename();
			}
			return formatDate(format);
		});

		// Pass 2 — any other {name} reference is treated as a frontmatter
		// property lookup. The `[^}:\s]` class excludes ':' (so a stray
		// {date:FORMAT} survivor wouldn't match) and whitespace, while
		// still allowing g_excerpt, kebab-case, dotted, etc.
		out = out.replace(/\{([^}:\s][^}:]*)\}/g, (match, name) => getProperty(name));

		return out;
	}

	_matchesCondition(source, expected, op, ifType, propName) {
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

		// Typed-property awareness in IF: when the property is registered as
		// checkbox / date / datetime in Obsidian's metadata type manager,
		// coerce the user-entered `expected` value through the same pipeline
		// the THEN side uses. This lets the user type `08-08-2025` against a
		// `date` property that stores `2025-08-08`, or `true` against a
		// `checkbox` property that stores boolean `true`, and have the
		// comparison succeed.
		let comparableExpected = expected;
		if (ifType === "PROPERTY" && propName) {
			const propType = this._getPropertyType(propName);
			if (propType === "checkbox" || propType === "date" || propType === "datetime") {
				comparableExpected = this._coerceValueForProperty(propName, expected, propType);
			}
		}

		// Para os outros operadores, mantemos a lógica existente
		const normalizedExpected = this._normalizeValue(comparableExpected);
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
		// Only check for H1 heading immediately after YAML frontmatter
		// H1 headings elsewhere in the document are not considered the "title"
		try {
			const content = await this.app.vault.read(file);

			// Check if file has YAML frontmatter
			if (content.startsWith('---\n')) {
				// Find the end of YAML frontmatter
				const yamlEnd = content.indexOf('\n---\n', 4);
				if (yamlEnd !== -1) {
					// Get content after YAML (skip the closing ---)
					const afterYaml = content.substring(yamlEnd + 5);

					// Look for H1 at the start of content after YAML (allowing for whitespace)
					// Match pattern: optional whitespace, then # heading
					const match = afterYaml.match(/^\s*#\s+(.+)$/m);
					if (match) {
						// Verify this H1 is truly at the beginning (no content before it except whitespace)
						const beforeH1 = afterYaml.substring(0, match.index);
						if (beforeH1.trim() === '') {
							return match[1];
						}
					}
				}
			} else {
				// No YAML frontmatter, check if H1 is at the very beginning
				const match = content.match(/^\s*#\s+(.+)$/m);
				if (match) {
					const beforeH1 = content.substring(0, match.index);
					if (beforeH1.trim() === '') {
						return match[1];
					}
				}
			}
		} catch (e) {
			console.error(`Error reading file content for ${file.path}:`, e);
		}

		// No title available - ignore inline title for conditional properties
		// Only consider H1 headings immediately after YAML frontmatter
		return null;
	}

	async _updateNoteTitle(file, newTitle) {
		await this.app.vault.process(file, (content) => {
			// Check if file has YAML frontmatter
			if (content.startsWith('---\n')) {
				const yamlEnd = content.indexOf('\n---\n', 4);
				if (yamlEnd !== -1) {
					const yaml = content.substring(0, yamlEnd + 5);
					const afterYaml = content.substring(yamlEnd + 5);

					// Check if there's an H1 immediately after YAML (allowing whitespace)
					const match = afterYaml.match(/^\s*#\s+(.+)$/m);
					if (match) {
						const beforeH1 = afterYaml.substring(0, match.index);
						// Only replace if H1 is truly at the beginning (no content before it)
						if (beforeH1.trim() === '') {
							// Replace the existing H1 that's immediately after YAML
							const newAfterYaml = afterYaml.replace(/^\s*#\s+.+$/m, `# ${newTitle}`);
							return yaml + newAfterYaml;
						}
					}

					// No H1 immediately after YAML, add one
					const rest = afterYaml.trim();
					return `${yaml}\n# ${newTitle}\n\n${rest}`.trim() + '\n';
				}
			}

			// No YAML frontmatter - check if H1 is at the very beginning
			const match = content.match(/^\s*#\s+(.+)$/m);
			if (match) {
				const beforeH1 = content.substring(0, match.index);
				if (beforeH1.trim() === '') {
					// Replace the H1 at the beginning
					return content.replace(/^\s*#\s+.+$/m, `# ${newTitle}`);
				}
			}

			// No H1 at the beginning, add one at the top
			return `# ${newTitle}\n\n${content}`.trim() + '\n';
		});
	}

	/**
	 * Returns the Obsidian-registered type for a frontmatter property name, or
	 * `undefined` when the property has no explicit type assignment. Used to
	 * decide when to coerce a raw string value into a typed scalar (boolean for
	 * checkbox, normalized string for date / datetime).
	 */
	_getPropertyType(propName) {
		try {
			if (!propName) return undefined;
			const mtm = this.app && this.app.metadataTypeManager;
			if (!mtm) return undefined;
			// Obsidian models property types as "widgets". `getPropertyInfo(name)`
			// returns the effective widget regardless of whether it was assigned
			// explicitly by the user (Settings → Properties) or inferred from the
			// existing values across the vault. `getAssignedWidget` only returns
			// the explicit assignment, so it misses inferred date / datetime /
			// checkbox properties — we prefer `getPropertyInfo` first.
			if (typeof mtm.getPropertyInfo === "function") {
				const info = mtm.getPropertyInfo(propName);
				const widget = info && info.widget;
				if (widget) return widget;
			}
			if (typeof mtm.getAssignedWidget === "function") {
				return mtm.getAssignedWidget(propName) || undefined;
			}
			return undefined;
		} catch (e) {
			console.error("ConditionalProperties: property type lookup error", e);
			return undefined;
		}
	}

	/**
	 * Coerces a raw user-entered string into the right runtime type for the
	 * given property, based on the property's Obsidian-registered type.
	 *   checkbox → boolean (true when trimmed lowercase equals "true", else false)
	 *   date     → string in `YYYY-MM-DD` (ISO, what the Obsidian date widget
	 *              requires). If the input is already ISO, it is used as-is. If
	 *              the Daily Notes core plugin (or Templates as fallback) is
	 *              enabled, the input is parsed using its configured date format
	 *              and converted to ISO. If neither is enabled, or parsing fails,
	 *              the input is written as-typed (lixo entra, lixo sai).
	 *   datetime → trimmed only. The widget needs `YYYY-MM-DDTHH:mm:ss`; we do
	 *              not attempt to convert datetime inputs because Daily Notes /
	 *              Templates formats describe dates, not datetimes.
	 *   anything else / unknown → raw value, untouched.
	 * Pass `propType` when you already looked it up to avoid a second lookup.
	 */
	_coerceValueForProperty(propName, rawValue, propType) {
		const type = propType !== undefined ? propType : this._getPropertyType(propName);
		if (type === "checkbox") {
			return String(rawValue ?? "").trim().toLowerCase() === "true";
		}
		if (type === "date") {
			return this._normalizeDateInput(rawValue);
		}
		if (type === "datetime") {
			return String(rawValue ?? "").trim();
		}
		return rawValue;
	}

	/**
	 * Returns the user-configured date format from the Daily Notes core plugin
	 * if enabled; otherwise from Templates; otherwise `undefined`.
	 */
	/**
	 * Builds an ordered list of date formats to try when parsing a user-typed
	 * date that is not already in ISO. Order matters — the first format that
	 * matches wins.
	 *   1. Daily Notes format (if the core plugin is enabled) — strongest signal
	 *      about how this user writes dates.
	 *   2. Templates format (if the core plugin is enabled) — secondary signal.
	 *   3. Common fallbacks: DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD. MM-DD-YYYY is
	 *      deliberately excluded to keep DD-vs-MM disambiguation predictable for
	 *      non-US users.
	 * Duplicates are removed so the same format is never tried twice.
	 */
	_getDateFormatCandidates() {
		const formats = [];
		try {
			const internal = this.app && this.app.internalPlugins;
			if (internal && internal.plugins) {
				const readFormat = (pluginId, fieldName) => {
					const entry = internal.plugins[pluginId];
					if (!entry || !entry.enabled || !entry.instance) return undefined;
					const value = entry.instance.options && entry.instance.options[fieldName];
					return value || undefined;
				};
				const daily = readFormat("daily-notes", "format");
				if (daily) formats.push(daily);
				const tmpl = readFormat("templates", "dateFormat");
				if (tmpl) formats.push(tmpl);
			}
		} catch (e) {
			console.error("ConditionalProperties: date format lookup error", e);
		}
		// Common civilian formats. MM-DD-YYYY intentionally omitted to avoid
		// silently mis-parsing DD-MM-YYYY input from non-US users.
		formats.push("DD-MM-YYYY", "DD/MM/YYYY", "YYYY/MM/DD");
		// Dedup while preserving order.
		return Array.from(new Set(formats));
	}

	/**
	 * Parses a user-typed date string into ISO (`YYYY-MM-DD`). If the input is
	 * already ISO, returns it as-is. Otherwise, tries each configured / fallback
	 * format in order and returns the first successful strict parse. If nothing
	 * parses cleanly, returns the trimmed input untouched (lixo entra, lixo sai).
	 */
	_normalizeDateInput(rawValue) {
		const trimmed = String(rawValue ?? "").trim();
		if (trimmed === "") return trimmed;
		// Already in ISO — leave it alone.
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
		const candidates = this._getDateFormatCandidates();
		for (const fmt of candidates) {
			try {
				const parsed = moment(trimmed, fmt, true);
				if (parsed && parsed.isValid()) return parsed.format("YYYY-MM-DD");
			} catch (e) {
				console.error("ConditionalProperties: date parse error", e);
			}
		}
		return trimmed;
	}

	async _writeFrontmatter(file, newFrontmatter) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// `undefined` is the sentinel for "delete this property" (used by the
			// `delete` and `rename` actions). `null` is preserved as-is — it means
			// "property exists with an empty value" in YAML, not "delete it".
			Object.keys(newFrontmatter).forEach(key => {
				if (newFrontmatter[key] === undefined) {
					delete fm[key];
				} else {
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

	hide() {
		this._teardownScanSubscriptions();
	}

	_teardownScanSubscriptions() {
		if (this._scanStateUnsubscribers) {
			for (const unsub of this._scanStateUnsubscribers) {
				try { unsub(); } catch (e) { /* noop */ }
			}
			this._scanStateUnsubscribers = [];
		}
	}

	display() {
		try {
			this._teardownScanSubscriptions();
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

			// Run Now Button — with Stop button next to it while scan is running
			let runNowBtnRef = null;
			let stopBtnRef = null;
			const runNowSetting = new Setting(rootEl)
				.setName("Run now")
				.setDesc("Execute all rules across selected scope");

			runNowSetting.addButton(btn => {
				runNowBtnRef = btn;
				btn.setButtonText("Run now");
				btn.buttonEl.classList.add("run-now-button");
				btn.onClick(async () => {
					if (this.plugin.isScanRunning()) return;
					try {
						const result = await this.plugin.runScan();
						if (result.busy) return;
						this.plugin._notifyScanResult(result, "vault");
					} catch (e) {
						console.error("ConditionalProperties: runScan error", e);
						new Notice("Conditional Properties: error during scan — see console");
					}
				});
			});

			runNowSetting.addButton(btn => {
				stopBtnRef = btn;
				btn.setButtonText("Stop");
				btn.setWarning();
				btn.buttonEl.classList.add("conditional-stop");
				btn.onClick(() => {
					this.plugin.requestStopScan();
					new Notice("Conditional Properties: stop requested — finishing current file");
				});
			});

			const syncRunNowState = () => {
				const running = this.plugin.isScanRunning();
				if (runNowBtnRef) {
					runNowBtnRef.setDisabled(running);
					runNowBtnRef.buttonEl.classList.toggle("is-loading", running);
				}
				if (stopBtnRef) {
					stopBtnRef.buttonEl.style.display = running ? "" : "none";
				}
			};
			syncRunNowState();
			const unsubscribeRunNow = this.plugin.onScanStateChange(syncRunNowState);
			this._scanStateUnsubscribers = this._scanStateUnsubscribers || [];
			this._scanStateUnsubscribers.push(unsubscribeRunNow);

			// Rules Section
			new Setting(rootEl)
				.setName("Rules")
				.setHeading();
			this.plugin.settings.rules = this.plugin.settings.rules || [];

			// Add Rule Button
			const addWrap = rootEl.createEl("div", { cls: "setting-item" });
			new ButtonComponent(addWrap)
				.setButtonText("Add rule")
				.setCta()
				.onClick(async () => {
					this.plugin.settings.rules.push({
						match: "any",
						conditions: [{
							ifType: "PROPERTY",
							ifProp: "",
							ifValue: "",
							op: "exactly"
						}],
						thenActions: [{
							prop: "",
							value: "",
							action: "add"
						}]
					});
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});

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
		if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
			rule.conditions = [{
				ifType: rule.ifType || "PROPERTY",
				ifProp: rule.ifProp || "",
				ifValue: rule.ifValue || "",
				op: rule.op || "exactly"
			}];
			delete rule.ifType;
			delete rule.ifProp;
			delete rule.ifValue;
			delete rule.op;
		}
		if (rule.match !== "any" && rule.match !== "all") {
			rule.match = "any";
		}

		const ifHeader = wrap.createEl("div", { cls: "conditional-rules-header conditional-if-header" });
		ifHeader.createEl("strong", { text: "If:" });

		if (rule.conditions.length > 1) {
			const matchWrap = ifHeader.createEl("div", { cls: "conditional-match" });
			matchWrap.createEl("span", { text: "Match", cls: "conditional-match-label" });
			new DropdownComponent(matchWrap)
				.addOption("any", "any of the following")
				.addOption("all", "all of the following")
				.setValue(rule.match)
				.onChange(async (v) => {
					rule.match = v === "all" ? "all" : "any";
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
		}

		rule.conditions.forEach((cond, condIdx) => {
			this._renderCondition(wrap, rule, cond, condIdx);
		});

		const addCondWrap = wrap.createEl("div", { cls: "conditional-add-condition" });
		new ButtonComponent(addCondWrap)
			.setButtonText("+ Add condition")
			.setCta()
			.onClick(async () => {
				rule.conditions.push({
					ifType: "PROPERTY",
					ifProp: "",
					ifValue: "",
					op: "exactly"
				});
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});

		const thenHeader = wrap.createEl("div", { cls: "conditional-rules-header" });
		thenHeader.createEl("strong", { text: "Then:" });

		rule.thenActions.forEach((action, actionIdx) => {
			this._renderThenAction(wrap, rule, action, actionIdx, idx);
		});

		const addActionWrap = wrap.createEl("div", { cls: "conditional-add-action-wrap" });
		new ButtonComponent(addActionWrap)
			.setButtonText("+ Add action")
			.setCta()
			.onClick(async () => {
				rule.thenActions.push({
					type: "property",
					prop: "",
					value: "",
					action: "add"
				});
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});

		const actions = wrap.createEl("div", { cls: "conditional-actions" });
		const runBtn = new ButtonComponent(actions)
			.setButtonText("Run this rule")
			.setClass("conditional-run-one")
			.onClick(async () => {
				if (this.plugin.isScanRunning()) return;
				try {
					const result = await this.plugin.runScanForRules([this.plugin.settings.rules[idx]]);
					if (result.busy) return;
					this.plugin._notifyScanResult(result, "rule");
				} catch (e) {
					console.error("ConditionalProperties: runScanForRules error", e);
					new Notice("Conditional Properties: error during scan — see console");
				}
			});

		const ruleStopBtn = new ButtonComponent(actions)
			.setButtonText("Stop")
			.setWarning()
			.setClass("conditional-stop-rule")
			.onClick(() => {
				this.plugin.requestStopScan();
				new Notice("Conditional Properties: stop requested — finishing current file");
			});

		const syncRuleRunState = () => {
			const running = this.plugin.isScanRunning();
			runBtn.setDisabled(running);
			runBtn.buttonEl.classList.toggle("is-loading", running);
			ruleStopBtn.buttonEl.style.display = running ? "" : "none";
		};
		syncRuleRunState();
		const unsubRule = this.plugin.onScanStateChange(syncRuleRunState);
		this._scanStateUnsubscribers = this._scanStateUnsubscribers || [];
		this._scanStateUnsubscribers.push(unsubRule);

		new ButtonComponent(actions)
			.setButtonText("Remove")
			.setWarning()
			.setClass("conditional-remove")
			.onClick(async () => {
				this.plugin.settings.rules.splice(idx, 1);
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});
	}

	_renderCondition(containerEl, rule, cond, condIdx) {
		if (!cond.ifType) cond.ifType = "PROPERTY";
		if (!cond.op) cond.op = "exactly";

		const isMulti = rule.conditions.length > 1;
		const line = new Setting(containerEl).setName(`Condition ${condIdx + 1}`);
		line.settingEl.addClass("conditional-condition");
		line.settingEl.addClass("conditional-then-action");

		line.addDropdown(d => {
			d.addOption("PROPERTY", "Property");
			d.addOption("FIRST_LEVEL_HEADING", "First level heading");
			d.setValue(cond.ifType);
			d.onChange(async (v) => {
				cond.ifType = v;
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			});
		});

		if (cond.ifType === "FIRST_LEVEL_HEADING") {
			line.addDropdown(d => {
				this._configureOperatorDropdown(d, cond.op, async (value) => {
					cond.op = value;
					if (value === 'exists' || value === 'notExists' || value === 'isEmpty') {
						cond.ifValue = '';
					}
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
			});

			if (cond.op !== 'exists' && cond.op !== 'notExists' && cond.op !== 'isEmpty') {
				line.addText(t => t
					.setPlaceholder("heading text")
					.setValue(cond.ifValue || "")
					.onChange(async (v) => {
						cond.ifValue = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			}
		} else {
			line.addText(t => t
				.setPlaceholder("property")
				.setValue(cond.ifProp || "")
				.onChange(async (v) => {
					cond.ifProp = v;
					await this.plugin.saveData(this.plugin.settings);
				}));

			line.addDropdown(d => {
				this._configureOperatorDropdown(d, cond.op, async (value) => {
					cond.op = value;
					if (value === 'exists' || value === 'notExists' || value === 'isEmpty') {
						cond.ifValue = '';
					}
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
			});

			if (cond.op !== 'exists' && cond.op !== 'notExists' && cond.op !== 'isEmpty') {
				line.addText(t => t
					.setPlaceholder("value")
					.setValue(cond.ifValue || "")
					.onChange(async (v) => {
						cond.ifValue = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			}
		}

		if (isMulti) {
			line.addExtraButton(b => b
				.setIcon("cross")
				.setTooltip("Remove this condition")
				.onClick(async () => {
					rule.conditions.splice(condIdx, 1);
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				}));
		}
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

		// Action type selector (Title or Property)
		actionSetting.addDropdown(d => {
			d.addOption("property", "Property");
			d.addOption("title", "First heading");
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
				d.addOption("rename", "Rename property to");
				d.setValue(action.action || "add");
				d.onChange(async (v) => {
					action.action = v;
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
			});

			if (action.action === "rename") {
				actionSetting.addText(t => t
					.setPlaceholder("new property name")
					.setValue(action.newPropName || "")
					.onChange(async (v) => {
						action.newPropName = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			} else if (action.action !== "delete") {
				actionSetting.addText(t => t
					.setPlaceholder("value (use commas; supports {propertyName}, {date}, {filename})")
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
				.setPlaceholder("Text (use {date}, {date:FORMAT}, {filename}, or {propertyName})")
				.setValue(action.text || "")
				.onChange(async (v) => {
					action.text = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
		}

		actionSetting.addExtraButton(b => b
			.setIcon("cross")
			.setTooltip("Remove this action")
			.onClick(async () => {
				rule.thenActions.splice(actionIdx, 1);
				await this.plugin.saveData(this.plugin.settings);
				this.display();
			}));
	}
}

module.exports = ConditionalPropertiesPlugin;
