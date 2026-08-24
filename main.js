// This repo ships hand-written CommonJS main.js directly (no bundler, no
// TypeScript source — see CLAUDE.md). eslint-plugin-obsidianmd's rules below
// assume a bundler compiles `import` syntax down to `require()`, which is
// what a real plugin's shipped main.js always looks like at runtime anyway —
// so `no-require-imports` doesn't apply here, and destructuring `Plugin`
// only trips `no-redeclare` because ESLint's browser globals still list the
// legacy `Plugin` DOM interface (navigator.plugins), never actually used by
// this file.
// eslint-disable-next-line @typescript-eslint/no-require-imports, no-redeclare -- hand-written CommonJS main.js by design, see comment above
const { Plugin, Notice, Setting, PluginSettingTab, ButtonComponent, DropdownComponent, moment } = require("obsidian");

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
		// Dedupes the "invalid regular expression" Notice per raw pattern text
		// so a broken /pattern/ in a rule doesn't spam one Notice per file
		// during a full-vault scan — see _compileRegexOrNotify().
		this._notifiedInvalidRegex = new Set();
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
				new Notice("Conditional properties: stop requested — finishing current file");
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
		this._runningRuleRef = null; // vault-wide run, not tied to one rule's button
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
			this._runningRuleRef = null;
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
		// Tracks exactly which rule's "Run this rule" button triggered this
		// run, so only that button's row shows the loading/Stop state — the
		// other rules' conditions/actions are never touched by this call
		// (only `rulesSubset` is passed to applyRulesToFrontmatter below),
		// but every row shares the same `_scanRunning` flag for the "only
		// one scan at a time" lock, so without this they'd all light up too.
		this._runningRuleRef = (Array.isArray(rulesSubset) && rulesSubset.length === 1) ? rulesSubset[0] : null;
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
			this._runningRuleRef = null;
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

	/**
	 * True only when the running scan was triggered by this exact rule's
	 * "Run this rule" button — never true for any other rule, and never
	 * true for a vault-wide "Run now" scan. Used by the settings UI so only
	 * the button actually clicked shows the loading/Stop state; every other
	 * row just shows disabled (see `isScanRunning()`) while a scan is busy.
	 */
	isRuleRunning(rule) {
		return !!this._scanRunning && this._runningRuleRef === rule;
	}

	/** True only when the running scan is the vault-wide "Run now", not a single-rule run. */
	isVaultRunRunning() {
		return !!this._scanRunning && this._runningRuleRef === null;
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
		let fileActionApplied = false;
		let fileDeleted = false;

		for (let ruleIdx = 0; ruleIdx < rules.length; ruleIdx++) {
			if (fileDeleted) break;
			const rule = rules[ruleIdx];
			const { thenActions } = rule || {};
			if (!Array.isArray(thenActions) || thenActions.length === 0) continue;

			const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
			if (conditions.length === 0) continue;

			const matchMode = rule.match === "all" ? "all" : "any";

			// Captures the regex groups from the first regex-mode condition (in
			// declared order) that matched this rule — feeds {{match}} /
			// {{match:N}} / {{match:name}} in this rule's THEN actions. Stays
			// null for rules with no regex-mode condition, or when the winning
			// condition was a plain literal comparison. Beta feature — see
			// README "Using the regex match in THEN (Beta)".
			let capturedMatch = null;

			const evaluateCondition = async (cond) => {
				try {
					const cType = cond.ifType || "PROPERTY";
					const cOp = cond.op || "exactly";
					if (cType === "NOTE_FILE") {
						const isMatch = this._matchesNoteFileCondition(file, cond);
						if (isMatch && !capturedMatch) {
							capturedMatch = this._captureRegexGroups(file.basename || "", cond);
						}
						return isMatch;
					}
					let sourceValue;
					if (cType === "FIRST_LEVEL_HEADING") {
						sourceValue = await this._getNoteTitle(file);
						const allowsNull = cOp === "notExists" || cOp === "isEmpty";
						if (sourceValue === null && !allowsNull) return false;
					} else {
						if (!cond.ifProp) return false;
						// Read from the in-progress `newFm`, not the original
						// `currentFrontmatter` snapshot — so a later rule in the same
						// scan sees property changes an earlier rule already made
						// (mirrors how THEN actions already read from `newFm` via
						// `_formatText`). Rules are evaluated in array order, so this
						// is deterministic: rule N sees the cumulative effect of
						// rules 1..N-1 from this same run, never rules after it.
						sourceValue = newFm?.[cond.ifProp];
					}
					const isMatch = this._matchesCondition(sourceValue, cond.ifValue, cOp, cType, cond.ifProp);
					if (isMatch && !capturedMatch) {
						capturedMatch = this._captureRegexGroups(sourceValue, cond);
					}
					return isMatch;
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

				// Handle note file actions (rename / prefix / suffix / move / delete).
				// Unlike property/title actions, these execute immediately (not
				// batched at the end) so multiple file actions in the same rule
				// compose in sequence — e.g. "Add name prefix" then "Move file to"
				// sees the already-prefixed name.
				if (type === 'file') {
					const applied = await this._applyFileAction(file, actionType, text, newFm, capturedMatch);
					if (applied === 'deleted') {
						fileDeleted = true;
						fileActionApplied = true;
						break; // stop processing remaining actions in this rule
					}
					if (applied) fileActionApplied = true;
					continue;
				}

				// Handle title modification
				if (type === 'title' && text) {
					try {
						const currentTitle = await this._getNoteTitle(file);

						// Format the text with any placeholders
						const formattedText = this._formatText(text, file, newFm, false, capturedMatch);

						if (modificationType === 'overwrite') {
							if (currentTitle !== null && currentTitle === formattedText) {
								continue;
							}
							newTitle = formattedText;
						} else {
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
				const processedValue = this._formatText(value, file, newFm, false, capturedMatch);
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
					const processedValue = this._formatText(value, file, newFm, false, capturedMatch);

					// Handle removing from arrays or properties
					if (Array.isArray(newFm[prop])) {
						const valuesToRemove = processedValue.split(',').map(v => v.trim()).filter(v => v);
						valuesToRemove.forEach(v => {
							const initialLength = newFm[prop].length;
							// Process each item in the array to handle date placeholders
							const processedItem = this._formatText(v, file, newFm, false, capturedMatch);
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
			if (fileDeleted) break;
		}

		// The file no longer exists — nothing left to write to it.
		if (fileDeleted) return true;

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

		return fileActionApplied;
	}

	/**
	 * Executes a single "Note file" THEN action (rename / add prefix / add
	 * suffix / move / delete) immediately against the vault, using the
	 * official Obsidian API — `fileManager.renameFile` (keeps links updated
	 * across the vault) and `fileManager.trashFile` (respects the user's
	 * configured deletion behavior: system trash, `.trash` folder, or
	 * permanent delete). Moving a file outside the vault is not supported —
	 * the plugin API has no access outside the vault sandbox, so "Move file
	 * to" only accepts vault-relative destination folders.
	 *
	 * Returns `'deleted'` when the file was trashed, `true` when a rename/
	 * move actually changed something, or `false` when the action was a
	 * no-op (empty text, or the computed path is unchanged).
	 */
	async _applyFileAction(file, fileActionType, rawText, newFm, matchGroups) {
		if (fileActionType === 'delete') {
			try {
				await this.app.fileManager.trashFile(file);
				return 'deleted';
			} catch (e) {
				console.error(`ConditionalProperties: failed to delete ${file.path}`, e);
				return false;
			}
		}

		// dateOnly: file/folder names can never contain a time component, so a
		// bare {today}/{date}/etc. here always resolves to YYYY-MM-DD, never
		// whatever date format the vault has configured elsewhere.
		const rawFormattedText = this._formatText(rawText || '', file, newFm, true, matchGroups);
		const ext = file.extension ? `.${file.extension}` : '';
		const folder = (file.parent && file.parent.path && file.parent.path !== '/') ? file.parent.path : '';

		if (fileActionType === 'rename' || fileActionType === 'addPrefix' || fileActionType === 'addSuffix') {
			// Rename/prefix/suffix operate on the filename only — never allow
			// them to change which folder the file lives in or escape the
			// vault. Strip path separators and ".." so a formatted value like
			// "../outside/name" or "sub/name" can't smuggle a path through.
			const formattedText = this._sanitizeFilenameComponent(rawFormattedText);
			if (formattedText === '') return false; // empty (or fully stripped) → skip, per spec

			let newBase;
			if (fileActionType === 'rename') {
				newBase = formattedText;
			} else if (fileActionType === 'addPrefix') {
				newBase = formattedText + file.basename;
			} else {
				newBase = file.basename + formattedText;
			}
			const newPath = (folder ? `${folder}/` : '') + newBase + ext;
			return this._renameFileIfChanged(file, newPath);
		}

		if (fileActionType === 'move') {
			// Vault-relative only: strip ".", "..", and empty segments so a
			// value like "../../outside" can't move the file above the vault
			// root or anywhere outside it. Obsidian's plugin API has no
			// access beyond the vault sandbox anyway — this just fails safe
			// instead of resolving to an unintended path.
			const destFolder = this._sanitizeVaultFolderPath(rawFormattedText);
			if (destFolder === '') return false; // no valid destination → skip
			try {
				const exists = await this.app.vault.adapter.exists(destFolder);
				if (!exists) await this.app.vault.createFolder(destFolder);
			} catch (e) {
				// Folder may have been created concurrently by another scan — ignore and try the move anyway.
				console.error(`ConditionalProperties: failed to ensure destination folder "${destFolder}"`, e);
			}
			const newPath = `${destFolder}/${file.name}`;
			return this._renameFileIfChanged(file, newPath);
		}

		return false;
	}

	/**
	 * Sanitizes a filename component (used by rename / add prefix / add
	 * suffix). These change the file's name only, never its folder — so any
	 * path separator or ".." in the user-entered (or placeholder-expanded)
	 * text is stripped rather than honored. This keeps the resulting path
	 * confined to the file's current folder and prevents a formatted value
	 * from smuggling a path (e.g. "../outside/name") into the new filename.
	 * Does NOT strip ":" or other characters that are merely OS-specific —
	 * an explicit value the user typed (including via an explicit
	 * `{today:FORMAT}`) is honored as-is; only the *default*, no-format date
	 * placeholder is forced date-only (see `_formatText`'s `dateOnly` param).
	 * If the result isn't a valid filename on the user's OS, Obsidian's own
	 * rename call surfaces that error — this function only guards against
	 * escaping the current folder.
	 */
	_sanitizeFilenameComponent(text) {
		return String(text ?? "").replace(/[/\\]/g, '').split('..').join('');
	}

	/**
	 * Sanitizes a vault-relative folder path (used by Move file to). Splits
	 * on "/", drops empty / "." / ".." segments, and rejoins — this keeps the
	 * destination confined inside the vault even if the formatted value
	 * contains traversal segments like "../../outside" or a leading "/".
	 * Does not otherwise touch each segment's characters — an explicit value
	 * the user typed is honored as-is (see `_sanitizeFilenameComponent`).
	 */
	_sanitizeVaultFolderPath(text) {
		return String(text ?? "")
			.split('/')
			.map(segment => segment.trim())
			.filter(segment => segment !== '' && segment !== '.' && segment !== '..')
			.join('/');
	}

	async _renameFileIfChanged(file, newPath) {
		if (newPath === file.path) return false;
		try {
			await this.app.fileManager.renameFile(file, newPath);
			return true;
		} catch (e) {
			console.error(`ConditionalProperties: failed to rename "${file.path}" to "${newPath}"`, e);
			return false;
		}
	}

	/**
	 * Formats text by replacing {date} placeholders with the file's creation date
	 * @param {string} text - The text containing placeholders
	 * @param {TFile} file - The file to get creation date from
	 * @param {object} fm - The in-progress frontmatter, for {propertyName} lookups
	 * @param {boolean} [dateOnly] - When true, a date placeholder used WITHOUT
	 *   an explicit `:FORMAT` always resolves to `YYYY-MM-DD`, ignoring the
	 *   vault's configured default date format. Used for Note file actions
	 *   (rename / prefix / suffix / move) — a folder or file name can never
	 *   contain a time component (`:` isn't a valid path character on
	 *   Windows and is reserved on macOS), so these fields can't inherit
	 *   whatever format the user has configured for properties/titles
	 *   elsewhere, even in the unlikely case that format includes time. An
	 *   explicit `{today:FORMAT}` is still honored as-is — this only changes
	 *   the no-format default.
	 * @param {RegExpExecArray|null} [matchGroups] - Capture result from the
	 *   rule's winning regex-mode IF condition (see `_captureRegexGroups`),
	 *   or null when there wasn't one. Powers `{{match}}` / `{{match:N}}` /
	 *   `{{match:name}}` — BETA, double-brace only, no legacy `{match}` form.
	 * @returns {string} The formatted text with placeholders replaced
	 */
	_formatText(text, file, fm, dateOnly, matchGroups) {
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

		// Get file modification date, or current date as fallback
		const getUpdatedMomentDate = () => {
			try {
				return file && file.stat && file.stat.mtime
					? moment(file.stat.mtime)
					: moment();
			} catch (e) {
				console.error("Error getting file modification date:", e);
				return moment();
			}
		};

		// Handle date formatting. `momentDate` defaults to the file's creation
		// date ({date} / {created_date} semantics) — pass a different moment
		// instance for {updated_date} / {today}.
		const formatDate = (format, momentDate = getMomentDate()) => {
			try {
				// Use Obsidian's built-in date format if no specific format provided.
				// KNOWN TECH DEBT: `vault.config` is undocumented/internal (not in
				// obsidian.d.ts) — there is no public API for the user's configured
				// default date format today. Guarded by the surrounding try/catch
				// and the `|| 'YYYY-MM-DD'` fallback, so a breaking change here
				// degrades to the ISO default rather than crashing. Re-check this
				// against obsidian.d.ts when bumping minAppVersion.
				if (!format) {
					if (dateOnly) return momentDate.format('YYYY-MM-DD');
					return momentDate.format(this.app.vault.config.dateFormat || 'YYYY-MM-DD');
				}
				return momentDate.format(format);
			} catch (e) {
				console.error("Error formatting date:", e);
				return "[date-format-error]";
			}
		};

		// Handle time formatting. Always "now" — Obsidian's own {{time}}
		// template placeholder means the current time when inserted, not
		// anything tied to the file.
		const formatTime = (format) => {
			try {
				// KNOWN TECH DEBT: `vault.config` is undocumented/internal (not in
				// obsidian.d.ts) — there is no public API for the user's configured
				// default time format today. Guarded by try/catch and the
				// `|| 'HH:mm'` fallback, so a breaking change degrades to that
				// default rather than crashing. Re-check against obsidian.d.ts
				// when bumping minAppVersion.
				if (!format) {
					if (dateOnly) return moment().format('HH:mm');
					return moment().format(this.app.vault.config.timeFormat || 'HH:mm');
				}
				return moment().format(format);
			} catch (e) {
				console.error("Error formatting time:", e);
				return "[time-format-error]";
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

		// Resolves one reserved placeholder name to its value. Shared between
		// the Obsidian-style {{name}} pass and the legacy {name} pass below —
		// same names resolve the same way in both, EXCEPT `date`: Obsidian's
		// own {{date}} template placeholder means "today", but our original
		// {date} (which shipped before {{}} support existed) means the
		// file's creation date. `isDoubleBrace` is how this one divergence
		// is threaded through without duplicating the whole dispatch table.
		const resolveReserved = (type, format, isDoubleBrace) => {
			if (type === 'filename' || type === 'title') return getFilename();
			if (type === 'time') return formatTime(format);
			if (type === 'updated_date') return formatDate(format, getUpdatedMomentDate());
			if (type === 'today') return formatDate(format, moment());
			if (type === 'date' && isDoubleBrace) return formatDate(format, moment()); // {{date}} = today, matches Obsidian's Templates plugin
			return formatDate(format); // {date} / {created_date} / {{created_date}} = file creation date
		};

		// Four-pass replace, in this order, so nothing is mistaken for the
		// wrong kind of reference and {{...}} is always fully consumed
		// before any single-brace pass runs (otherwise a single-brace pass
		// could match the inner {name} of an unrecognized {{name}} and leave
		// a stray brace behind, or resolve it as the wrong reserved name).
		// Pass 1 — Obsidian Templates-style double braces, reserved names:
		// {{date}}, {{date:FORMAT}}, {{time}}, {{time:FORMAT}}, {{title}},
		// plus this plugin's own reserved names for consistency:
		// {{created_date}}, {{updated_date}}, {{today}}, {{filename}} — all
		// with the same meaning as their {name} counterpart (see
		// `resolveReserved` above for the one exception, {{date}} vs {date}).
		let out = text.replace(/\{\{(date|created_date|updated_date|today|time|title|filename)(?::([^}]+))?\}\}/g,
			(match, type, format) => resolveReserved(type, format, true));

		// Pass 2 — legacy single braces, reserved names: {date}, {date:FORMAT},
		// {filename}, {created_date}, {updated_date}, {today}, {time}, {title}.
		// {date} and {created_date} are aliases for the file's creation date
		// (kept both for backward compatibility — {date} shipped first, before
		// {{}} support existed).
		out = out.replace(/\{(date|created_date|updated_date|today|time|title|filename)(?::([^}]+))?\}/g,
			(match, type, format) => resolveReserved(type, format, false));

		// Pass 2.5 — {{match}} / {{match:N}} / {{match:name}} — BETA. Refers to
		// the capture from this rule's winning regex-mode IF condition (see
		// `_captureRegexGroups`); `matchGroups` is that condition's
		// `RegExp.exec()` result, or null when the rule had no regex-mode
		// condition (or it wasn't the one that decided the match). No
		// argument → the full match (`matchGroups[0]`). A number → that
		// numbered capture group. Anything else → a named group
		// (`(?<name>...)` in the pattern). Missing group/no match → "".
		// Double-brace only — added after the {}/{{}} split, so there's no
		// legacy single-brace form and none is planned. Must run before Pass
		// 3 below, or {{match}} would be swallowed as a property lookup for
		// a property literally named "match".
		out = out.replace(/\{\{match(?::([^}]+))?\}\}/g, (match, ref) => {
			if (!matchGroups) return "";
			if (!ref) return matchGroups[0] ?? "";
			if (/^\d+$/.test(ref)) return matchGroups[Number(ref)] ?? "";
			return (matchGroups.groups && matchGroups.groups[ref]) ?? "";
		});

		// Pass 3 — {{propertyName}}: any other double-brace reference is a
		// frontmatter property lookup, Obsidian Templates-style. Must run
		// after pass 1 (so a reserved name is never treated as a property)
		// but before pass 4, since pass 4's single-brace pattern would
		// otherwise match just the inner "{name}" of an unrecognized
		// "{{name}}" and capture the wrong (brace-prefixed) key.
		out = out.replace(/\{\{([^}:\s][^}:]*)\}\}/g, (match, name) => getProperty(name));

		// Pass 4 — {propertyName}: any other single-brace reference is a
		// frontmatter property lookup. The `[^}:\s]` class excludes ':' (so a
		// stray {date:FORMAT} survivor wouldn't match) and whitespace, while
		// still allowing g_excerpt, kebab-case, dotted, etc.
		out = out.replace(/\{([^}:\s][^}:]*)\}/g, (match, name) => getProperty(name));

		return out;
	}

	_matchesCondition(source, expected, op, ifType, propName) {
		if (op === "exists") {
			return source !== undefined && source !== null;
		}

		if (op === "notExists") {
			return source === undefined || source === null;
		}

		if (op === "isEmpty") {
			// FIRST_LEVEL_HEADING: a missing H1 counts as empty.
			if (ifType === "FIRST_LEVEL_HEADING" && (source === undefined || source === null)) {
				return true;
			}
			// Properties: a missing property does NOT count as empty — use notExists for that.
			if (source === undefined || source === null) {
				return false;
			}
			if (Array.isArray(source)) {
				return source.length === 0;
			}
			const normalizedSource = this._normalizeValue(source);
			return normalizedSource === "";
		}

		// Regex mode: a value wrapped in forward slashes (e.g. `/\d{4}-\d{2}-\d{2}/`
		// — same convention as Obsidian's own Web Clipper URL-trigger patterns)
		// opts "exactly match" / "contains" / "does not contain" into a regular
		// expression test instead of a literal string comparison. Typed-property
		// coercion below only makes sense for literal comparisons, so it's
		// skipped in regex mode.
		const rawExpected = typeof expected === "string" ? expected : String(expected ?? "");
		const isRegex = this._isRegexPattern(rawExpected);
		let regex = null;
		if (isRegex) {
			regex = this._compileRegexOrNotify(rawExpected);
			if (!regex) return false;
		}

		// Typed-property awareness in IF: when the property is registered as
		// checkbox / date / datetime in Obsidian's metadata type manager,
		// coerce the user-entered `expected` value through the same pipeline
		// the THEN side uses. This lets the user type `08-08-2025` against a
		// `date` property that stores `2025-08-08`, or `true` against a
		// `checkbox` property that stores boolean `true`, and have the
		// comparison succeed.
		let comparableExpected = expected;
		if (!isRegex && ifType === "PROPERTY" && propName) {
			const propType = this._getPropertyType(propName);
			if (propType === "checkbox" || propType === "date" || propType === "datetime") {
				comparableExpected = this._coerceValueForProperty(propName, expected, propType);
			}
		}

		// Para os outros operadores, mantemos a lógica existente
		const normalizedExpected = this._normalizeValue(comparableExpected);
		const evaluate = (value) => {
			const normalizedSource = this._normalizeValue(value);
			if (isRegex) {
				const matches = regex.test(normalizedSource);
				return op === "notContains" ? !matches : matches;
			}
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

	/**
	 * True when `value` looks like a regex-mode IF value: `/pattern/`
	 * optionally followed by standard JS regex flags (e.g. `/report/i`,
	 * `/\d{4}-\d{2}-\d{2}/`). Requires at least one character inside the
	 * slashes. Flag validity isn't checked here — an unknown flag (e.g.
	 * `/x/z`) still counts as "regex mode" so it fails at RegExp
	 * construction (`_compileRegexOrNotify`) with a clear error, instead of
	 * silently being treated as a literal string.
	 */
	_isRegexPattern(value) {
		return typeof value === "string" && /^\/(.+)\/([a-z]*)$/.test(value);
	}

	/**
	 * Heuristic-only, UI-hint check for "this value probably meant to be a
	 * regex but forgot the /slashes/" — never used for matching logic, only
	 * to power the inline hint under a condition's value field. Flags
	 * regex-specific escapes/constructs that are very unlikely to appear in
	 * plain frontmatter/title/filename text: `\d`/`\w`/`\s`/`\b` (and their
	 * uppercase negations), non-capturing/lookaround groups, `{n}`/`{n,m}`
	 * quantifiers, and `[a-z]`-style character-class ranges.
	 */
	_looksLikeUnwrappedRegex(value) {
		if (typeof value !== "string" || value === "") return false;
		if (this._isRegexPattern(value)) return false; // already correctly wrapped
		return /\\[dDwWsSbB]|\(\?[:=!<]|\{\d+(,\d*)?\}|\[[^\]]*[-^][^\]]*\]/.test(value);
	}

	/**
	 * Appends a warning div under a condition row's value field, shown only
	 * when `_looksLikeUnwrappedRegex` matches the current text. Lives as a
	 * child of `line.settingEl` (a Setting row rendered `display: block` by
	 * styles.css), so it naturally flows below the field with no extra
	 * layout work — and is torn down along with the rest of the row by
	 * `_rebuildCondition`, since that replaces `settingEl` wholesale.
	 * Returns an `update(value)` function to call from the field's onChange.
	 */
	_addRegexHint(line, initialValue) {
		const hintEl = line.settingEl.createDiv({ cls: "cp-regex-hint is-hidden" });
		hintEl.setText("This looks like a regular expression — wrap it in /slashes/ to use it as one.");
		const update = (value) => hintEl.toggleClass("is-hidden", !this._looksLikeUnwrappedRegex(value));
		update(initialValue);
		return update;
	}

	/**
	 * Compiles a regex-mode IF value (already confirmed via _isRegexPattern)
	 * into a RegExp. A malformed pattern never throws past this point — it's
	 * logged, surfaced once per unique pattern via Notice (deduped so a full
	 * vault scan doesn't spam one Notice per file), and treated as "does not
	 * match" by the caller.
	 */
	_compileRegexOrNotify(rawPattern) {
		const match = /^\/(.+)\/([a-z]*)$/.exec(rawPattern);
		const pattern = match ? match[1] : rawPattern.slice(1, -1);
		const flags = match ? match[2] : "";
		try {
			return new RegExp(pattern, flags);
		} catch (e) {
			console.error(`Conditional properties: invalid regular expression "${rawPattern}"`, e);
			if (!this._notifiedInvalidRegex.has(rawPattern)) {
				this._notifiedInvalidRegex.add(rawPattern);
				new Notice(`Conditional properties: invalid regular expression ${rawPattern} — ${e.message}`, 8000);
			}
			return null;
		}
	}

	/**
	 * BETA — powers {{match}} / {{match:N}} / {{match:name}} in THEN actions
	 * (see `_formatText`). Called only after `cond` is already confirmed to
	 * have matched (by `_matchesCondition` / `_matchesNoteFileCondition`) —
	 * this never decides match/no-match itself, it just recovers the
	 * `RegExp.exec()` result for a condition that was already a winner.
	 * Returns null for a non-regex condition, an array-valued source (not
	 * supported yet — a condition on a list property like `tags` can match
	 * via regex, but there's no single scalar to expose group captures
	 * from), or an already-reported invalid pattern. A fresh RegExp is
	 * compiled per call, so a `g`-flagged pattern's `lastIndex` state never
	 * leaks between files.
	 */
	_captureRegexGroups(sourceValue, cond) {
		if (Array.isArray(sourceValue)) return null;
		const rawExpected = typeof cond?.ifValue === "string" ? cond.ifValue : "";
		if (!this._isRegexPattern(rawExpected)) return null;
		const regex = this._compileRegexOrNotify(rawExpected);
		if (!regex) return null;
		const normalizedSource = this._normalizeValue(sourceValue == null ? "" : sourceValue);
		return regex.exec(normalizedSource);
	}

	/**
	 * Evaluates a "Note file" condition — the file's name or the folders it
	 * lives in, as opposed to a frontmatter property or the H1 title.
	 *   filenameContains / filenameNotContains / filenameExactly — compare
	 *     against `file.basename` (no extension). Case-insensitive.
	 *   parentFolderIs / parentFolderIsNot — the user-entered value can be a
	 *     single folder name ("ClienteA") or a partial path
	 *     ("meetings/transcripts/company"). Matches (or, for IsNot, doesn't
	 *     match) when those segments appear contiguous and in order anywhere
	 *     in the file's folder path — not just as the immediate parent, and
	 *     not necessarily anchored at the vault root. Case-insensitive. An
	 *     empty value makes `parentFolderIs` never match and `parentFolderIsNot`
	 *     always match — same "nothing to compare against" convention as the
	 *     `notContains` operator elsewhere in this file.
	 */
	_matchesNoteFileCondition(file, cond) {
		const op = cond.op || "filenameContains";

		if (op === "parentFolderIs" || op === "parentFolderIsNot") {
			const normalizedExpected = this._normalizeValue(cond.ifValue).toLowerCase();
			const isInFolder = this._fileIsInFolderPath(file, normalizedExpected);
			return op === "parentFolderIs" ? isInFolder : !isInFolder;
		}

		// Regex mode (filename ops only — not parentFolderIs/IsNot above): same
		// `/pattern/` convention as _matchesCondition. Tested against the raw
		// (not lowercased) filename since regex case-sensitivity is the user's
		// own call to make via the pattern.
		const rawExpected = typeof cond.ifValue === "string" ? cond.ifValue : String(cond.ifValue ?? "");
		if (this._isRegexPattern(rawExpected)) {
			const regex = this._compileRegexOrNotify(rawExpected);
			if (!regex) return false;
			const rawFilename = this._normalizeValue(file.basename || "");
			const matches = regex.test(rawFilename);
			return op === "filenameNotContains" ? !matches : matches;
		}

		const normalizedExpected = this._normalizeValue(cond.ifValue).toLowerCase();
		const filename = this._normalizeValue(file.basename || "").toLowerCase();
		switch (op) {
			case "filenameExactly":
				return filename === normalizedExpected;
			case "filenameNotContains":
				if (normalizedExpected === "") return true;
				return !filename.includes(normalizedExpected);
			case "filenameContains":
			default:
				if (normalizedExpected === "") return false;
				return filename.includes(normalizedExpected);
		}
	}

	/**
	 * True when `normalizedExpected` (already lowercased/trimmed, split on
	 * "/") appears as a contiguous, in-order run of segments anywhere in
	 * `file`'s folder path — used by both `parentFolderIs` and its negation
	 * `parentFolderIsNot`.
	 */
	_fileIsInFolderPath(file, normalizedExpected) {
		const targetSegments = normalizedExpected.split("/").map(s => s.trim()).filter(Boolean);
		if (targetSegments.length === 0) return false;
		const folderPath = (file.parent && file.parent.path) ? file.parent.path : "";
		const pathSegments = folderPath.split("/").map(s => s.trim().toLowerCase()).filter(Boolean);
		for (let i = 0; i <= pathSegments.length - targetSegments.length; i++) {
			let allMatch = true;
			for (let j = 0; j < targetSegments.length; j++) {
				if (pathSegments[i + j] !== targetSegments[j]) { allMatch = false; break; }
			}
			if (allMatch) return true;
		}
		return false;
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
	 *
	 * KNOWN TECH DEBT: `app.metadataTypeManager` is undocumented/internal (not
	 * in obsidian.d.ts) — there is no public API for reading a property's
	 * registered type today. Guarded by try/catch and `typeof fn === "function"`
	 * checks below, so a breaking change degrades to "no type info" (values
	 * written as plain strings) rather than crashing. Re-check this against
	 * obsidian.d.ts when bumping minAppVersion.
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
	 *
	 * KNOWN TECH DEBT: `app.internalPlugins` is undocumented/internal (not in
	 * obsidian.d.ts) — there is no public API for reading a core plugin's
	 * settings today. Guarded by try/catch and `entry.enabled`/`entry.instance`
	 * checks below, so a breaking change degrades to the common-fallback
	 * formats rather than crashing. Re-check this against obsidian.d.ts when
	 * bumping minAppVersion.
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
		// Writes into the vault itself via vault.adapter.write instead of
		// triggering a browser "Save As" through a synthetic <a download>
		// click on a Blob URL. That pattern is unreliable in mobile WebViews
		// (iOS in particular may not surface a save dialog at all) — the
		// manifest declares isDesktopOnly: false, so this needs to work on
		// mobile too. Writing to the vault root also means the exported file
		// shows up in Obsidian's file explorer on every platform.
		try {
			const settings = JSON.stringify(this.plugin.settings, null, 2);
			const fileName = `conditional-properties-settings-${new Date().toISOString().split('T')[0]}.json`;
			await this.app.vault.adapter.write(fileName, settings);
			new Notice(`Settings exported to "${fileName}" in your vault's root folder.`, 6000);
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
				try { unsub(); } catch { /* noop */ }
			}
			this._scanStateUnsubscribers = [];
		}
	}

	display() {
		try {
			this._teardownScanSubscriptions();
			const { containerEl } = this;
			containerEl.empty();
			// Build the whole tab off-DOM (detached) and attach it once at the
			// end. With dozens of rules — each rendering several Setting/
			// Dropdown/ExtraButton rows for its conditions and actions — every
			// createEl() call used to insert straight into `containerEl`, which
			// is already live in the document. That forces the browser to
			// recompute layout incrementally on every single insertion instead
			// of once. `createEl`/`createDiv` work identically on a detached
			// element (they're prototype methods, not tied to attachment), so
			// this only changes *when* the tree joins the document, not how
			// it's built.
			const rootEl = document.createElement("div");
			rootEl.id = "eis-cp-plugin";

			// Two top-level groups: general plugin settings, then the rules
			// list — each wrapped in the same setting-group > setting-items
			// shell so both sections read as one consistent unit.
			const configGroupEl = rootEl.createEl("div", { cls: "setting-group" });
			const configItemsEl = configGroupEl.createEl("div", { cls: "setting-items" });

			// Scan Interval Setting
			new Setting(configItemsEl)
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

			let syncNotesToScanVisibility = () => {};

			new Setting(configItemsEl)
				.setName("Scan scope")
				.setDesc("Choose which notes to scan")
				.addDropdown(dropdown => {
					dropdown.addOption("latestCreated", "Latest created notes");
					dropdown.addOption("latestModified", "Latest modified notes");
					dropdown.addOption("entireVault", "Entire vault");
					dropdown.setValue(this.plugin.settings.scanScope || "latestCreated");
					dropdown.onChange(async (value) => {
						this.plugin.settings.scanScope = value;
						await this.plugin.saveData(this.plugin.settings);
						syncNotesToScanVisibility();
					});
				});

			const notesToScanSetting = new Setting(configItemsEl)
				.setName("Notes to scan")
				.setDesc("Number of notes to scan (applies to latest created or latest modified scope, 1-1000)")
				.addText(text => {
					text.setPlaceholder("15")
					.setValue(String(this.plugin.settings.scanCount || 15))
					.onChange(async (value) => {
						const num = Math.max(1, Math.min(1000, Number(value) || 15));
						this.plugin.settings.scanCount = num;
						await this.plugin.saveData(this.plugin.settings);
					});
				});

			syncNotesToScanVisibility = () => {
				const hidden = this.plugin.settings.scanScope === 'entireVault';
				notesToScanSetting.settingEl.toggleClass('is-hidden', hidden);
			};
			syncNotesToScanVisibility();

			// Add Export/Import Buttons
			const exportImportSetting = new Setting(configItemsEl)
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
			importInput.addClass('is-hidden');
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

			configItemsEl.appendChild(importInput);

			// Run Now Button — with Stop button next to it while scan is running
			let runNowBtnRef = null;
			let stopBtnRef = null;
			const runNowSetting = new Setting(configItemsEl)
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
						new Notice("Conditional properties: error during scan — see console");
					}
				});
			});

			runNowSetting.addButton(btn => {
				stopBtnRef = btn;
				btn.setButtonText("Stop");
				btn.setWarning();
				btn.buttonEl.classList.add("cp-stop");
				btn.onClick(() => {
					this.plugin.requestStopScan();
					new Notice("Conditional properties: stop requested — finishing current file");
				});
			});

			const syncRunNowState = () => {
				// `anyRunning` disables the button whenever ANY scan is busy (only
				// one can run at a time) — but the spinner and Stop button only
				// show when THIS "Run now" is the one actually running, not when
				// some rule's "Run this rule" is running instead.
				const anyRunning = this.plugin.isScanRunning();
				const thisIsRunning = this.plugin.isVaultRunRunning();
				if (runNowBtnRef) {
					runNowBtnRef.setDisabled(anyRunning);
					runNowBtnRef.buttonEl.classList.toggle("is-loading", thisIsRunning);
				}
				if (stopBtnRef) {
					stopBtnRef.buttonEl.style.display = thisIsRunning ? "" : "none";
				}
			};
			syncRunNowState();
			const unsubscribeRunNow = this.plugin.onScanStateChange(syncRunNowState);
			this._scanStateUnsubscribers = this._scanStateUnsubscribers || [];
			this._scanStateUnsubscribers.push(unsubscribeRunNow);

			// Rules Section — its own setting-group, separate from the
			// general config group above. The title + "Add rule" button
			// live in their own .setting-item.setting-item-heading, a direct
			// child of .setting-group (a sibling of .setting-items, not
			// nested inside it) — same shape Obsidian's own settings use for
			// a group heading with an action attached.
			const rulesGroupEl = rootEl.createEl("div", { cls: "setting-group cp-rules-group" });

			this.plugin.settings.rules = this.plugin.settings.rules || [];

			// rulesItemsEl is declared here (before the heading Setting below)
			// only so the "Add rule" button's onClick closure can reference
			// it — the element itself is created further down, in the actual
			// desired DOM order. The closure won't run until well after this
			// whole function finishes setting up, so the binding is populated
			// by the time anyone clicks the button.
			let rulesItemsEl;

			new Setting(rulesGroupEl)
				.setName("Rules")
				.setDesc("Define your rules using IF conditions and THEN for actions.")
				.setHeading()
				.addButton(btn => btn
					.setButtonText("Add rule")
					.setCta()
					.onClick(async () => {
						const newRule = {
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
						};
						this.plugin.settings.rules.push(newRule);
						await this.plugin.saveData(this.plugin.settings);

						// New rules go to the top of the list, right under the
						// heading — capture the current first card before
						// rendering (which appends the new one at the end),
						// then move it back to the front.
						const previousFirst = rulesItemsEl.firstChild;
						const newRuleEl = this._renderRule(rulesItemsEl, newRule, this.plugin.settings.rules.length - 1);
						if (newRuleEl && previousFirst) {
							rulesItemsEl.insertBefore(newRuleEl, previousFirst);
						}
					}));

			rulesItemsEl = rulesGroupEl.createEl("div", { cls: "setting-items" });

			// Render Rules
			this.plugin.settings.rules.slice().reverse().forEach((rule, idxReversed) => {
				const originalIndex = this.plugin.settings.rules.length - 1 - idxReversed;
				this._renderRule(rulesItemsEl, rule, originalIndex);
			});

			// Attach the fully-built tree in one shot — see the comment above
			// `rootEl`'s creation for why this is deferred to here.
			containerEl.appendChild(rootEl);

		} catch (error) {
			console.error("Error in display():", error);
			new Notice("An error occurred while loading the settings. Check the console for details.", 5000);
		}
	}

	_renderRule(containerEl, rule, idx) {
		const wrap = containerEl.createEl("div", { cls: "cp-rule" });
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

		// IF block: header (with the any/all match dropdown once there's
		// more than one condition) + the condition lines themselves + the
		// "+ add condition" row.
		const ifBlockEl = wrap.createEl("div", { cls: "cp-if-block" });
		const ifHeader = ifBlockEl.createEl("div", { cls: "cp-rule-header" });
		ifHeader.createEl("strong", { text: "If:" });
		const ifRuleBlockEl = ifBlockEl.createEl("div", { cls: "cp-rule-block" });

		const conditionSettings = [];
		const ruleCtx = {
			wrap,
			ifHeader,
			rule,
			conditionSettings,
			matchWrapEl: null,
			removeBtnByCondition: new WeakMap(),
		};

		if (rule.conditions.length > 1) {
			this._ensureMatchDropdown(ruleCtx);
		}

		rule.conditions.forEach((cond, condIdx) => {
			conditionSettings.push(this._renderCondition(ifRuleBlockEl, ruleCtx, cond, condIdx));
		});

		const addCondWrap = ifBlockEl.createEl("div", { cls: "cp-rule-add" });
		new ButtonComponent(addCondWrap)
			.setButtonText("+ add condition")
			.setCta()
			.onClick(async () => {
				const newCond = {
					ifType: "PROPERTY",
					ifProp: "",
					ifValue: "",
					op: "exactly"
				};
				rule.conditions.push(newCond);
				await this.plugin.saveData(this.plugin.settings);

				const wasSingle = rule.conditions.length === 2;
				const newCondIdx = rule.conditions.length - 1;
				// ifRuleBlockEl only ever holds condition lines (the header and
				// the add-row are its siblings, not interleaved with them
				// anymore), so a freshly-rendered line — appended by Setting's
				// own constructor — already lands in the right place with no
				// reordering needed.
				const newLine = this._renderCondition(ifRuleBlockEl, ruleCtx, newCond, newCondIdx);
				conditionSettings.push(newLine);

				if (wasSingle) {
					this._ensureMatchDropdown(ruleCtx);
					const firstLine = conditionSettings[0];
					if (firstLine && !ruleCtx.removeBtnByCondition.has(firstLine)) {
						this._addConditionRemoveButton(firstLine, ruleCtx, rule.conditions[0]);
					}
				}
			});

		// THEN block — same shape as the IF block above, minus the match
		// dropdown (a rule only ever has one THEN, never "any/all" of them).
		const thenBlockEl = wrap.createEl("div", { cls: "cp-then-block" });
		const thenHeader = thenBlockEl.createEl("div", { cls: "cp-rule-header" });
		thenHeader.createEl("strong", { text: "Then:" });
		const thenRuleBlockEl = thenBlockEl.createEl("div", { cls: "cp-rule-block" });

		const actionEntries = [];
		ruleCtx.actionEntries = actionEntries;

		rule.thenActions.forEach((action, actionIdx) => {
			actionEntries.push(this._renderThenAction(thenRuleBlockEl, ruleCtx, action, actionIdx));
		});

		const addActionWrap = thenBlockEl.createEl("div", { cls: "cp-rule-add" });
		new ButtonComponent(addActionWrap)
			.setButtonText("+ add action")
			.setCta()
			.onClick(async () => {
				const newAction = {
					type: "property",
					prop: "",
					value: "",
					action: "add"
				};
				rule.thenActions.push(newAction);
				await this.plugin.saveData(this.plugin.settings);

				const newActionIdx = rule.thenActions.length - 1;
				const newEntry = this._renderThenAction(thenRuleBlockEl, ruleCtx, newAction, newActionIdx);
				actionEntries.push(newEntry);
			});

		const actions = wrap.createEl("div", { cls: "cp-rule-actions" });
		const runBtn = new ButtonComponent(actions)
			.setButtonText("Run this rule")
			.setClass("cp-rule-run")
			.onClick(async () => {
				if (this.plugin.isScanRunning()) return;
				try {
					const currentIdx = this.plugin.settings.rules.indexOf(rule);
					if (currentIdx === -1) return;
					const result = await this.plugin.runScanForRules([this.plugin.settings.rules[currentIdx]]);
					if (result.busy) return;
					this.plugin._notifyScanResult(result, "rule");
				} catch (e) {
					console.error("ConditionalProperties: runScanForRules error", e);
					new Notice("Conditional properties: error during scan — see console");
				}
			});

		const ruleStopBtn = new ButtonComponent(actions)
			.setButtonText("Stop")
			.setWarning()
			.setClass("cp-rule-stop")
			.onClick(() => {
				this.plugin.requestStopScan();
				new Notice("Conditional properties: stop requested — finishing current file");
			});

		const syncRuleRunState = () => {
			// `anyRunning` disables this row's button whenever ANY scan is busy
			// (only one can run at a time) — but the spinner and Stop button
			// only show when THIS rule is the one actually running. Without
			// this distinction every rule's row would light up together
			// whenever any single rule (or "Run now") was running, even though
			// only that one rule's conditions/actions are actually evaluated.
			const anyRunning = this.plugin.isScanRunning();
			const thisIsRunning = this.plugin.isRuleRunning(rule);
			runBtn.setDisabled(anyRunning);
			runBtn.buttonEl.classList.toggle("is-loading", thisIsRunning);
			ruleStopBtn.buttonEl.style.display = thisIsRunning ? "" : "none";
		};
		syncRuleRunState();
		const unsubRule = this.plugin.onScanStateChange(syncRuleRunState);
		this._scanStateUnsubscribers = this._scanStateUnsubscribers || [];
		this._scanStateUnsubscribers.push(unsubRule);

		new ButtonComponent(actions)
			.setButtonText("Remove")
			.setWarning()
			.setClass("cp-rule-remove")
			.onClick(async () => {
				const currentIdx = this.plugin.settings.rules.indexOf(rule);
				if (currentIdx === -1) return;
				this.plugin.settings.rules.splice(currentIdx, 1);
				await this.plugin.saveData(this.plugin.settings);

				const subs = this._scanStateUnsubscribers || [];
				const subIdx = subs.indexOf(unsubRule);
				if (subIdx !== -1) {
					try { unsubRule(); } catch (e) { console.error("ConditionalProperties: unsubscribe error", e); }
					subs.splice(subIdx, 1);
				}

				wrap.remove();
			});

		return wrap;
	}

	_renderCondition(containerEl, ruleCtx, cond, condIdx) {
		const rule = ruleCtx.rule;
		if (!cond.ifType) cond.ifType = "PROPERTY";
		if (!cond.op) cond.op = "exactly";

		const line = new Setting(containerEl);
		line.settingEl.addClass("cp-rule-line");
		line.settingEl.removeClass("setting-item");
		this._setRuleLineLabel(line, `Condition ${condIdx + 1}`);

		const rebuild = async () => {
			await this.plugin.saveData(this.plugin.settings);
			this._rebuildCondition(ruleCtx, cond);
		};

		line.addDropdown(d => {
			d.addOption("PROPERTY", "Property");
			d.addOption("FIRST_LEVEL_HEADING", "First level title");
			d.addOption("NOTE_FILE", "Note file");
			d.setValue(cond.ifType);
			d.onChange(async (v) => {
				cond.ifType = v;
				await rebuild();
			});
		});

		if (cond.ifType === "NOTE_FILE") {
			const NOTE_FILE_OPS = ["filenameContains", "filenameNotContains", "filenameExactly", "parentFolderIs", "parentFolderIsNot"];
			if (!NOTE_FILE_OPS.includes(cond.op)) cond.op = "filenameContains";
			const isFolderOp = cond.op === "parentFolderIs" || cond.op === "parentFolderIsNot";

			line.addDropdown(d => {
				d.addOption("filenameContains", "Filename contains");
				d.addOption("filenameNotContains", "Filename not contains");
				d.addOption("filenameExactly", "Filename exactly match");
				d.addOption("parentFolderIs", "Parent folder is");
				d.addOption("parentFolderIsNot", "Parent folder is not");
				d.setValue(cond.op);
				d.onChange(async (value) => {
					cond.op = value;
					await rebuild();
				});
			});

			let updateNoteFileRegexHint = null;
			line.addText(t => t
				.setPlaceholder(isFolderOp ? "folder name or path, e.g. meetings/transcripts/company" : "text, or /regex/")
				.setValue(cond.ifValue || "")
				.onChange(async (v) => {
					cond.ifValue = v;
					if (updateNoteFileRegexHint) updateNoteFileRegexHint(v);
					await this.plugin.saveData(this.plugin.settings);
				}));
			if (!isFolderOp) {
				updateNoteFileRegexHint = this.plugin._addRegexHint(line, cond.ifValue || "");
			}
		} else if (cond.ifType === "FIRST_LEVEL_HEADING") {
			line.addDropdown(d => {
				this._configureOperatorDropdown(d, cond.op, async (value) => {
					cond.op = value;
					if (value === 'exists' || value === 'notExists' || value === 'isEmpty') {
						cond.ifValue = '';
					}
					await rebuild();
				});
			});

			if (cond.op !== 'exists' && cond.op !== 'notExists' && cond.op !== 'isEmpty') {
				let updateHeadingRegexHint;
				line.addText(t => t
					.setPlaceholder("First level title text, or /regex/")
					.setValue(cond.ifValue || "")
					.onChange(async (v) => {
						cond.ifValue = v;
						updateHeadingRegexHint(v);
						await this.plugin.saveData(this.plugin.settings);
					}));
				updateHeadingRegexHint = this.plugin._addRegexHint(line, cond.ifValue || "");
			}
		} else {
			line.addText(t => t
				.setPlaceholder("Property")
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
					await rebuild();
				});
			});

			if (cond.op !== 'exists' && cond.op !== 'notExists' && cond.op !== 'isEmpty') {
				let updateValueRegexHint;
				line.addText(t => t
					.setPlaceholder("Value, or /regex/")
					.setValue(cond.ifValue || "")
					.onChange(async (v) => {
						cond.ifValue = v;
						updateValueRegexHint(v);
						await this.plugin.saveData(this.plugin.settings);
					}));
				updateValueRegexHint = this.plugin._addRegexHint(line, cond.ifValue || "");
			}
		}

		if (rule.conditions.length > 1) {
			this._addConditionRemoveButton(line, ruleCtx, cond);
		}

		return line;
	}

	_rebuildAction(ruleCtx, action) {
		const { actionEntries, rule } = ruleCtx;
		const actionIdx = rule.thenActions.indexOf(action);
		if (actionIdx === -1) return;
		const oldEntry = actionEntries[actionIdx];
		if (!oldEntry) return;

		const oldEl = oldEntry.el;
		const parent = oldEl.parentElement;
		const nextSibling = oldEl.nextSibling;
		oldEl.remove();

		const newEntry = this._renderThenAction(parent, ruleCtx, action, actionIdx);
		if (nextSibling) {
			parent.insertBefore(newEntry.el, nextSibling);
		}
		actionEntries[actionIdx] = newEntry;
	}

	_rebuildCondition(ruleCtx, cond) {
		const { conditionSettings, rule, removeBtnByCondition } = ruleCtx;
		const condIdx = rule.conditions.indexOf(cond);
		if (condIdx === -1) return;
		const oldLine = conditionSettings[condIdx];
		if (!oldLine) return;

		const oldEl = oldLine.settingEl;
		const parent = oldEl.parentElement;
		const nextSibling = oldEl.nextSibling;
		removeBtnByCondition.delete(oldLine);
		oldEl.remove();

		const newLine = this._renderCondition(parent, ruleCtx, cond, condIdx);
		if (nextSibling) {
			parent.insertBefore(newLine.settingEl, nextSibling);
		}
		conditionSettings[condIdx] = newLine;
	}

	_ensureMatchDropdown(ruleCtx) {
		if (ruleCtx.matchWrapEl) return;
		const { ifHeader, rule } = ruleCtx;
		const matchWrap = ifHeader.createEl("div", { cls: "cp-match" });
		matchWrap.createEl("span", { text: "Match", cls: "cp-match-label" });
		new DropdownComponent(matchWrap)
			.addOption("any", "Any of the following")
			.addOption("all", "All of the following")
			.setValue(rule.match || "any")
			.onChange(async (v) => {
				rule.match = v === "all" ? "all" : "any";
				await this.plugin.saveData(this.plugin.settings);
			});
		ruleCtx.matchWrapEl = matchWrap;
	}

	_addConditionRemoveButton(settingLine, ruleCtx, cond) {
		let btnEl = null;
		settingLine.addExtraButton(b => {
			// ExtraButtonComponent has no setWarning() (that's ButtonComponent-only
			// — see obsidian.d.ts). Obsidian's own core UI hits the same gap and
			// works around it by adding "mod-warning" straight to extraSettingsEl
			// (confirmed in app.js/app.css) — .clickable-icon.mod-warning just
			// tints the icon with var(--text-error); hover stays the normal
			// neutral clickable-icon hover. Doing the same here instead of
			// hand-rolling our own color rule in styles.css.
			b.extraSettingsEl.addClass("mod-warning");
			b.setIcon("cross")
				.setTooltip("Remove this condition")
				.onClick(async () => {
					const { rule, conditionSettings, removeBtnByCondition } = ruleCtx;
					const currentIdx = rule.conditions.indexOf(cond);
					if (currentIdx === -1) return;

					rule.conditions.splice(currentIdx, 1);
					const [removedLine] = conditionSettings.splice(currentIdx, 1);
					if (removedLine) {
						removeBtnByCondition.delete(removedLine);
						removedLine.settingEl.remove();
					}

					await this.plugin.saveData(this.plugin.settings);

					conditionSettings.forEach((line, i) => {
						this._setRuleLineLabel(line, `Condition ${i + 1}`);
					});

					if (rule.conditions.length === 1) {
						if (ruleCtx.matchWrapEl) {
							ruleCtx.matchWrapEl.remove();
							ruleCtx.matchWrapEl = null;
						}
						const lastLine = conditionSettings[0];
						if (lastLine) {
							const lastBtn = removeBtnByCondition.get(lastLine);
							if (lastBtn) lastBtn.remove();
							removeBtnByCondition.delete(lastLine);
						}
					}
				});
			btnEl = b.extraSettingsEl;
		});
		ruleCtx.removeBtnByCondition.set(settingLine, btnEl);
	}

	/**
	 * Obsidian's Setting always builds a .setting-item-info wrapper holding
	 * .setting-item-name + .setting-item-description. Our condition/action
	 * rows only need a compact label, never a description, so this swaps
	 * that whole wrapper out for a single <h6 class="cp-rule-label">, and
	 * stashes it on the Setting instance (`setting.labelEl`) so later
	 * renumbering (after a row is added/removed) can update the text
	 * directly instead of calling Setting.setName() — which would just
	 * write into the now-detached info wrapper we removed. Safe to call
	 * repeatedly: the swap only happens once per Setting.
	 */
	_setRuleLineLabel(setting, text) {
		if (!setting.labelEl) {
			const infoEl = setting.settingEl.querySelector(".setting-item-info");
			const labelEl = document.createElement("h6");
			labelEl.className = "cp-rule-label";
			setting.settingEl.insertBefore(labelEl, infoEl);
			if (infoEl) infoEl.remove();
			setting.labelEl = labelEl;
		}
		setting.labelEl.textContent = text;
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

	_renderThenAction(containerEl, ruleCtx, action, actionIdx) {
		const rule = ruleCtx.rule;
		const actionWrap = containerEl.createEl("div", { cls: "cp-rule-line" });
		const actionSetting = new Setting(actionWrap);
		this._setRuleLineLabel(actionSetting, `Action ${actionIdx + 1}`);
		
		// Initialize action type if not set
		if (!action.type) {
			action.type = "property";
		}
		if (!action.action && action.type === "property") {
			action.action = "add";
		}

		const rebuildAction = async () => {
			await this.plugin.saveData(this.plugin.settings);
			this._rebuildAction(ruleCtx, action);
		};

		actionSetting.addDropdown(d => {
			d.addOption("property", "Property");
			d.addOption("title", "First level title");
			d.addOption("file", "Note file");
			d.setValue(action.type || "property");
			d.onChange(async (v) => {
				action.type = v;
				if (v === "title") {
					action.action = "modify";
				} else if (v === "file") {
					action.action = "rename";
				}
				await rebuildAction();
			});
		});

		if (action.type === "property") {
			actionSetting.addText(t => t
				.setPlaceholder("Property name")
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
					await rebuildAction();
				});
			});

			if (action.action === "rename") {
				actionSetting.addText(t => t
					.setPlaceholder("New property name")
					.setValue(action.newPropName || "")
					.onChange(async (v) => {
						action.newPropName = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			} else if (action.action !== "delete") {
				actionSetting.addText(t => t
					.setPlaceholder("value (use commas; supports {{propertyName}}, {{date}}, {{time}}, {{title}}, {{created_date}}, {{updated_date}}, {{today}}, {{filename}})")
					.setValue(action.value || "")
					.onChange(async (v) => {
						action.value = v;
						await this.plugin.saveData(this.plugin.settings);
					}));
			}
		} else if (action.type === "file") {
			const FILE_ACTIONS = ["rename", "addPrefix", "addSuffix", "move", "delete"];
			if (!FILE_ACTIONS.includes(action.action)) action.action = "rename";

			actionSetting.addDropdown(d => {
				d.addOption("rename", "Rename file");
				d.addOption("addPrefix", "Add name prefix");
				d.addOption("addSuffix", "Add name suffix");
				d.addOption("move", "Move file to");
				d.addOption("delete", "Delete file");
				d.setValue(action.action);
				d.onChange(async (v) => {
					action.action = v;
					await rebuildAction();
				});
			});

			if (action.action !== "delete") {
				const FILE_ACTION_PLACEHOLDERS = {
					rename: "new file name, without extension (supports {{date}}, {{time}}, {{title}}, {{filename}}, {{propertyName}}...)",
					addPrefix: "prefix text (supports placeholders)",
					addSuffix: "suffix text (supports placeholders)",
					move: "destination folder inside the vault, created if missing — e.g. Archive/{{date}}",
				};
				actionSetting.addText(t => t
					.setPlaceholder(FILE_ACTION_PLACEHOLDERS[action.action] || "value")
					.setValue(action.text || "")
					.onChange(async (v) => {
						action.text = v;
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
				.setPlaceholder("Text (use {{date}}, {{time}}, {{title}}, {{created_date}}, {{updated_date}}, {{today}}, {{filename}}, or {{propertyName}})")
				.setValue(action.text || "")
				.onChange(async (v) => {
					action.text = v;
					await this.plugin.saveData(this.plugin.settings);
				}));
		}

		const entry = { el: actionWrap, setting: actionSetting };

		actionSetting.addExtraButton(b => {
			// See the matching comment in _addConditionRemoveButton() — same
			// "mod-warning on extraSettingsEl" workaround Obsidian's own core
			// UI uses, since ExtraButtonComponent has no setWarning().
			b.extraSettingsEl.addClass("mod-warning");
			return b
				.setIcon("cross")
				.setTooltip("Remove this action")
				.onClick(async () => {
					const currentIdx = rule.thenActions.indexOf(action);
					if (currentIdx === -1) return;

					rule.thenActions.splice(currentIdx, 1);
					const entries = ruleCtx.actionEntries || [];
					const entryIdx = entries.indexOf(entry);
					if (entryIdx !== -1) entries.splice(entryIdx, 1);
					actionWrap.remove();

					await this.plugin.saveData(this.plugin.settings);

					entries.forEach((e, i) => {
						this._setRuleLineLabel(e.setting, `Action ${i + 1}`);
					});
				});
		});

		// Setting always builds its own nested .setting-item div inside the
		// container it's given. We want .cp-rule-line to be that row
		// directly instead — same flat shape _renderCondition uses (a single
		// element carrying the row's class, no .setting-item nested inside
		// it) — so move the Setting's own children up into actionWrap and
		// drop the now-empty intermediate node. This has to happen after
		// every addDropdown/addText/addExtraButton call above, since those
		// all append into elements living inside that nested settingEl.
		const nestedSettingEl = actionSetting.settingEl;
		while (nestedSettingEl.firstChild) {
			actionWrap.appendChild(nestedSettingEl.firstChild);
		}
		nestedSettingEl.remove();

		return entry;
	}
}

module.exports = ConditionalPropertiesPlugin;
