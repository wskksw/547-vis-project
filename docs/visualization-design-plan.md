# RAG Visualization: Overview Page Design

## Goal
Visual analytics dashboard for evaluating RAG system performance

Some visual ideas: 
Coordinated multiple views
selection and highlight
selection and filter (very much enabled through D3.js/react)

Domain situation

Users: RAG builders / instructors / ML engineers.

Goal: Evaluate and debug RAG behavior: find where retrieval & generation disagree, and diagnose document usage patterns.

Data / task abstraction

Data types:

A table of Q&A pairs:

Keys: question ID

Attributes: LLM score (quantitative), similarity score (quantitative), human flag count (ordered / quantitative), doc IDs, etc.

Derived data:

Histogram bins (aggregated counts per score bin).

Document aggregates (retrieval count per document, avg similarity per doc).

Task abstractions (Brehmer & Munzner style):

WHY:

Discover & Present: understand overall performance, then communicate it.

Query: “Show me where retrieval & generation disagree,” “Show me heavily-used docs with low similarity.” 
Computer Science at UBC

WHAT (targets):

Distributions (score histograms)

Correlations (LLM vs similarity)

Outliers (high LLM / low sim, or vice versa)

Aggregates (per-document usage)

HOW (operations):

Filter (by score range, by document)

Identify (outlier Q&A items)

Compare (documents, score ranges)

Summarize (histogram & bar chart overview)

---

## Visualization 1: Quality Scatterplot

**What**: Points show all Q&A pairs with LLM score (x-axis) vs similarity score (y-axis)

**Why**: Reveals correlation between metrics, identifies outliers where retrieval and generation disagree
Linked highlighting. Select. 
Histogram, bin filtering, global filtering

**How**:
- **Position**: x = LLM score, y = similarity score
- **Color**: Human flags (green = 0 flags, red = 4+ flags)
- **Interaction**: Click to select, click background to clear


---

## Visualization 2: Distribution Histograms

**What**: Two histograms showing score distributions (LLM scores and similarity scores)

**Why**: Shows overall performance distribution, identifies typical ranges vs outliers

**How**:
- **Position**: x = score bins (0-0.1, 0.1-0.2, etc.), y = count
- **Color**: Quality ranges (red < 0.4, yellow 0.4-0.7, green > 0.7)
- **Interaction**: Click bin to filter questions in that range

Note that similarity is usually a lot more clumped, so histogram bins may need adjustment to show useful variation.
---

## Visualization 3: Document Usage Chart

**What**: Horizontal bars showing retrieval frequency per document (top 15)

**Why**: Identifies over-used and under-used documents, reveals corpus coverage gaps

**How**:
- **Position**: x = retrieval count, y = document name (sorted by frequency)
- **Color**: Average similarity score (0.5-0.85 range for contrast)
- **Interaction**: Click bar to filter to questions using that document


## Coordinated Filtering
- Scatterplot selection → highlights in histograms
- Histogram bin click → filters scatterplot
- Document click → filters scatterplot + fades other bars
- "Clear all" button resets filters

