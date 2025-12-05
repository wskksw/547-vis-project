# RAG Visualization System

This directory contains the D3.js-powered visualization components for the RAG Quality Dashboard.

## Overview

The visualization system transforms raw question-answer data into interactive visual analytics, addressing the need for visual encodings instead of text-heavy tables.

## Components

### 1. Quality Scatterplot (`QualityScatterplot.tsx`)
**What**: Scatterplot showing LLM score (x-axis) vs average similarity (y-axis) for all runs.

**Visual Encodings**:
- **x-position**: LLM-as-judge score (0-1)
- **y-position**: Average document similarity (0-1)
- **color**: Human flags (green=0, red=1+)
- **size**: Fixed 8px
- **opacity**: 0.7

**Interactions**:
- Click point → navigate to question detail (also highlights; when a highlight set is active, only highlighted points remain clickable and are drawn on top)
- Hover → tooltip with details

### 2. Distribution Histograms (`DistributionHistograms.tsx`)
**What**: Two small multiple histograms showing score distributions.

**Visual Encodings**:
- **x-position**: Score bins (0-0.1, 0.1-0.2, ... 0.9-1.0)
- **y-position**: Count of runs in bin
- **color**: Sequential light→dark blues (lowest scores = light slate, highest = deep blue)

**Interactions**:
- Click bin → highlight that score range across views
- Hover → tooltip with count and percentage

### 3. Document Fingerprint Chart (`DocumentUsageChart.tsx`)
**What**: Compact visualization showing chunk-level quality patterns within each document, styled as a "fingerprint" with continuous color encoding.

**Visual Encodings**:
- **Document-level layout**: Each document is a horizontal row
- **Chunk position (x-axis)**: Sequential chunk index within document (chunk 0, 1, 2...)
- **Chunk color**: Continuous gradient from white (#f8fafc) → red (via `d3.interpolateReds`)
  - White/near-white: Safe chunks (severity = 0 or very low)
  - Light rose: Moderate issues (low severity)
  - Deep red: Critical hotspots (high severity)
  - Color intensity = `severity / maxChunkSeverity` normalized (0.1 to 1.0 range in interpolateReds)
- **Severity calculation**: Weighted sum per chunk: `(Flags × 10) + Poor LLM Count`
  - Human flags weighted ×10 (ALPHA) to prioritize user-identified issues
  - Poor LLM = runs with LLM score < 0.4 (system failure threshold)
- **Document sorting**: Descending by weighted severity, then flags, then retrieval count

**Metadata badges** (per document):
- **Flags**: Count of unique questions with human flags when this doc was retrieved
- **Poor LLM**: Count of unique questions with LLM score < 0.4
- **Retrieved**: Total retrieval count across all runs

**Interactions**:
- **Hover chunk** → Fixed-position tooltip shows:
  - Document title + chunk index
  - Actual chunk text (truncated to 120 chars)
  - Flags, Poor LLM count, Runs count
- **Click document title** → Highlight all runs that retrieved any chunk from that document
- **Click individual chunk** → Highlight runs that retrieved that specific chunk (chunk-level focus, document dehighlighted) and show a visible border on the active chunk
- **Subsequent clicks** → Replace previous selection (no cumulative filtering)
- **Selection feedback**: 
  - Selected document: rose border + rose background tint
  - Selected chunk: 2px rose ring around segment
  - Non-selected chunks (when one is selected): 35% opacity

**Layout Constants**:
- `LABEL_COLUMN = 280px`: Fixed width for document titles and badges
- `MIN_SEGMENT_WIDTH = 6px`: Minimum visible chunk width
- `rowHeight = 32px`: Fixed height per document row
- Dynamic bar width: Fills remaining horizontal space (min 360px)

## Data Flow

```
Prisma DB → /api/viz/overview → VizDataPoint[] → Components
```

### VizDataPoint Structure
```typescript
{
  runId: string;
  questionId: string;
  questionText: string;
  timestamp: string;
  llmScore: number;        // Computed from Feedback or trace
  avgSimilarity: number;   // Average of Retrieval scores
  humanFlags: number;      // Count of low feedback ratings
  configModel: string;
  configTopK: number;
  retrievedDocs: Array<{
    title: string;
    score: number;
  }>;
}
```

## Coordinated Interactions

All three views are linked via the `OverviewDashboard` component:

1. **Point click** in scatterplot → highlights that run and opens the question page
2. **Bin click** in histogram → highlights runs within that score range across views
3. **Document/chunk click** in fingerprint chart → highlights based on selection level:
   - Document-level: All runs that retrieved any chunk from that document
   - Chunk-level: Only runs that retrieved that specific chunk

Highlight state is managed via React `useState` and passed down as props. Each new selection replaces the previous one (non-cumulative for simplicity).

## D3.js Usage

Every component uses D3.js v7 for:
- **Scales**: `d3.scaleLinear()`, `d3.scaleBand()`, `d3.scaleSequential()`
- **Axes**: `d3.axisBottom()`, `d3.axisLeft()`
- **Color**: 
  - Scatterplot: `d3.interpolateRdYlGn` (colorblind-aware diverging scale)
  - Histograms: `d3.interpolateBlues` (sequential scale, anchored to observed min/max)
  - Document Fingerprint: `d3.interpolateReds` (sequential scale, 0.1-1.0 range for continuous gradient)
- **Data binding**: `.data().join()` pattern
- **Interactions**: `d3.brush()` for selection in scatterplot
- **Binning**: `d3.bin()` for histograms

## Running the Visualization

### 1. Generate Sample Data
```bash
npm run generate:sample
```

This creates ~40-50 diverse runs with varied quality scores.

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Navigate to Dashboard
```
http://localhost:3000/dashboard-viz
```

## Design Rationale

### Why Scatterplot?
- Reveals correlation (or disagreement) between LLM score and similarity
- Each point is a unique run (preserves individual data)
- Color for human flags draws attention to problems
- Alternative considered: Timeline - rejected because temporal patterns less important than metric relationships

### Why Histograms?
- Familiar visualization, no learning curve
- Shows distribution shape (not just summary stats like mean)
- Color-coded bins provide pre-attentive assessment
- Alternative considered: Box plots - rejected because they hide multimodality

### Why Document Fingerprint (not traditional bar chart)?
**Design Goals**:
- **Chunk-level granularity**: Traditional document-level aggregation hides which specific chunks cause problems
- **Pattern recognition**: Visual "fingerprint" makes problem documents instantly recognizable at a glance
- **Severity prioritization**: Weighted scoring (Flags ×10) ensures human-identified issues rise to top

**Visual Design Decisions**:

1. **Continuous color gradient (white → red)**:
   - **Rationale**: Severity is continuous, not categorical. Chunks exist on a spectrum from "safe" to "critical"
   - **Color choice**: Red universally signals "danger/problem"; white = "clean/safe" is intuitive
   - **D3 interpolation**: `d3.interpolateReds(0.1 + 0.9 * t)` provides perceptually uniform scaling
   - **Why not green-to-red**: Green implies "good quality", but a chunk with 0 issues is neutral (not "good"), so white is more semantically accurate
   - **Alternative rejected**: Categorical colors (e.g., 3-4 severity buckets) - loses nuance in severity differences

2. **Horizontal layout (chunks as segments, not bars)**:
   - **Rationale**: Preserves sequential chunk order (chunk 0, 1, 2...) which matters for understanding document structure
   - **Space efficiency**: Can show 20-50 chunks per document in minimal vertical space
   - **Alternative rejected**: Vertical bars per chunk - wastes space, loses sequential reading order

3. **Sorting by severity**:
   - **Rationale**: Puts worst problems at top (prioritizes developer attention)
   - **Weighted formula**: `(Flags × 10) + Poor LLM` treats human flags as 10× more critical than system-detected issues
   - **Why ×10**: Human flags indicate user-facing failures; LLM score < 0.4 indicates potential issues but not confirmed failures
   - **Tie-breaking**: Falls back to retrieval count (frequently-used documents get priority)

4. **Two-level selection** (document vs chunk):
   - **Rationale**: Supports both exploratory ("which documents are problematic?") and diagnostic ("which specific chunk causes failures?") workflows
   - **Click document title**: Broad filter to see all runs using any chunk from that document
   - **Click individual chunk**: Narrow filter to see only runs using that exact chunk
   - **Non-cumulative**: Each click replaces previous selection (reduces cognitive load vs. complex multi-select logic)

5. **Opacity feedback** (35% for non-selected):
   - **Rationale**: Maintains context (you can still see other chunks) while clearly showing focus
   - **Alternative rejected**: Complete hide - loses spatial context and makes comparison harder

6. **Minimal document-level metrics** (no per-doc severity badge):
   - **Rationale**: Reduces visual clutter; severity is already encoded in color intensity of chunks
   - **What's shown**: Flags, Poor LLM, and retrieval count - actionable metrics that aren't redundant with visual encoding

7. **Fixed tooltip with chunk text**:
   - **Rationale**: Chunk segments are small (often 6-20px); tooltip provides detail-on-demand
   - **Content choice**: Shows actual text (helps verify it's the right chunk), plus quantitative stats (flags, poor LLM, runs)
   - **Positioning**: Fixed (not absolute) to prevent viewport clipping

**Alternative Considered: Treemap**
- **Rejected**: Loses sequential chunk order; harder to compare severity across documents; more complex visual encoding (both size and color)

**Alternative Considered: Heatmap Matrix**
- **Rejected**: Requires fixed grid (wastes space when documents have different chunk counts); harder to scan document names

**Alternative Considered: Stacked Bar Chart**
- **Rejected**: Implies additive relationship (chunks don't "stack" to a meaningful total); harder to see individual chunk severity

## Scalability

Current design works well for 30-100 runs:
- **Scatterplot**: Opacity prevents overlap, brush selects regions
- **Histograms**: 10 bins handles any dataset size
- **Document fingerprint**: Shows all documents (sorted by severity), compact chunk representation

For 1000+ runs (future):
- Switch scatterplot to hexbin density
- Add zoom/pan to document chart
- Implement canvas rendering for performance
- Add virtual scrolling for document list (show top 50, lazy-load rest)

## File Structure

```
components/
  visualizations/
    QualityScatterplot.tsx       # Main scatterplot
    DistributionHistograms.tsx   # Small multiple histograms
    DocumentUsageChart.tsx       # Horizontal bar chart
  OverviewDashboard.tsx          # Coordinating container

app/
  api/
    viz/
      overview/
        route.ts                 # Data endpoint
  dashboard-viz/
    page.tsx                     # Main dashboard page
```
