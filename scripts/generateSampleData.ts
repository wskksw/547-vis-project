/**
 * Generate realistic sample data for RAG visualization testing
 * 
 * Creates ~40-50 diverse questions with:
 * - Mix of quality scores (good, medium, poor)
 * - Cases where metrics disagree
 * - Realistic document usage patterns
 * - Configuration variation
 * 
 * NOTE: This script matches the actual Prisma schema structure:
 * Question → Run ← Config
 *           ↓
 *        Answer + Retrievals + Feedback
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample documents from course content
const DOCUMENTS = [
  { title: 'Lab 3 Assignment', category: 'labs', path: 'labs/labs_lab3_assign.md' },
  { title: 'Lab 3 Practice', category: 'labs', path: 'labs/labs_lab3_practice.md' },
  { title: 'Lab 5 Assignment', category: 'labs', path: 'labs/labs_lab5_assign.md' },
  { title: 'Lab 7 Java Setup', category: 'labs', path: 'labs/labs_lab7_java_assign_setup.md' },
  { title: 'Course Syllabus', category: 'syllabus', path: '304syllabus.md' },
  { title: 'Lab Setup Guide', category: 'setup', path: 'labs/labs_setup.md' },
  { title: 'Lab 2 Practice', category: 'labs', path: 'labs/labs_lab2_practice.md' },
  { title: 'Lab 8 Development', category: 'labs', path: 'labs/labs_lab8_develop.md' },
  { title: 'Lab 9 Analysis', category: 'labs', path: 'labs/labs_lab9_analyze.md' },
  { title: 'Lab 6 Python Assignment', category: 'labs', path: 'labs/labs_lab6_assignPython.md' },
];

// Sample questions with expected quality patterns
const QUESTION_TEMPLATES = [
  // GOOD ANSWERS - high LLM score, high similarity, 0 flags
  {
    text: 'What is the deadline for Lab 3?',
    expectedDocs: ['Lab 3 Assignment'],
    llmScore: 0.82,
    avgSimilarity: 0.78,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'How do I set up the Java environment for Lab 7?',
    expectedDocs: ['Lab 7 Java Setup', 'Lab Setup Guide'],
    llmScore: 0.79,
    avgSimilarity: 0.75,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'What are the grading criteria for assignments?',
    expectedDocs: ['Course Syllabus'],
    llmScore: 0.85,
    avgSimilarity: 0.82,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'Can you explain the Lab 5 requirements?',
    expectedDocs: ['Lab 5 Assignment'],
    llmScore: 0.77,
    avgSimilarity: 0.73,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'What topics are covered in Lab 8?',
    expectedDocs: ['Lab 8 Development'],
    llmScore: 0.76,
    avgSimilarity: 0.71,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'How do I submit Lab 2?',
    expectedDocs: ['Lab 2 Practice'],
    llmScore: 0.81,
    avgSimilarity: 0.76,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'What is covered in the Lab 9 analysis?',
    expectedDocs: ['Lab 9 Analysis'],
    llmScore: 0.78,
    avgSimilarity: 0.74,
    humanFlags: 1,
    pattern: 'good_match',
  },
  {
    text: 'Explain the Node.js setup for Lab 7',
    expectedDocs: ['Lab 7 NodeJS Setup'],
    llmScore: 0.74,
    avgSimilarity: 0.72,
    humanFlags: 0,
    pattern: 'good_match',
  },
  {
    text: 'What are the PHP requirements for Lab 7?',
    expectedDocs: ['Lab 7 PHP Setup'],
    llmScore: 0.73,
    avgSimilarity: 0.70,
    humanFlags: 0,
    pattern: 'good_match',
  },

  // MEDIUM ANSWERS - moderate scores, some flags

  {
    text: 'How should I approach the lab assignments?',
    expectedDocs: ['Course Syllabus', 'Lab Setup Guide'],
    llmScore: 0.58,
    avgSimilarity: 0.62,
    humanFlags: 1,
    pattern: 'ambiguous',
  },
  {
    text: 'What programming language should I use?',
    expectedDocs: ['Lab 6 Python Assignment', 'Lab 7 Java Setup'],
    llmScore: 0.53,
    avgSimilarity: 0.59,
    humanFlags: 1,
    pattern: 'ambiguous',
  },
  {
    text: 'Are there any practice exercises?',
    expectedDocs: ['Lab 3 Practice', 'Lab 2 Practice'],
    llmScore: 0.55,
    avgSimilarity: 0.63,
    humanFlags: 0,
    pattern: 'ambiguous',
  },
  {
    text: 'How much time should I spend on labs?',
    expectedDocs: ['Course Syllabus'],
    llmScore: 0.56,
    avgSimilarity: 0.60,
    humanFlags: 1,
    pattern: 'ambiguous',
  },
  {
    text: 'What is the best way to debug my code?',
    expectedDocs: ['Lab Setup Guide'],
    llmScore: 0.61,
    avgSimilarity: 0.58,
    humanFlags: 0,
    pattern: 'ambiguous',
  },

  // HIGH SIMILARITY, LOW LLM - Good retrieval, bad generation
  {
    text: 'What is the difference between Lab 3 assignment and practice?',
    expectedDocs: ['Lab 3 Assignment', 'Lab 3 Practice'],
    llmScore: 0.38,
    avgSimilarity: 0.74,
    humanFlags: 2,
    pattern: 'retrieval_good_generation_bad',
  },
  {
    text: 'Compare the setup requirements for Java and Python labs',
    expectedDocs: ['Lab 7 Java Setup', 'Lab 6 Python Assignment'],
    llmScore: 0.42,
    avgSimilarity: 0.72,
    humanFlags: 2,
    pattern: 'retrieval_good_generation_bad',
  },

  // LOW SIMILARITY, HIGH LLM - Lucky guess (or general knowledge)
  {
    text: 'What is object-oriented programming?',
    expectedDocs: ['Lab 6 Python Assignment'],
    llmScore: 0.73,
    avgSimilarity: 0.52,
    humanFlags: 1,
    pattern: 'lucky_guess',
  },
  {
    text: 'How do variables work in programming?',
    expectedDocs: ['Lab 2 Practice'],
    llmScore: 0.70,
    avgSimilarity: 0.54,
    humanFlags: 0,
    pattern: 'lucky_guess',
  },

  // POOR ANSWERS - low everything, high flags
  {
    text: 'Can you help me with my project that is not related to this course?',
    expectedDocs: [],
    llmScore: 0.22,
    avgSimilarity: 0.51,
    humanFlags: 1,
    pattern: 'off_topic',
  },
  {
    text: 'What is the meaning of life?',
    expectedDocs: [],
    llmScore: 0.18,
    avgSimilarity: 0.50,
    humanFlags: 1,
    pattern: 'off_topic',
  },
];

const CONFIGS = [
  { model: 'gpt-4o', topK: 3, threshold: 0.3, systemPrompt: 'You are a helpful teaching assistant.' },
  { model: 'gpt-4o', topK: 5, threshold: 0.3, systemPrompt: 'You are a helpful teaching assistant.' },
  { model: 'claude-3-5-sonnet', topK: 3, threshold: 0.3, systemPrompt: 'You are a helpful teaching assistant.' },
  { model: 'qwen-2.5-72b', topK: 3, threshold: 0.4, systemPrompt: 'You are a helpful teaching assistant.' },
  { model: 'qwen-2.5-72b', topK: 5, threshold: 0.3, systemPrompt: 'You are a helpful teaching assistant.' },
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function addNoise(value: number, variance: number): number {
  const noise = randomFloat(-variance, variance);
  return Math.max(0, Math.min(1, value + noise));
}

async function main() {
  console.log('🧹 Cleaning existing data...');
  await prisma.feedback.deleteMany();
  await prisma.retrieval.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.run.deleteMany();
  await prisma.config.deleteMany();
  await prisma.question.deleteMany();
  // Note: Keep documents and chunks as they're from the corpus

  console.log('📊 Generating sample questions and runs...');

  // Generate questions by repeating templates with variation
  const runs = [];

  // Create varied instances of each template
  for (const template of QUESTION_TEMPLATES) {
    const numInstances = template.pattern === 'good_match' ? 2 :
      template.pattern === 'ambiguous' ? 1 : 1;

    for (let i = 0; i < numInstances; i++) {
      const config = randomChoice(CONFIGS);

      // Create question
      const question = await prisma.question.create({
        data: {
          text: template.text,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
        },
      });

      // Create or reuse config
      let configRecord = await prisma.config.findFirst({
        where: {
          baseModel: config.model,
          topK: config.topK,
          threshold: config.threshold,
        },
      });

      if (!configRecord) {
        configRecord = await prisma.config.create({
          data: {
            baseModel: config.model,
            topK: config.topK,
            threshold: config.threshold,
            systemPrompt: config.systemPrompt,
          },
        });
      }

      // Create run
      const run = await prisma.run.create({
        data: {
          questionId: question.id,
          configId: configRecord.id,
        },
      });

      // Create answer
      const llmScore = addNoise(template.llmScore, 0.05);
      const avgSim = addNoise(template.avgSimilarity, 0.05);

      await prisma.answer.create({
        data: {
          runId: run.id,
          text: `Generated answer for: "${template.text}"\n\nBased on the retrieved documents, ${template.pattern === 'good_match' ? 'here is a comprehensive answer...' : template.pattern === 'off_topic' ? 'I could not find relevant information in the course materials.' : 'here is what I found...'}`,
          trace: JSON.stringify({ llmScore, avgSim, pattern: template.pattern }),
        },
      });

      // Create feedback (simulates human evaluation)
      const humanFlagCount = template.humanFlags;
      if (humanFlagCount > 0) {
        // Create one human feedback with low ratings to trigger flags
        await prisma.feedback.create({
          data: {
            runId: run.id,
            by: 'human',
            helpful: 1,  // Low rating
            correct: 1,  // Low rating
            relevant: 1, // Low rating
            score: llmScore,
            notes: 'Flagged for review',
          },
        });
      }

      // Create fake retrievals (without needing actual chunks)
      // Get or create fake document and chunks for testing
      const numRetrievals = config.topK;

      // Choose which documents to retrieve based on template
      const docsToUse = template.expectedDocs.length > 0
        ? template.expectedDocs.map(title => DOCUMENTS.find(d => d.title === title)).filter(Boolean)
        : [DOCUMENTS[Math.floor(Math.random() * DOCUMENTS.length)]];

      for (let r = 0; r < numRetrievals; r++) {
        // Use expected docs first, then random docs to fill topK
        const doc = r < docsToUse.length
          ? docsToUse[r]!
          : DOCUMENTS[Math.floor(Math.random() * DOCUMENTS.length)];

        // Find or create a document
        let document = await prisma.document.findFirst({
          where: { title: doc.title },
        });

        if (!document) {
          document = await prisma.document.create({
            data: {
              title: doc.title,
              url: doc.path,
            },
          });
        }

        // Find or create a chunk for this document
        let chunk = await prisma.chunk.findFirst({
          where: { documentId: document.id },
        });

        if (!chunk) {
          chunk = await prisma.chunk.create({
            data: {
              documentId: document.id,
              start: 0,
              end: 1000,
              text: `Sample chunk content from ${doc.title}. This is placeholder text for visualization testing.`,
            },
          });
        }

        // Calculate similarity score based on rank and template
        const baseSimilarity = avgSim;
        const rankPenalty = r * 0.05; // Each rank down reduces similarity slightly
        // Keep similarity in realistic range: 0.50-0.85
        const similarity = Math.max(0.50, Math.min(0.85, addNoise(baseSimilarity - rankPenalty, 0.02)));

        // Create retrieval
        await prisma.retrieval.create({
          data: {
            runId: run.id,
            chunkId: chunk.id,
            score: similarity,
          },
        });
      }

      runs.push({ question, run, config: configRecord, llmScore, avgSim });
    }
  }

  console.log(`✅ Generated ${runs.length} runs with answers and feedback`);

  // Count total retrievals
  const totalRetrievals = await prisma.retrieval.count();
  console.log(`📄 Created ${totalRetrievals} document retrievals`);

  // Summary statistics
  const stats = {
    total: runs.length,
    goodAnswers: runs.filter(r => r.llmScore > 0.7).length,
    mediumAnswers: runs.filter(r => r.llmScore >= 0.4 && r.llmScore <= 0.7).length,
    poorAnswers: runs.filter(r => r.llmScore < 0.4).length,
    uniqueQuestions: new Set(runs.map(r => r.question.id)).size,
    avgSimilarity: runs.reduce((sum, r) => sum + r.avgSim, 0) / runs.length,
  }; console.log('\n📈 Dataset Summary:');
  console.log(`   Total runs: ${stats.total}`);
  console.log(`   Unique questions: ${stats.uniqueQuestions}`);
  console.log(`   Good answers (>0.7): ${stats.goodAnswers}`);
  console.log(`   Medium answers (0.4-0.7): ${stats.mediumAnswers}`);
  console.log(`   Poor answers (<0.4): ${stats.poorAnswers}`);
  console.log(`   Average similarity: ${stats.avgSimilarity.toFixed(3)}`);

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ Error generating sample data:', e);
    process.exit(1);
  });
