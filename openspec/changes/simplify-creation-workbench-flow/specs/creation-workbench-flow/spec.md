## ADDED Requirements

### Requirement: Unified Workbench Entry
The system SHALL provide a homepage creation flow that can open a unified creation workbench where script, visual description, source material, style, and generation state are edited at the shot level.

#### Scenario: Article input opens workbench
- **WHEN** a user enters article text or a video idea on the homepage and starts creation
- **THEN** the system SHALL create or prepare a project and open the unified workbench with generated shot cards instead of requiring a separate script page and style page

#### Scenario: Asset input opens workbench
- **WHEN** a user uploads image or video assets on the homepage and starts creation
- **THEN** the system SHALL open the unified workbench with shot cards that can reference the uploaded assets

### Requirement: Quick Video Automation
The system SHALL make quick video mode use recommended defaults so the user can reach a generated draft with minimal manual decisions.

#### Scenario: Quick video auto-selects defaults
- **WHEN** a user chooses quick video mode and starts creation
- **THEN** the system SHALL auto-select the recommended proposal, default aspect ratio, and default visual style without requiring blocking confirmation screens

#### Scenario: Quick video shows generation progress
- **WHEN** quick video mode is generating scenes or storyboard visuals
- **THEN** the workbench SHALL show visible progress, current generation status, and a control to pause or switch into editing

#### Scenario: Quick video keeps alternatives accessible
- **WHEN** the system auto-selects a proposal for quick video mode
- **THEN** the workbench SHALL keep other generated proposals accessible so the user can switch direction without restarting from the homepage

### Requirement: Editable Draft Shot Cards
The system SHALL make editable draft mode land on editable shot cards before visual generation is required.

#### Scenario: Editable draft stops before visual generation
- **WHEN** a user chooses editable draft mode and starts creation
- **THEN** the system SHALL generate a shot draft and stop at the workbench with editable shot cards before starting storyboard image or video generation

#### Scenario: Shot card exposes core fields
- **WHEN** a shot card is shown in editable draft mode
- **THEN** the shot card SHALL allow editing of narration or script text, visual description, source asset selection, duration, and generation controls

#### Scenario: Per-shot edits are preserved
- **WHEN** a user edits a shot card and saves or navigates within the workbench
- **THEN** the system SHALL preserve those edits in the project state and use them for subsequent generation

### Requirement: Asset Theme Guidance
The system SHALL allow asset-based creation to include an optional user theme or intention in addition to uploaded materials.

#### Scenario: User enters asset theme
- **WHEN** a user uploads assets and enters an asset theme such as "Guangzhou memories"
- **THEN** proposal and script generation SHALL use both the asset theme and uploaded asset descriptions as creation context

#### Scenario: User skips asset theme
- **WHEN** a user uploads assets but leaves the asset theme empty
- **THEN** the system SHALL continue to generate from uploaded asset context using a sensible generic prompt

#### Scenario: Asset theme is persisted
- **WHEN** a project is created from uploaded assets with an asset theme
- **THEN** the system SHALL persist the asset theme so refresh, regeneration, and later editing retain the user's intention

### Requirement: Integrated Style Controls
The system SHALL make aspect ratio and visual style available inside the workbench rather than requiring a separate style-selection page for new creation flows.

#### Scenario: Defaults are applied
- **WHEN** a new workbench project is created
- **THEN** the system SHALL initialize aspect ratio and visual style from the selected proposal or fallback defaults

#### Scenario: User changes style before generation
- **WHEN** a user changes aspect ratio or visual style before storyboard visuals are generated
- **THEN** the system SHALL apply the new setting to pending shot generation

#### Scenario: User changes style after generation
- **WHEN** a user changes aspect ratio or visual style after storyboard visuals already exist
- **THEN** the system SHALL ask whether to apply the setting to future generation only or regenerate existing visuals

### Requirement: Proposal Alternatives Are Non-Blocking
The system SHALL treat generated proposal alternatives as optional direction controls rather than mandatory blockers in the default creation path.

#### Scenario: Recommended proposal is selected automatically
- **WHEN** proposal generation returns multiple valid proposals
- **THEN** the system SHALL select the recommended proposal by default

#### Scenario: User switches proposal
- **WHEN** a user chooses a different proposal from the workbench
- **THEN** the system SHALL update the project direction and clearly indicate whether existing shot cards will be regenerated or preserved

### Requirement: Refresh-Safe Creation Context
The system SHALL persist enough creation context for the workbench to recover after refresh or navigation.

#### Scenario: Workbench refresh restores context
- **WHEN** a user refreshes a workbench project created from the homepage
- **THEN** the system SHALL restore prompt or asset theme, uploaded assets, selected proposal, generation mode, aspect ratio, visual style, and generated shot cards from persisted project data

#### Scenario: Generation failure can resume
- **WHEN** scene or storyboard generation fails after a project has been created
- **THEN** the system SHALL keep the available project context and allow the user to retry without returning to the homepage

### Requirement: Legacy Advanced Pages Remain Reachable
The system SHALL keep advanced script and style editing surfaces reachable while new homepage creation flows move to the workbench.

#### Scenario: User opens advanced script editing
- **WHEN** a user needs script-only editing from the workbench
- **THEN** the system SHALL provide a path to advanced script editing without making it mandatory for the default flow

#### Scenario: Existing project routes still load
- **WHEN** a user opens an existing script, style, or storyboard route directly
- **THEN** the system SHALL continue to load the route or redirect safely without losing project data
