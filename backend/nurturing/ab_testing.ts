import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { SequenceABTest } from "./types";
import * as ai from "../ai/openai";

// Create A/B test for a sequence
export const createABTest = api(
  { method: "POST", path: "/ab-test", expose: true },
  async (req: {
    sequence_id: number;
    test_name: string;
    variant_a_data: Record<string, any>;
    variant_b_data: Record<string, any>;
    traffic_split?: number;
    duration_days?: number;
  }) => {
    const endDate = req.duration_days ? 
      new Date(Date.now() + req.duration_days * 24 * 60 * 60 * 1000) : 
      null;
    
    const results = [];
    for await (const row of nurturingDB.query`
      INSERT INTO sequence_ab_tests (
        sequence_id, test_name, variant_a_data, variant_b_data,
        traffic_split, end_date
      )
      VALUES (
        ${req.sequence_id}, ${req.test_name}, ${JSON.stringify(req.variant_a_data)},
        ${JSON.stringify(req.variant_b_data)}, ${req.traffic_split || 50}, ${endDate}
      )
      RETURNING *
    `) {
      results.push(row);
    }
    const test = results[0];
    
    return test;
  }
);

// Get active A/B tests for a sequence
export const getActiveABTests = api(
  { method: "GET", path: "/ab-tests/:sequence_id", expose: true },
  async ({ sequence_id }: { sequence_id: number }) => {
    const tests = [];
    for await (const row of nurturingDB.query`
      SELECT * FROM sequence_ab_tests 
      WHERE sequence_id = ${sequence_id}
        AND status = 'active'
        AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
    `) {
      tests.push(row);
    }
    
    return tests;
  }
);

// Determine variant for a new enrollment
export const getVariantForEnrollment = api(
  { method: "POST", path: "/ab-test/variant", expose: true },
  async (req: { sequence_id: number; enrollment_id: number }) => {
    // Get active A/B test for this sequence
    const [test] = await nurturingDB.query`
      SELECT * FROM sequence_ab_tests 
      WHERE sequence_id = ${req.sequence_id}
        AND status = 'active'
        AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    if (!test) {
      return { variant: null, test_id: null };
    }
    
    // Use enrollment ID to determine variant (consistent assignment)
    const variant = (req.enrollment_id % 100) < test.traffic_split ? 'a' : 'b';
    
    return {
      variant,
      test_id: test.id,
      variant_data: variant === 'a' ? test.variant_a_data : test.variant_b_data
    };
  }
);

// AI-powered A/B test generation
export const generateABTestVariants = api(
  { method: "POST", path: "/ab-test/generate", expose: true },
  async (req: {
    sequence_id: number;
    test_type: 'subject_lines' | 'content_tone' | 'timing' | 'cta_style' | 'personalization';
    hypothesis?: string;
  }) => {
    // Get sequence details
    const [sequence] = await nurturingDB.query`
      SELECT * FROM nurturing_sequences WHERE id = ${req.sequence_id}
    `;
    
    const steps = [];
    for await (const row of nurturingDB.query`
      SELECT * FROM sequence_steps 
      WHERE sequence_id = ${req.sequence_id}
      ORDER BY step_number ASC
    `) {
      steps.push(row);
    }
    
    // Generate AI variants based on test type
    const prompt = createABTestPrompt(req.test_type, sequence, steps, req.hypothesis);
    
    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.8
    });
    
    const variants = parseABTestVariants(aiResponse.content);
    
    return {
      sequence,
      test_type: req.test_type,
      variants,
      ai_reasoning: variants.reasoning
    };
  }
);

// Analyze A/B test results and declare winner
export const analyzeABTestResults = api(
  { method: "POST", path: "/ab-test/:test_id/analyze", expose: true },
  async ({ test_id }: { test_id: number }) => {
    const [test] = await nurturingDB.query`
      SELECT * FROM sequence_ab_tests WHERE id = ${test_id}
    `;
    
    if (!test) {
      throw new Error("A/B test not found");
    }
    
    // Get performance data for both variants
    const variantAResults = await getVariantPerformance(test.sequence_id, test.start_date, test.end_date, 'a', test.traffic_split);
    const variantBResults = await getVariantPerformance(test.sequence_id, test.start_date, test.end_date, 'b', test.traffic_split);
    
    // Calculate statistical significance
    const significance = calculateStatisticalSignificance(variantAResults, variantBResults);
    
    // Use AI to analyze results
    const prompt = `
Analyze these A/B test results and provide insights:

Test: ${test.test_name}
Duration: ${Math.floor((new Date().getTime() - new Date(test.start_date).getTime()) / (1000 * 60 * 60 * 24))} days

Variant A Results:
- Enrollments: ${variantAResults.enrollments}
- Open Rate: ${variantAResults.open_rate?.toFixed(2)}%
- Click Rate: ${variantAResults.click_rate?.toFixed(2)}%
- Reply Rate: ${variantAResults.reply_rate?.toFixed(2)}%
- Avg Engagement: ${variantAResults.avg_engagement?.toFixed(2)}

Variant B Results:
- Enrollments: ${variantBResults.enrollments}
- Open Rate: ${variantBResults.open_rate?.toFixed(2)}%
- Click Rate: ${variantBResults.click_rate?.toFixed(2)}%
- Reply Rate: ${variantBResults.reply_rate?.toFixed(2)}%
- Avg Engagement: ${variantBResults.avg_engagement?.toFixed(2)}

Statistical Significance: ${significance.toFixed(2)}%

Provide:
1. Which variant performed better and why
2. Whether the results are statistically significant
3. Key learnings and insights
4. Recommendations for future tests

Format:
WINNER: [A or B or INCONCLUSIVE]
CONFIDENCE: [High/Medium/Low]
KEY_METRICS: [which metrics were most important]
INSIGHTS: [key learnings]
RECOMMENDATIONS: [future test suggestions]
`;

    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 500,
      temperature: 0.3
    });
    
    const analysis = parseABTestAnalysis(aiResponse.content);
    
    // Update test with results if conclusive
    let winner = null;
    if (significance > 95 && analysis.winner !== 'INCONCLUSIVE') {
      winner = analysis.winner.toLowerCase();
      
      await nurturingDB.exec`
        UPDATE sequence_ab_tests 
        SET winner = ${winner},
            statistical_significance = ${significance},
            status = 'completed'
        WHERE id = ${test_id}
      `;
    }
    
    return {
      test,
      variant_a_results: variantAResults,
      variant_b_results: variantBResults,
      statistical_significance: significance,
      winner,
      ai_analysis: analysis
    };
  }
);

// Auto-conclude A/B tests that have reached significance
// TODO: Auto-conclude A/B tests cron job - implement when cron is available
// Daily at noon: "0 12 * * *"

// Helper functions
async function getVariantPerformance(
  sequenceId: number, 
  startDate: Date, 
  endDate: Date | null, 
  variant: 'a' | 'b', 
  trafficSplit: number
) {
  const isVariantA = variant === 'a';
  const condition = isVariantA ? 
    `MOD(se.id, 100) < ${trafficSplit}` : 
    `MOD(se.id, 100) >= ${trafficSplit}`;
  
  const queryResults = [];
  for await (const row of nurturingDB.query`
    SELECT 
      COUNT(se.id) as enrollments,
      COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as open_rate,
      COUNT(nc.clicked_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as click_rate,
      COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as reply_rate,
      AVG(nc.engagement_score) as avg_engagement
    FROM sequence_enrollments se
    LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
    WHERE se.sequence_id = ${sequenceId}
      AND se.created_at >= ${startDate}
      AND (${endDate} IS NULL OR se.created_at <= ${endDate})
      AND ${condition}
  `) {
    queryResults.push(row);
  }
  const results = queryResults[0];
  
  return results || {
    enrollments: 0,
    open_rate: 0,
    click_rate: 0,
    reply_rate: 0,
    avg_engagement: 0
  };
}

function calculateStatisticalSignificance(variantA: any, variantB: any): number {
  // Simplified chi-square test for conversion rates
  const totalA = variantA.enrollments || 0;
  const totalB = variantB.enrollments || 0;
  const conversionsA = Math.round((variantA.reply_rate || 0) * totalA / 100);
  const conversionsB = Math.round((variantB.reply_rate || 0) * totalB / 100);
  
  if (totalA < 30 || totalB < 30) return 0; // Insufficient sample size
  
  const pooledRate = (conversionsA + conversionsB) / (totalA + totalB);
  const expectedA = totalA * pooledRate;
  const expectedB = totalB * pooledRate;
  
  if (expectedA < 5 || expectedB < 5) return 0; // Chi-square assumptions not met
  
  const chiSquare = 
    Math.pow(conversionsA - expectedA, 2) / expectedA +
    Math.pow(conversionsB - expectedB, 2) / expectedB +
    Math.pow((totalA - conversionsA) - (totalA - expectedA), 2) / (totalA - expectedA) +
    Math.pow((totalB - conversionsB) - (totalB - expectedB), 2) / (totalB - expectedB);
  
  // Convert chi-square to approximate confidence level
  if (chiSquare > 6.635) return 99;
  if (chiSquare > 3.841) return 95;
  if (chiSquare > 2.706) return 90;
  return 0;
}

function createABTestPrompt(testType: string, sequence: any, steps: any[], hypothesis?: string): string {
  return `
Create A/B test variants for a nurturing sequence optimization.

Test Type: ${testType}
Sequence: ${sequence.name}
Classification: ${sequence.classification_target}
Stage: ${sequence.stage_target}
${hypothesis ? `Hypothesis: ${hypothesis}` : ''}

Current Sequence Steps:
${JSON.stringify(steps, null, 2)}

Generate two distinct variants that test different approaches for ${testType}:

1. ${testType === 'subject_lines' ? 'Different email subject line styles' : ''}
${testType === 'content_tone' ? 'Different content tones (formal vs casual, urgent vs patient, etc.)' : ''}
${testType === 'timing' ? 'Different delay timing between steps' : ''}
${testType === 'cta_style' ? 'Different call-to-action approaches' : ''}
${testType === 'personalization' ? 'Different levels of personalization' : ''}

Requirements:
- Make variants significantly different to ensure meaningful test
- Keep the core value proposition consistent
- Ensure both variants are professional and appropriate
- Provide clear hypothesis for why each might perform better

Format:
VARIANT_A_TITLE: [descriptive title]
VARIANT_A_CHANGES: [specific changes to make]
VARIANT_A_HYPOTHESIS: [why this might work better]

VARIANT_B_TITLE: [descriptive title]  
VARIANT_B_CHANGES: [specific changes to make]
VARIANT_B_HYPOTHESIS: [why this might work better]

REASONING: [overall test strategy and expected learnings]
`;
}

function parseABTestVariants(content: string): any {
  const sections = content.split('\n');
  const result = {
    variant_a: { title: '', changes: '', hypothesis: '' },
    variant_b: { title: '', changes: '', hypothesis: '' },
    reasoning: ''
  };
  
  let currentSection = '';
  
  for (const line of sections) {
    if (line.startsWith('VARIANT_A_TITLE:')) {
      currentSection = 'variant_a_title';
      result.variant_a.title = line.replace('VARIANT_A_TITLE:', '').trim();
    } else if (line.startsWith('VARIANT_A_CHANGES:')) {
      currentSection = 'variant_a_changes';
      result.variant_a.changes = line.replace('VARIANT_A_CHANGES:', '').trim();
    } else if (line.startsWith('VARIANT_A_HYPOTHESIS:')) {
      currentSection = 'variant_a_hypothesis';
      result.variant_a.hypothesis = line.replace('VARIANT_A_HYPOTHESIS:', '').trim();
    } else if (line.startsWith('VARIANT_B_TITLE:')) {
      currentSection = 'variant_b_title';
      result.variant_b.title = line.replace('VARIANT_B_TITLE:', '').trim();
    } else if (line.startsWith('VARIANT_B_CHANGES:')) {
      currentSection = 'variant_b_changes';
      result.variant_b.changes = line.replace('VARIANT_B_CHANGES:', '').trim();
    } else if (line.startsWith('VARIANT_B_HYPOTHESIS:')) {
      currentSection = 'variant_b_hypothesis';
      result.variant_b.hypothesis = line.replace('VARIANT_B_HYPOTHESIS:', '').trim();
    } else if (line.startsWith('REASONING:')) {
      currentSection = 'reasoning';
      result.reasoning = line.replace('REASONING:', '').trim();
    } else if (line.trim() && currentSection) {
      if (currentSection.includes('variant_a')) {
        const field = currentSection.split('_')[2] as 'title' | 'changes' | 'hypothesis';
        result.variant_a[field] += '\n' + line;
      } else if (currentSection.includes('variant_b')) {
        const field = currentSection.split('_')[2] as 'title' | 'changes' | 'hypothesis';
        result.variant_b[field] += '\n' + line;
      } else if (currentSection === 'reasoning') {
        result.reasoning += '\n' + line;
      }
    }
  }
  
  return result;
}

function parseABTestAnalysis(content: string): any {
  const result = {
    winner: 'INCONCLUSIVE',
    confidence: 'Low',
    key_metrics: '',
    insights: '',
    recommendations: ''
  };
  
  const lines = content.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('WINNER:')) {
      result.winner = line.replace('WINNER:', '').trim();
    } else if (line.startsWith('CONFIDENCE:')) {
      result.confidence = line.replace('CONFIDENCE:', '').trim();
    } else if (line.startsWith('KEY_METRICS:')) {
      currentSection = 'key_metrics';
      result.key_metrics = line.replace('KEY_METRICS:', '').trim();
    } else if (line.startsWith('INSIGHTS:')) {
      currentSection = 'insights';
      result.insights = line.replace('INSIGHTS:', '').trim();
    } else if (line.startsWith('RECOMMENDATIONS:')) {
      currentSection = 'recommendations';
      result.recommendations = line.replace('RECOMMENDATIONS:', '').trim();
    } else if (line.trim() && currentSection) {
      result[currentSection] += '\n' + line;
    }
  }
  
  return result;
}

async function applyWinningVariant(sequenceId: number, winner: string, test: any): Promise<void> {
  const winningData = winner === 'a' ? test.variant_a_data : test.variant_b_data;
  
  // Apply winning variant changes to the original sequence
  // This is a simplified implementation - in practice, you'd want to be more careful about which changes to apply
  if (winningData.subject_template) {
    await nurturingDB.exec`
      UPDATE sequence_steps 
      SET subject_template = ${winningData.subject_template}
      WHERE sequence_id = ${sequenceId} AND step_number = 1
    `;
  }
  
  if (winningData.content_template) {
    await nurturingDB.exec`
      UPDATE sequence_steps 
      SET content_template = ${winningData.content_template}
      WHERE sequence_id = ${sequenceId} AND step_number = 1
    `;
  }
  
  console.log(`Applied winning variant ${winner} to sequence ${sequenceId}`);
}