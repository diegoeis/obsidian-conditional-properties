# Conditional Properties Plugin - Product Requirements Document (PRD)

## Executive Summary

**Product**: Conditional Properties Plugin for Obsidian
**Version**: 0.14.1
**Author**: Diego Eis
**Last Updated**: December 2025
**Status**: Production-ready with active development

The Conditional Properties plugin enables Obsidian users to automate frontmatter property updates using conditional rules. Users can define IF/THEN rules to automatically modify note properties based on specific conditions, eliminating manual property management and ensuring consistency across their knowledge base. The plugin now includes advanced operators (exists/notExists), date placeholders support, title modification capabilities, and robust settings import/export functionality.

## Problem Statement

Obsidian users often need to maintain consistent metadata across their notes, but manual property management is time-consuming and error-prone. Current solutions require users to manually update properties or rely on basic automation that lacks flexibility. This leads to:

- Inconsistent property values across similar notes
- Time-consuming manual updates
- Difficulty in maintaining standardized metadata schemas
- Limited ability to create dynamic property relationships

**Target Users**:
- Knowledge workers managing large note collections
- Teams collaborating on shared vaults
- Content creators organizing extensive documentation
- Researchers maintaining structured databases
- Anyone needing automated metadata management in Obsidian

## Solution Overview

The Conditional Properties plugin provides a rule-based system for automatically updating frontmatter properties. Users can create conditional rules that trigger property modifications based on specific criteria, supporting complex workflows and ensuring data consistency.

### Core Features

1. **Rule-Based Automation**: IF/THEN conditional logic for property updates
2. **Multiple Action Types**: ADD, REMOVE, REPLACE, OVERWRITE, DELETE PROPERTY, and TITLE modification operations
3. **Advanced Operators**: Exactly, contains, notContains, exists, and notExists operators
4. **Flexible Conditions**: Support for property values and note titles (H1 or inline)
5. **Title Modification**: Add prefix/suffix to note titles with date placeholder support
6. **Date Placeholders**: Support for `{date}` and `{date:FORMAT}` in property values and titles
7. **Batch Processing**: Scan entire vaults or specific note subsets (latest created/modified)
8. **Scheduled Execution**: Automated runs with configurable intervals (minimum 5 minutes)
9. **Smart Merging**: Intelligent handling of multi-value properties with duplicate prevention
10. **Settings Management**: Export and import rules and configuration as JSON

## Requirements

### Functional Requirements

#### FR-1: Rule Definition System
- Users can create conditional rules using IF/THEN logic
- Support for property-based and title-based conditions
- Multiple THEN actions per rule
- Persistent rule storage in plugin settings

#### FR-2: Condition Evaluation
- Support for multiple operators:
  - **exactly**: Exact value matching (case-insensitive)
  - **contains**: Substring matching
  - **notContains**: Negative substring matching
  - **exists**: Check if property exists (value field not required)
  - **notExists**: Check if property doesn't exist (value field not required)
- Case-insensitive string matching with normalization
- Wiki link syntax handling ([[link]] normalization)
- Title extraction from H1 headers or inline titles with fallback support

#### FR-3: Property Actions
- **ADD**: Add values to existing properties without duplication
- **REMOVE**: Remove specific values from properties
- **REPLACE**: Replace IF property value with new value (planned)
- **OVERWRITE**: Completely replace property with new value
- **DELETE PROPERTY**: Remove properties entirely from frontmatter

#### FR-3.1: Title Actions (NEW in v0.13.0)
- **PREFIX**: Add text before note title
- **SUFFIX**: Add text after note title
- **Date Placeholder Support**: Use `{date}` or `{date:FORMAT}` in prefix/suffix text
- **Duplicate Prevention**: Intelligent detection to avoid repeated prefix/suffix application
- Support for both H1 headings and inline title modifications

#### FR-4: Execution Engine
- Process rules against frontmatter properties only
- Preserve note body content during modifications
- Handle YAML parsing and generation
- Support for both single-value and multi-value properties

#### FR-5: Scanning System
- Entire vault scanning capability
- Latest created/modified notes filtering
- Configurable scan scope and count
- Manual and scheduled execution modes

#### FR-6: User Interface
- Settings tab for rule management
- Intuitive rule builder interface
- Real-time rule testing
- Clear action type selection
- Dynamic UI based on operator selection (hide value field for exists/notExists)
- Visual feedback for rule execution results
- Export/Import settings functionality (v0.12.1)

#### FR-7: Date Formatting (NEW in v0.13.0)
- Support for `{date}` placeholder using Obsidian's configured date format
- Support for `{date:FORMAT}` with custom moment.js format strings
- Examples: `{date:DD/MM/YYYY}`, `{date:YYYY-MM-DD HH:mm}`, `{date:MMM Do, YYYY}`
- Fallback to YYYY-MM-DD if no format configured
- Date extraction from file creation time (ctime)

### Non-Functional Requirements

#### NFR-1: Performance
- Process up to 1000 notes efficiently
- Minimum 5-minute scan intervals
- Responsive UI during rule editing
- Fast YAML parsing and generation

#### NFR-2: Reliability
- Safe property modifications (no data loss)
- Graceful error handling for malformed YAML
- Rollback capability for failed operations
- Comprehensive logging for debugging

#### NFR-3: Usability
- Intuitive rule creation interface
- Clear documentation and examples
- Helpful placeholder text and validation
- Responsive design for various screen sizes

#### NFR-4: Security & Privacy
- All processing occurs locally
- No external API calls or data transmission
- Secure YAML parsing to prevent injection
- Safe file modification practices

## User Stories

### Primary User Flow
**As a** knowledge worker organizing meeting notes,
**I want** to automatically tag notes based on content,
**So that** I can quickly find and filter relevant information.

**Acceptance Criteria**:
- Create rule: IF title contains "Meeting" THEN ADD tags "meeting, work"
- Verify automatic application to new meeting notes
- Confirm existing tags are preserved

### Advanced Usage
**As a** team lead managing project documentation,
**I want** to automatically update project status properties,
**So that** team members always see current project state.

**Acceptance Criteria**:
- Create rule: IF project_status contains "completed" THEN REPLACE status with "done"
- Verify property replacement on status change
- Confirm old values are completely replaced

### Administrative Control
**As a** vault administrator,
**I want** flexible scanning options,
**So that** I can control performance impact.

**Acceptance Criteria**:
- Configure scan scope (entire vault vs. recent notes)
- Set custom note counts for performance tuning
- Schedule automatic runs with appropriate intervals

## Success Metrics

### Adoption Metrics
- **Installation Rate**: Target 1,000+ active installations within 6 months
- **Usage Frequency**: Average 10+ rules executed per user per week
- **Retention Rate**: 70%+ users continuing to use plugin after 30 days
- **Community Growth**: GitHub stars, forks, and community contributions

### Performance Metrics
- **Processing Speed**:
  - 100 notes: < 2 seconds
  - 500 notes: < 10 seconds
  - 1000 notes: < 30 seconds
- **Success Rate**: 99%+ successful rule executions
- **Error Rate**: < 1% failed operations per 1000 executions
- **Memory Efficiency**: < 50MB memory overhead during execution

### Feature Adoption
- **Operator Usage**: Track usage distribution across operators (exists, contains, exactly, etc.)
- **Action Type Distribution**: Monitor which actions are most used (ADD vs OVERWRITE vs DELETE)
- **Advanced Features**:
  - 30%+ users using date placeholders
  - 20%+ users using title modification
  - 40%+ users using scheduled execution
  - 15%+ users using settings import/export

### User Satisfaction
- **Feature Utilization**: Average 2+ different action types per user
- **Rule Complexity**: Average 1.5+ THEN actions per rule
- **Feedback Score**: Target 4.5+ stars on community plugin directory
- **Support Requests**: < 5% users requiring support documentation clarification

## Technical Architecture

### Core Components
1. **Rule Engine**: Evaluates conditions and executes actions
2. **YAML Processor**: Handles frontmatter parsing and generation
3. **Scanner**: Manages note discovery and filtering
4. **Scheduler**: Handles automated execution timing
5. **Settings Manager**: Persists configuration and rules

### Data Flow
1. User defines rules in settings interface
2. Scanner identifies target notes based on scope
3. Rule engine evaluates conditions for each note
4. Actions are applied to matching notes' frontmatter
5. YAML is updated with new property values

### Technology Stack
- **Language**: JavaScript (ES6+)
- **Framework**: Obsidian Plugin API
- **Storage**: YAML for frontmatter, JSON for settings
- **Dependencies**: Obsidian APIs for vault access and metadata

## Future Roadmap

### Completed Features (v0.14.1 - Current)
- ✅ **exists/notExists Operators**: Check property existence without value matching
- ✅ **Date Placeholders**: `{date}` and `{date:FORMAT}` support in properties and titles
- ✅ **Title Modification**: Prefix/suffix actions with duplicate prevention
- ✅ **DELETE PROPERTY Action**: Complete property removal from frontmatter
- ✅ **Settings Import/Export**: Backup and restore configuration as JSON
- ✅ **Enhanced UI**: Dynamic field visibility based on operator selection
- ✅ **Robust Debugging**: Comprehensive logging for troubleshooting

### Phase 1 (v0.15.0 - Q1 2026)
- **REPLACE Action Completion**: Full implementation of value replacement logic
- **Regex Operator**: Pattern matching for advanced string conditions
- **Numeric Operators**: Greater than, less than, equals for numeric comparisons
- **Content Modification**: Extend rules to note body content (not just frontmatter)

### Phase 2 (v0.16.0 - Q2 2026)
- **Compound Conditions**: AND/OR/NOT logical operators for complex rules
- **Folder/Tag Scoping**: Apply rules to specific vault locations or tagged notes
- **Variable Support**: Native Obsidian variables ({{date}}, {{title}}, {{time}})
- **Property Renaming**: Dynamic property name changes

### Phase 3 (v0.17.0 - Q3 2026)
- **Template Integration**: Rule-based template application
- **Batch Actions**: Apply multiple rules to multiple files efficiently
- **API Extensions**: External trigger support via plugin API
- **Performance Optimization**: Parallel processing for large vaults (1000+ notes)
- **Undo/Redo**: Rollback capability for rule executions

## Risk Assessment

### Technical Risks
- **YAML Parsing Errors**: Implement robust error handling
- **Performance Issues**: Add processing limits and progress indicators
- **Data Loss**: Include backup mechanisms for failed operations

### Business Risks
- **User Adoption**: Ensure intuitive interface and comprehensive documentation
- **Maintenance Burden**: Modular architecture for easy updates
- **Compatibility**: Regular testing with new Obsidian versions

## Implementation Plan

### Current Release (v0.14.1)
- ✅ Rule definition and execution system
- ✅ Multiple action types (ADD, REMOVE, OVERWRITE, DELETE PROPERTY)
- ✅ Title modification actions (PREFIX, SUFFIX)
- ✅ Advanced operators (exactly, contains, notContains, exists, notExists)
- ✅ Date placeholder support ({date} and {date:FORMAT})
- ✅ Flexible scanning options (entire vault, latest created/modified)
- ✅ Scheduled execution with configurable intervals
- ✅ Title-based and property-based conditions
- ✅ Settings import/export functionality
- ✅ Comprehensive debugging and logging

### Testing Strategy
- Unit tests for core rule engine logic
- Integration tests for YAML processing
- End-to-end tests for complete workflows
- Performance benchmarks for large vaults

## Support & Documentation

### User Documentation
- Comprehensive README with examples
- Inline help text and tooltips
- Video tutorials for complex workflows
- Community forum for user questions

### Developer Documentation
- API documentation for extension development
- Architecture decision records
- Contributing guidelines for open source

## Change Log

### v2.0 (December 2025)
- Updated to version 0.14.1
- Added exists/notExists operators documentation
- Added title modification features (prefix/suffix)
- Added date placeholder support ({date} and {date:FORMAT})
- Added DELETE PROPERTY action
- Added settings import/export functionality
- Enhanced success metrics with specific targets
- Reorganized roadmap to reflect completed features
- Updated performance targets and benchmarks

### v1.0 (October 2025)
- Initial PRD creation
- Core features documentation
- Basic requirements and user stories
- Initial roadmap planning

---

**Document Version**: 2.0
**Last Updated**: December 2025
**Status**: Production-ready - Active Development
**Next Review**: March 2026