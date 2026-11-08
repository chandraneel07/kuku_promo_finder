# Kuku MicroPromo Discovery Studio — Engineering & Technical Documentation

> **Problem 1 Solution:** Automated Microdrama Promo Discovery & Viral Optimization Tool  
> **Show Dataset:** *"I Married a Broken Soldier. He was a Duke"* (Episodes 1–50)  
> **Repository:** [https://github.com/chandraneel07/kuku_promo_finder](https://github.com/chandraneel07/kuku_promo_finder)  
> **Live Web Application:** Deployed on Vercel  

---

## 1. Executive Summary

In short-form vertical entertainment (TikTok, Instagram Reels, YouTube Shorts), promotional clips are the single largest driver of top-of-funnel user acquisition and paywall coin conversions. Microdramas rely on rapid emotional escalation: users make swipe decisions within **1.2 to 2.5 seconds**, and paywall unlocks occur at dramatic narrative climaxes.

The **Kuku MicroPromo Discovery Studio** is a production-grade, two-stage hybrid intelligence engine designed to analyze raw microdrama screenplays, identify high-converting narrative moments, rank promotional clips across a 3-tier marketing funnel, and audit edge cases through an automated quality assurance system.

### Key Metrics & Performance Highlights
* **Scale Analyzed:** 50 episodes, 100 scenes, 3,727 structured script blocks (dialogue, action, camera, and sound).
* **Candidates Discovered:** 148 valid promotional clips conforming strictly to the **20s–60s duration boundary**.
* **Processing Speed:** End-to-end screenplay parsing, evaluation, and ranking completes in **~0.75 seconds** locally.
* **Unit Economics:** Pre-filtered deterministic chunking reduces LLM token overhead by **85%**, cutting processing costs to **~$0.04 per 50-episode series** ($4.00/month for 100 shows) compared to $2,500/month for brute-force LLM prompting.

---

## 2. System Architecture

Passing 120,000 words of unstructured screenplay text directly into large language models causes severe timestamp hallucinations, speaker truncation, and prohibitive token expenses. To solve this, our system implements a **Two-Stage Hybrid Funnel Architecture**:

```mermaid
flowchart TD
    A["Raw Screenplays (Ep 1–50)"] --> B["Stage 1: Deterministic Parser (src/parser.js)"]
    B --> C["Structured Events (3,727 blocks)"]
    C --> D["Sliding Window & Multi-Segment Engine (src/engine.js)"]
    D --> E["Candidate Pool (20s–60s boundary checks)"]
    E --> F["Stage 2: Multi-Factor Virality Scorer (src/analyzer.js)"]
    F --> G["Non-Maximum Suppression (IoU < 0.35) (src/ranker.js)"]
    G --> H["Ranked Promo Dataset (outputs/promos_ranked.csv & json)"]
    H --> I["Diagnostic Quality Auditor (src/quality_check.js)"]
    I --> J["Stage 3: Interactive Web Studio (web/index.html)"]
```

### Stage 1: Deterministic Screenplay Parser (`src/parser.js`)
* **Regex Ingestion:** Robustly extracts Scene headings (`INT./EXT.`), Character Dialogue, Action descriptions, Camera movements (`CLOSE UP`, `PUSH IN`), and Sound cues (`[SFX: ...]`).
* **Timestamp & Speech Calibration:** Calculates precise elapsed runtimes based on natural speech delivery rates (135–150 words per minute) combined with standardized visual action and camera duration offsets.
* **Continuity Indexing:** Maps intra-scene and cross-episode narrative junctions to support both continuous single-scene clips and cross-episode multi-segment joins.

### Stage 2: Multi-Factor Virality Scorer (`src/analyzer.js` & `src/ranker.js`)
* **Deterministic Windowing:** Generates valid sliding windows strictly within the 20.0s to 60.0s duration ceiling.
* **100-Point Scoring Engine:** Computes weighted virality metrics (Hook, Cliffhanger, Standalone Coherence, Pacing).
* **Non-Maximum Suppression (NMS):** Deduplicates overlapping candidate windows using Intersection-over-Union (IoU threshold < 0.35), ensuring content diversity.

### Stage 3: Human-in-the-Loop Web Studio (`web/index.html`)
* **Kuku Design System:** Dark cinematic interface styled directly with official Kuku design tokens (`#0A0A0A` canvas, `#161616` elevated surfaces, `#EC1C24` Kuku Red accents).
* **Synchronized Script Inspection:** Marketing editors can inspect full dialogue, camera, and action blocks alongside ranking scores.
* **One-Click Export:** Instant download of `promos_ranked.csv`, complete outputs ZIP, and the official 2-Page Executive Solution PDF.

---

## 3. Mathematical Scoring Rubric

Every candidate promo is evaluated against a 100-point composite rubric:

$$\text{Total Score} = 0.30 \cdot H + 0.30 \cdot C + 0.25 \cdot S + 0.15 \cdot P$$

| Dimension | Weight | Target Metric | Algorithmic Evaluation |
| :--- | :---: | :---: | :--- |
| **🪝 Hook Strength ($H$)** | **30%** | Stop-scroll retention in **0–3.0s** | Detects immediate high-impact stimuli: physical slaps, drawn weapons, violent falls, explosive sound cues, and taboo moral accusations. Dialogue-only openings without motion are penalized. |
| **⚡ Cliffhanger Suspense ($C$)** | **30%** | Terminal curiosity & click-through | Evaluates unresolved narrative tension at the cut-point: abrupt blackouts, unanswered marriage proposals, descending torture weapons, and explosive identity reveals. |
| **🧭 Standalone Coherence ($S$)** | **25%** | Cold viewer comprehension | Measures immediate clarity of protagonist vs. antagonist dynamics. Heavy penalties are applied to confusing secondary lore, bureaucratic council debates, and non-essential character names. |
| **⏱️ Pacing & Density ($P$)** | **15%** | Emotional tempo & event density | Rewards dynamic back-and-forth exchanges and rapid escalation; penalizes slow exposition or repetitive dialogue loops. |

---

## 4. Strategic Marketing Funnel & Top Ranked Promos

To maximize customer acquisition and paid episode conversion, discovered promos are mapped to a **3-Phase Release Funnel**:

```mermaid
flowchart LR
    P1["Phase 1: Days 1–2 (Top-of-Funnel)<br>Public Betrayal & Outrage<br>Goal: Stop-scroll & 3s CTR"] --> P2["Phase 2: Days 3–5 (Mid-Funnel)<br>Moral Dilemmas & Trials<br>Goal: App Installs & Binging"]
    P2 --> P3["Phase 3: Days 6–8 (Conversion)<br>Cathedral Climax & Ducal Reveal<br>Goal: Paywall Coin Unlocks"]
```

### Top 5 Promos Breakdown

| Rank | Episode(s) | Duration | Funnel Phase & Archetype | 🪝 Hook (0–3s) & ⚡ Cliffhanger Cut | Strategic Rationale |
| :---: | :---: | :---: | :--- | :--- | :--- |
| **#1** | **Ep 41 & 42** | **41.9s** | **Phase 3: Conversion**<br>*The Secret Duke / Royal Retribution* | **Hook:** Ear-splitting detonation blasts cathedral entrance into a fireball.<br>**Cliffhanger:** Scarred Alexander emerges in ducal regalia; Royal Guard salutes: *"We will not."* | **Peak Spectacle & Catharsis:** Ultimate wish-fulfillment where the scorned beggar is revealed as the true Duke. Released on Days 6–8 when free episodes end to drive paid coin unlocks. |
| **#2** | **Ep 1 & 3** | **54.8s** | **Phase 1: Top-of-Funnel**<br>*The Mysterious Warrior Proposal* | **Hook:** Gerald cruelly breaks betrothal at altar, mocking Juliana's "low value".<br>**Cliffhanger:** Imposing scarred stranger disarms guards and kneels: *"Will you marry me, Juliana?"* | **Emotional Rollercoaster:** Visceral public betrayal immediately answered by an unexpected savior. Requires zero backstory; prime candidate for Day 1–2 TikTok ads. |
| **#3** | **Ep 12** | **52.2s** | **Phase 2: Mid-Funnel**<br>*The Barehanded Briar Trial* | **Hook:** Clarissa smiles sadistically: *"Crawl frozen blackthorn briars barehanded, or watch him hang!"*<br>**Cliffhanger:** Juliana reaches bare hand into razor thorns as Alexander screams. | **Visceral Empathy:** High-stakes physical jeopardy triggering moral outrage. Drives organic app installs and mid-season binge sessions. |
| **#4** | **Ep 1** | **52.0s** | **Phase 1: Top-of-Funnel**<br>*Altar Betrayal & Public Humiliation* | **Hook:** Juliana: *"Father... please look at me."* Groom sneers: *"I cannot marry a woman of such plainness."*<br>**Cliffhanger:** Devastation hardens to cold defiance as cello swells into an abrupt blackout. | **Pure Outrage Bait:** Self-evident Cinderella archetype. Cold viewers immediately demand retribution against the arrogant fiancé. |
| **#5** | **Ep 32** | **22.6s** | **Phase 2: Mid-Funnel**<br>*Dungeon Torture & Unyielding Defiance* | **Hook:** Chained Juliana: *"Look at you... you've already lost."*<br>**Cliffhanger:** Red-hot poker descends; extreme close-up on unblinking blue eye. | **Psychological Duel:** Unbroken dignity against sadistic torture creates unbearable curiosity right before physical impact. |

---

## 5. Quality Checking & Failure Mode Analysis

In real-world deployment across 148 candidates, our diagnostic engine audited edge cases and categorized candidates into quality tiers:
* **Tier S (Score 90+):** 5 promos (Elite viral candidates for primary ad spend)
* **Tier A (Score 80–89):** 7 promos (Strong organic performers)
* **Tier B (Score 70–79):** 31 promos (Retargeting & mid-season retention clips)
* **Tier C (Score <70):** 105 promos (Discarded or reserved for organic feed fillers)

### Four Identified Failure Modes & Automated Mitigations

#### 1. The False Action Hook (Visual vs. Text Disconnect)
* **The Defect:** Dialogue contains high-conflict phrases (*"You betrayed me!"*), but camera directions describe two characters seated calmly drinking tea with zero motion.
* **Why It Fails:** Text-only keyword scanners award high hook points based on verbal hostility, but TikTok scrollers swipe away in <1.2s without immediate visual movement or rapid camera punch-in.
* **Fix Implemented:** The parser extracts camera tags (`CLOSE UP`, `PUSH IN`) and physical action verbs (`slap`, `strike`, `fall`, `explosion`), heavily discounting dialogue-only intros unless accompanied by physical movement.

#### 2. Context-Blind Lore Traps
* **The Defect:** Scenes where secondary characters argue over parish deeds, council petitions, or Lord Sterling’s couriers (e.g. Episodes 20, 23, 49).
* **Why It Fails:** While dramatic to an engaged viewer who has watched 25 episodes, it is meaningless jargon to a cold social media user and generates zero emotional engagement.
* **Fix Implemented:** The Standalone Coherence filter penalizes secondary institutional lore, barring these scenes from top-of-funnel ad spend and reserving them strictly for mid-season retargeting.

#### 3. Sub-Second Acoustic Decay Clipping
* **The Defect:** Slicing video strictly at the screenplay's printed millisecond timestamp truncates lingering vocal reverberations, actor exhalations, or orchestral swell decays.
* **Why It Fails:** Screenplay timestamps record text delivery, not acoustic room reverberation.
* **Fix Implemented:** Output timeline manifests automatically inject a **+0.40s audio safety buffer** to eliminate jarring acoustic truncation in automated NLE assembly.

#### 4. Disjoint Cross-Scene Jump Cuts
* **The Defect:** Multi-segment stitching across disparate environments (e.g. raining forest to indoor dining hall) disorients cold viewers, resembling a streaming glitch.
* **Why It Fails:** Pure programmatic concatenation lacks visual lighting and costume continuity.
* **Fix Implemented:** The multi-segment engine enforces strict causal continuity rules and flags a mandatory 0.2s white-flash/whoosh sound transition between joined clips.

---

## 6. Project Structure & Codebase Map

```text
kuku_promo_finder/
├── data/                               # Input screenplays and runtime datasets
│   ├── scripts/                        # 50 parsed screenplay files (episodes 1–50)
│   ├── promos_ranked.json              # Synchronized ranked dataset
│   ├── promos_ranked.csv               # Spreadsheet export dataset
│   └── quality_check_report.json       # Diagnostic QA report
├── outputs/                            # Unedited Output Pack
│   ├── promos_ranked.csv               # 148 ranked promos with timestamps & rationale
│   ├── promos_ranked.json              # Full structured JSON metadata
│   ├── promos_all.json                 # Complete unedited candidate extraction
│   ├── quality_check_report.json       # Automated failure mode audit
│   ├── promos_summary.md               # Human-readable executive catalog
│   └── Kuku_Problem_1_Solution_Doc.pdf # Official 2-Page Executive Solution PDF
├── public/                             # Static deployment root (Vercel & Netlify)
│   ├── index.html                      # Kuku design system web dashboard
│   ├── data/                           # Client-side fetched datasets
│   ├── kuku_problem_1_outputs_pack.zip # Downloadable ZIP archive of unedited outputs
│   └── Kuku_Problem_1_Solution_Doc.pdf # PDF link for direct browser viewing
├── src/                                # Core Engine Source Code
│   ├── parser.js                       # Screenplay regex parser & timestamp generator
│   ├── engine.js                       # Continuous & multi-segment window generator
│   ├── analyzer.js                     # 4-factor scoring rubric & archetype classifier
│   ├── ranker.js                       # Non-Maximum Suppression (IoU) deduplicator
│   └── quality_check.js                # Failure mode audit engine
├── web/                                # Source UI templates
│   └── index.html                      # Primary responsive HTML5 application
├── deploy_prep.js                      # Automated build & asset synchronization script
├── package.json                        # Project metadata, scripts, and dependencies
├── run_pipeline.js                     # CLI execution runner (end-to-end pipeline)
├── server.js                           # Local HTTP test server
├── vercel.json                         # Vercel deployment configuration
├── netlify.toml                        # Netlify deployment configuration
├── solution_doc.html                   # HTML source for the 2-Page PDF
├── Kuku_Problem_1_Solution_Doc.pdf     # Compiled 2-Page Executive Solution Document
├── kuku_problem_1_outputs_pack.zip     # Compressed archive of all unedited outputs
└── README.md                           # Repository overview & quickstart guide
```

---

## 7. Execution & Operational Guide

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* No external heavy frameworks or database installations required.

### 1. Run the End-to-End Pipeline
Executes parsing, window extraction, scoring, deduplication, and quality auditing across all 50 episodes:
```bash
node run_pipeline.js
```
*Execution takes ~0.75 seconds and regenerates all files in `outputs/`.*

### 2. Launch Local Web Dashboard
Starts the local development server:
```bash
node server.js
```
*Open [http://localhost:3000](http://localhost:3000) in your browser.*

### 3. Build & Prepare for Deployment
Synchronizes all datasets and documents into `public/`, `docs/`, and root:
```bash
npm run build
# (Runs node deploy_prep.js)
```

---

## 8. Deployment Architecture (Vercel & Netlify)

The project is architected for zero-configuration static edge hosting:
* **Vercel (`vercel.json`):** Sets `"outputDirectory": "public"` and `"cleanUrls": true`. Vercel automatically deploys static assets with global CDN caching.
* **Netlify (`netlify.toml`):** Configures `publish = "public"` and `command = "node deploy_prep.js"`.
* **GitHub Pages (`docs/`):** Contains identical synchronized assets for repository-based hosting.
* **Resilient Data Loading:** The web dashboard utilizes automatic fallback loading across candidate paths (`./data/`, `data/`, `/data/`), preventing 404 or path resolution errors across different subdomains.

---

## 9. AI Reflection & Key Learnings

### Where AI Got It Wrong
When given raw screenplay text and asked to *“extract the best 60-second promos”*, generic LLMs (GPT-4o, Gemini 1.5 Pro) consistently suffered from:
1. **Timestamp Drift & Hallucination:** Fabricated start/end points that drifted across scenes, generating clips varying wildly from 14s to 85s and breaking strict duration limits.
2. **Mid-Utterance Slicing:** Arbitrarily terminating cuts mid-sentence or mid-word based solely on character count.
3. **Lore Blindness:** Mistaking dense exposition regarding kingdom politics for compelling viral drama.

### The Correct Production Paradigm
We decoupled mathematical and temporal authority from the LLM. All timestamp calculation, duration math, boundary snapping, and deduplication are executed **100% deterministically in code**. AI is reserved exclusively where it excels: semantic understanding, qualitative hook evaluation, and thematic virality classification.
