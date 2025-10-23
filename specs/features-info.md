# Conditional Properties Plugin - Features Information

## Overview

The Conditional Properties plugin for Obsidian provides automated frontmatter property management through conditional rules. This document outlines the implemented features and their technical specifications.

## Core Features

### 1. Rule-Based Property Automation
- **IF/THEN Logic**: Define conditional rules that trigger property modifications
- **Multiple Conditions**: Support for property-based and title-based conditions
- **Flexible Operators**: `contains` and `notContains` operations with normalization
- **Persistent Storage**: Rules saved in plugin settings (JSON format)

### 2. Property Action Types

#### ADD Action
- **Purpose**: Add values to existing properties without duplication
- **Behavior**: Preserves existing values, only adds new ones
- **Multi-value Support**: Handles comma-separated input
- **Smart Merging**: Converts single values to arrays when needed

#### REMOVE Action
- **Purpose**: Remove specific values from properties
- **Behavior**: Safe removal - only removes matching values
- **Multi-value Support**: Processes comma-separated removal lists
- **Preservation**: Maintains non-matching values

#### REPLACE Action (NEW in v0.12.0)
- **Purpose**: Replace the IF property value with a new value
- **Behavior**: Completely substitutes the IF property value
- **UI Enhancement**: Hides property name field (targets IF property)
- **Dynamic Placeholder**: Shows "new value (will replace the IF property value)"

#### OVERWRITE Action
- **Purpose**: Completely replace property with new value
- **Behavior**: Erases all existing values and sets new ones
- **Multi-value Support**: Accepts comma-separated values
- **Warning**: Destructive operation - removes existing data

#### DELETE Action
- **Purpose**: Remove properties entirely from frontmatter
- **Behavior**: Complete property removal from YAML
- **UI Enhancement**: No value field required
- **Safety**: Irreversible operation

### 3. Condition Types

#### Property-Based Conditions
- **Target**: Frontmatter property values
- **Operators**: `contains`, `notContains`
- **Normalization**: Wiki link syntax handling (`[[link]]` → `link`)
- **Case Handling**: Case-insensitive matching

#### Title-Based Conditions (NEW in v0.12.0)
- **Target**: Note titles (H1 headers or inline titles)
- **Extraction**: First H1 after YAML frontmatter
- **Fallback**: Inline title if enabled in Obsidian settings
- **Error Handling**: Rule skipping for notes without titles

### 4. Scanning System

#### Scan Scopes
- **Entire Vault**: Process all markdown files
- **Latest Created**: Most recently created notes (configurable count)
- **Latest Modified**: Most recently modified notes (configurable count)

#### Execution Modes
- **Manual**: Command palette or settings button
- **Scheduled**: Configurable intervals (minimum 5 minutes)
- **File-Specific**: Run on current file only

#### Performance Controls
- **Configurable Count**: 1-1000 notes for latest scopes
- **Batch Processing**: Efficient processing of large vaults
- **Progress Logging**: Console output for debugging

### 5. YAML Processing Engine

#### Frontmatter Handling
- **Parsing**: Robust YAML parsing with error recovery
- **Generation**: Clean YAML output with proper formatting
- **Multi-line Arrays**: Support for complex property structures
- **Preservation**: Note body content never modified

#### Property Merging
- **Array Handling**: Smart conversion between strings and arrays
- **Duplicate Prevention**: Unique value enforcement
- **Format Preservation**: Maintains original YAML structure when possible

### 6. User Interface

#### Settings Tab
- **Rule Management**: Add, edit, remove rules
- **Configuration**: Scan settings and intervals
- **Execution**: Manual run controls
- **Validation**: Real-time rule testing

#### Rule Builder
- **Intuitive Layout**: Clear IF/THEN structure
- **Dynamic Fields**: Show/hide based on condition type
- **Action Selection**: Dropdown for operation types
- **Multi-Action Support**: Multiple THEN actions per rule

#### Responsive Design
- **Modal Interface**: Obsidian-style settings modal
- **Scroll Management**: Proper handling of long rule lists
- **Button Styling**: Consistent with Obsidian design system

## Technical Implementation

### Architecture Components

1. **ConditionalPropertiesPlugin**: Main plugin class extending Obsidian Plugin
2. **ConditionalPropertiesSettingTab**: Settings interface implementation
3. **Rule Engine**: Core logic for condition evaluation and action execution
4. **YAML Processor**: Frontmatter parsing and generation utilities
5. **Scanner**: Note discovery and filtering system

### Data Structures

#### Rule Object
```javascript
{
  ifType: "PROPERTY" | "FIRST_LEVEL_HEADING",
  ifProp: "property_name", // for PROPERTY type
  ifValue: "expected_value",
  op: "contains" | "notContains",
  thenActions: [
    {
      prop: "target_property", // not used for REPLACE action
      value: "new_value",
      action: "add" | "remove" | "replace" | "overwrite" | "delete"
    }
  ]
}
```

#### Settings Object
```javascript
{
  rules: [...], // Array of rule objects
  scanIntervalMinutes: 5, // Minimum 5
  scanScope: "latestCreated" | "latestModified" | "entireVault",
  scanCount: 15, // 1-1000
  lastRun: "ISO_DATE_STRING"
}
```

## Command Integration

### Available Commands
- **conditional-properties-run-now**: Execute rules on entire vault/scope
- **conditional-properties-run-current-file**: Execute rules on current file only

### Command Palette Integration
- Full Obsidian command palette support
- Descriptive command names and descriptions
- Proper permission handling

## Error Handling & Logging

### Safety Features
- **No Data Loss**: Failed operations don't corrupt files
- **Graceful Degradation**: Malformed YAML handled safely
- **Transaction Safety**: Atomic property updates

### Logging System
- **Console Output**: Detailed execution logging
- **Error Messages**: Clear error descriptions
- **Performance Metrics**: Processing time and success rates
- **Debug Information**: Rule evaluation details

## Performance Characteristics

### Benchmarks (Target)
- **100 Notes**: < 2 seconds processing time
- **500 Notes**: < 10 seconds processing time
- **1000 Notes**: < 30 seconds processing time
- **Memory Usage**: < 50MB additional RAM

### Optimization Features
- **Efficient Scanning**: Smart file filtering
- **Cached Metadata**: Obsidian metadata cache utilization
- **Batch Processing**: Minimal file I/O operations
- **Incremental Updates**: Only modified files written

## Compatibility

### Obsidian Versions
- **Minimum Version**: 1.5.0
- **API Compatibility**: Obsidian Plugin API v1.x
- **Desktop/Mobile**: Cross-platform compatibility

### Vault Compatibility
- **Standard Markdown**: Full support for standard markdown files
- **YAML Frontmatter**: Required for property modifications
- **Multi-vault**: Independent settings per vault

## Future Enhancements

### Planned Features (v0.13.0+)
- **Variable Support**: {{date}}, {{title}} interpolation
- **Property Renaming**: Dynamic property name changes
- **Content Modification**: Note body content updates
- **Advanced Operators**: regex, numeric comparisons
- **Compound Logic**: AND/OR/NOT conditions

---

**Last Updated**: October 2025
**Plugin Version**: 0.12.0
**Status**: Feature Complete