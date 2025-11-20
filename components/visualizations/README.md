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
- Brush to select region → filters other views
- Click point → navigate to question detail
- Hover → tooltip with details

### 2. Distribution Histograms (`DistributionHistograms.tsx`)
**What**: Two small multiple histograms showing score distributions.

**Visual Encodings**:
- **x-position**: Score bins (0-0.1, 0.1-0.2, ... 0.9-1.0)
- **y-position**: Count of runs in bin
- **color**: Red (<0.4), Yellow (0.4-0.7), Green (>0.7)

**Interactions**:
- Click bin → filter to that score range
- Hover → tooltip with count and percentage

### 3. Document Usage Chart (`DocumentUsageChart.tsx`)
**What**: Horizontal bar chart of document retrieval frequency.

**Visual Encodings**:
- **x-position**: Retrieval count
- **y-position**: Document title (sorted by count)
- **color**: Average similarity when retrieved (gradient)
- **bar height**: Fixed

**Interactions**:
- Click bar → filter to runs using that document
- Hover → tooltip with stats

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

1. **Brush selection** in scatterplot → highlights in all views
2. **Bin click** in histogram → filters all views to score range
3. **Document click** in bar chart → filters to runs using that doc

Filter state is managed via React `useState` and passed down as props.

## D3.js Usage

Every component uses D3.js v7 for:
- **Scales**: `d3.scaleLinear()`, `d3.scaleBand()`, `d3.scaleSequential()`
- **Axes**: `d3.axisBottom()`, `d3.axisLeft()`
- **Color**: `d3.interpolateRdYlGn` (colorblind-safe)
- **Data binding**: `.data().join()` pattern
- **Interactions**: `d3.brush()` for selection
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

### Why Horizontal Bars?
- Better for long document titles (vertical would be cramped)
- Easy to compare lengths
- Color gradient shows whether popular = relevant
- Alternative considered: Treemap - rejected as overkill for simple counts

## Scalability

Current design works well for 30-100 runs:
- Scatterplot: Opacity prevents overlap, brush selects regions
- Histograms: 10 bins handles any dataset size
- Document chart: Shows top 15, sorted by frequency

For 1000+ runs (future):
- Switch scatterplot to hexbin density
- Add zoom/pan to document chart
- Implement canvas rendering for performance

## Accessibility

- Colorblind-safe palettes (RdYlGn diverging scale)
- Keyboard navigation support (TODO)
- ARIA labels on axes (TODO)
- Text alternatives for screen readers (TODO)

## Next Steps

1. Add keyboard navigation
2. Implement deep-dive bipartite graph view
3. Add export functionality (SVG download)
4. Performance optimization for large datasets
5. Mobile responsive design improvements

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

## Dependencies

- `d3`: ^7.9.0
- `@types/d3`: ^7.x (dev)
- `react`: ^19.x
- `next`: ^16.x

## Contributing

When adding new visualizations:
1. Use the same data structure (`VizDataPoint`)
2. Implement D3 scales, axes, and data binding
3. Add coordinated filtering via props
4. Include tooltips and hover states
5. Follow the color scheme (RdYlGn for quality)
6. Document visual encodings in comments

## License

Part of the 547-vis-project. See main README.
