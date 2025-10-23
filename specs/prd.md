# Conditional Properties Plugin - Product Requirements Document (PRD)

## Executive Summary

**Product**: Conditional Properties Plugin for Obsidian
**Version**: 0.12.0
**Author**: Diego Eis
**Release Date**: October 2025

The Conditional Properties plugin enables Obsidian users to automate frontmatter property updates using conditional rules. Users can define IF/THEN rules to automatically modify note properties based on specific conditions, eliminating manual property management and ensuring consistency across their knowledge base.

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
2. **Multiple Action Types**: ADD, REMOVE, REPLACE, OVERWRITE, and DELETE operations
3. **Flexible Conditions**: Support for property values and note titles
4. **Batch Processing**: Scan entire vaults or specific note subsets
5. **Scheduled Execution**: Automated runs with configurable intervals
6. **Smart Merging**: Intelligent handling of multi-value properties

## Requirements

### Functional Requirements

#### FR-1: Rule Definition System
- Users can create conditional rules using IF/THEN logic
- Support for property-based and title-based conditions
- Multiple THEN actions per rule
- Persistent rule storage in plugin settings

#### FR-2: Condition Evaluation
- Support for "contains" and "notContains" operators
- Case-insensitive string matching with normalization
- Wiki link syntax handling ([[link]] normalization)
- Title extraction from H1 headers or inline titles

#### FR-3: Property Actions
- **ADD**: Add values to existing properties without duplication
- **REMOVE**: Remove specific values from properties
- **REPLACE**: Replace IF property value with new value
- **OVERWRITE**: Completely replace property with new value
- **DELETE**: Remove properties entirely from frontmatter

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
- **Installation Rate**: Number of active installations
- **Usage Frequency**: Average rules executed per user per week
- **Retention Rate**: Users continuing to use plugin after 30 days

### Performance Metrics
- **Processing Speed**: Average time to scan 100 notes
- **Success Rate**: Percentage of successful rule executions
- **Error Rate**: Number of failed operations per 1000 executions

### User Satisfaction
- **Feature Usage**: Percentage of users utilizing advanced features
- **Rule Complexity**: Average number of THEN actions per rule
- **Feedback Score**: User ratings and reviews

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

### Phase 1 (v0.13.0 - Q4 2025)
- **Variable Support**: Native Obsidian variables ({{date}}, {{title}})
- **Property Renaming**: Change property names dynamically
- **Content Modification**: Extend rules to note body content

### Phase 2 (v0.14.0 - Q1 2026)
- **Advanced Operators**: Regex matching, numeric comparisons
- **Compound Conditions**: AND/OR/NOT logical operators
- **Folder Scoping**: Apply rules to specific folders or tags

### Phase 3 (v0.15.0 - Q2 2026)
- **Template Integration**: Rule-based template application
- **API Extensions**: External trigger support
- **Performance Optimization**: Parallel processing capabilities

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

### Current Release (v0.12.0)
- ✅ Rule definition and execution system
- ✅ Multiple action types (ADD, REMOVE, OVERWRITE, DELETE)
- ✅ REPLACE functionality for IF property substitution
- ✅ Flexible scanning options
- ✅ Scheduled execution
- ✅ Title-based conditions

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

---

**Document Version**: 1.0
**Last Updated**: October 2025
**Status**: Complete
**Next Review**: January 2026