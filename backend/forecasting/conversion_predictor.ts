import { api } from "encore.dev/api";
import { db } from "./db";
import { ConversionPrediction, ConversionFactor, MLModel, ModelPerformanceMetrics } from "./types";

export interface PredictConversionRequest {
  prospectId: string;
  features?: Record<string, any>;
}

export interface PredictConversionResponse {
  prediction: ConversionPrediction;
  modelUsed: string;
  recommendations: string[];
}

export interface TrainConversionModelRequest {
  startDate: Date;
  endDate: Date;
  features: string[];
}

export interface BatchPredictRequest {
  prospectIds: string[];
}

export interface BatchPredictResponse {
  predictions: ConversionPrediction[];
  totalProcessed: number;
  avgConfidence: number;
}

export const predictConversion = api(
  { method: "POST", path: "/forecasting/conversion/predict", expose: true },
  async (req: PredictConversionRequest): Promise<PredictConversionResponse> => {
    const features = await extractProspectFeatures(req.prospectId, req.features);
    const model = await getActiveConversionModel();
    
    if (!model) {
      throw new Error("No active conversion model found. Please train a model first.");
    }

    const prediction = await generateConversionPrediction(req.prospectId, features, model);
    await saveConversionPrediction(prediction);

    const recommendations = generateRecommendations(prediction);

    return {
      prediction,
      modelUsed: `${model.name} v${model.version}`,
      recommendations
    };
  }
);

export const batchPredictConversion = api(
  { method: "POST", path: "/forecasting/conversion/batch-predict", expose: true },
  async (req: BatchPredictRequest): Promise<BatchPredictResponse> => {
    const model = await getActiveConversionModel();
    
    if (!model) {
      throw new Error("No active conversion model found. Please train a model first.");
    }

    const predictions: ConversionPrediction[] = [];
    let totalConfidence = 0;

    for (const prospectId of req.prospectIds) {
      try {
        const features = await extractProspectFeatures(prospectId);
        const prediction = await generateConversionPrediction(prospectId, features, model);
        await saveConversionPrediction(prediction);
        
        predictions.push(prediction);
        totalConfidence += prediction.confidence;
      } catch (error) {
        console.error(`Failed to predict conversion for prospect ${prospectId}:`, error);
      }
    }

    return {
      predictions,
      totalProcessed: predictions.length,
      avgConfidence: predictions.length > 0 ? totalConfidence / predictions.length : 0
    };
  }
);

export const trainConversionModel = api(
  { method: "POST", path: "/forecasting/conversion/train", expose: true },
  async (req: TrainConversionModelRequest): Promise<MLModel> => {
    const trainingData = await prepareTrainingData(req.startDate, req.endDate, req.features);
    const model = await trainModel(trainingData, 'conversion');
    
    await db.exec`
      UPDATE ml_models SET is_active = false WHERE type = 'conversion'
    `;

    const modelRecord = await db.exec`
      INSERT INTO ml_models (name, type, version, accuracy, features, training_data, last_trained)
      VALUES (${`conversion_model_${Date.now()}`}, 'conversion', '1.0', ${model.accuracy}, 
              ${JSON.stringify(req.features)}, ${JSON.stringify({
                startDate: req.startDate,
                endDate: req.endDate,
                sampleSize: trainingData.length
              })}, NOW())
      RETURNING *
    `;

    return {
      id: modelRecord[0].id,
      name: modelRecord[0].name,
      type: modelRecord[0].type,
      version: modelRecord[0].version,
      accuracy: parseFloat(modelRecord[0].accuracy),
      features: JSON.parse(modelRecord[0].features),
      trainingData: JSON.parse(modelRecord[0].training_data),
      isActive: modelRecord[0].is_active,
      lastTrained: modelRecord[0].last_trained,
      createdAt: modelRecord[0].created_at
    };
  }
);

export const getConversionPredictions = api(
  { method: "GET", path: "/forecasting/conversion/predictions", expose: true },
  async (): Promise<{ predictions: ConversionPrediction[] }> => {
    const rows = await db.query`
      SELECT * FROM conversion_predictions 
      ORDER BY created_at DESC 
      LIMIT 100
    `;

    return {
      predictions: rows.map(row => ({
        id: row.id,
        prospectId: row.prospect_id,
        predictionScore: parseFloat(row.prediction_score),
        confidence: parseFloat(row.confidence),
        factors: JSON.parse(row.factors),
        predictedDate: row.predicted_date,
        createdAt: row.created_at
      }))
    };
  }
);

export const getConversionModelPerformance = api(
  { method: "GET", path: "/forecasting/conversion/model-performance", expose: true },
  async (): Promise<ModelPerformanceMetrics> => {
    const activeModel = await getActiveConversionModel();
    
    if (!activeModel) {
      throw new Error("No active conversion model found");
    }

    const performanceRows = await db.exec`
      SELECT * FROM model_performance 
      WHERE model_id = ${activeModel.id} 
      ORDER BY evaluation_date DESC 
      LIMIT 1
    `;

    if (performanceRows.length === 0) {
      throw new Error("No performance metrics found for active model");
    }

    const perf = performanceRows[0];
    return {
      accuracy: parseFloat(perf.accuracy),
      precision: parseFloat(perf.precision_score),
      recall: parseFloat(perf.recall),
      f1Score: parseFloat(perf.f1_score),
      mse: parseFloat(perf.mse) || 0,
      mae: parseFloat(perf.mae) || 0,
      r2Score: parseFloat(perf.r2_score) || 0
    };
  }
);

async function extractProspectFeatures(prospectId: string, additionalFeatures?: Record<string, any>): Promise<Record<string, any>> {
  const prospectData = await db.exec`
    SELECT p.*, 
           COUNT(a.id) as activity_count,
           AVG(CASE WHEN a.type = 'email_open' THEN 1 ELSE 0 END) as email_open_rate,
           AVG(CASE WHEN a.type = 'email_click' THEN 1 ELSE 0 END) as email_click_rate,
           COUNT(CASE WHEN a.type = 'meeting_scheduled' THEN 1 END) as meetings_scheduled,
           EXTRACT(DAYS FROM NOW() - p.created_at) as days_in_pipeline
    FROM prospects p
    LEFT JOIN activities a ON p.id = a.prospect_id
    WHERE p.id = ${prospectId}
    GROUP BY p.id
  `;

  if (prospectData.length === 0) {
    throw new Error(`Prospect ${prospectId} not found`);
  }

  const prospect = prospectData[0];
  
  const features = {
    company_size: getCompanySizeScore(prospect.company),
    industry_score: getIndustryScore(prospect.industry),
    job_title_score: getJobTitleScore(prospect.job_title),
    email_engagement: parseFloat(prospect.email_open_rate) || 0,
    click_engagement: parseFloat(prospect.email_click_rate) || 0,
    activity_level: parseInt(prospect.activity_count) || 0,
    meetings_scheduled: parseInt(prospect.meetings_scheduled) || 0,
    days_in_pipeline: parseInt(prospect.days_in_pipeline) || 0,
    lead_source_score: getLeadSourceScore(prospect.source),
    geographic_score: getGeographicScore(prospect.location),
    ...additionalFeatures
  };

  return features;
}

async function getActiveConversionModel(): Promise<MLModel | null> {
  const rows = await db.exec`
    SELECT * FROM ml_models 
    WHERE type = 'conversion' AND is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    version: row.version,
    accuracy: parseFloat(row.accuracy),
    features: JSON.parse(row.features),
    trainingData: JSON.parse(row.training_data),
    isActive: row.is_active,
    lastTrained: row.last_trained,
    createdAt: row.created_at
  };
}

async function generateConversionPrediction(
  prospectId: string, 
  features: Record<string, any>, 
  model: MLModel
): Promise<ConversionPrediction> {
  const score = calculateConversionScore(features);
  const confidence = calculateConfidence(features, model);
  const factors = analyzeConversionFactors(features);
  const predictedDate = estimateConversionDate(features, score);

  return {
    id: crypto.randomUUID(),
    prospectId,
    predictionScore: score,
    confidence,
    factors,
    predictedDate,
    createdAt: new Date()
  };
}

function calculateConversionScore(features: Record<string, any>): number {
  const weights = {
    company_size: 0.15,
    industry_score: 0.12,
    job_title_score: 0.18,
    email_engagement: 0.20,
    click_engagement: 0.15,
    activity_level: 0.10,
    meetings_scheduled: 0.25,
    lead_source_score: 0.08,
    geographic_score: 0.05
  };

  let score = 0;
  let totalWeight = 0;

  for (const [feature, value] of Object.entries(features)) {
    if (weights[feature] && typeof value === 'number') {
      const normalizedValue = Math.min(Math.max(value, 0), 1);
      score += normalizedValue * weights[feature];
      totalWeight += weights[feature];
    }
  }

  return totalWeight > 0 ? Math.min(score / totalWeight, 1) : 0;
}

function calculateConfidence(features: Record<string, any>, model: MLModel): number {
  const baseConfidence = model.accuracy;
  const featureCompleteness = Object.keys(features).length / model.features.length;
  const dataQuality = Object.values(features).filter(v => v !== null && v !== undefined).length / Object.keys(features).length;
  
  return Math.min(baseConfidence * featureCompleteness * dataQuality, 1);
}

function analyzeConversionFactors(features: Record<string, any>): ConversionFactor[] {
  const factors: ConversionFactor[] = [];

  if (features.meetings_scheduled > 0) {
    factors.push({
      name: "Meeting Engagement",
      weight: 0.25,
      value: features.meetings_scheduled,
      impact: 'positive'
    });
  }

  if (features.email_engagement > 0.3) {
    factors.push({
      name: "Email Engagement",
      weight: 0.20,
      value: features.email_engagement,
      impact: 'positive'
    });
  }

  if (features.days_in_pipeline > 90) {
    factors.push({
      name: "Long Pipeline Duration",
      weight: 0.15,
      value: features.days_in_pipeline,
      impact: 'negative'
    });
  }

  if (features.job_title_score > 0.7) {
    factors.push({
      name: "High-Value Job Title",
      weight: 0.18,
      value: features.job_title_score,
      impact: 'positive'
    });
  }

  return factors;
}

function estimateConversionDate(features: Record<string, any>, score: number): Date | undefined {
  if (score < 0.3) return undefined;

  const baseDays = 45;
  const scoreFactor = (1 - score) * 30;
  const engagementFactor = features.email_engagement > 0.3 ? -10 : 10;
  const meetingFactor = features.meetings_scheduled > 0 ? -15 : 0;

  const estimatedDays = Math.max(baseDays + scoreFactor + engagementFactor + meetingFactor, 7);
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + estimatedDays);
  
  return futureDate;
}

async function saveConversionPrediction(prediction: ConversionPrediction): Promise<void> {
  await db.exec`
    INSERT INTO conversion_predictions (id, prospect_id, prediction_score, confidence, factors, predicted_date)
    VALUES (${prediction.id}, ${prediction.prospectId}, ${prediction.predictionScore}, 
            ${prediction.confidence}, ${JSON.stringify(prediction.factors)}, ${prediction.predictedDate})
  `;
}

function generateRecommendations(prediction: ConversionPrediction): string[] {
  const recommendations: string[] = [];

  if (prediction.predictionScore > 0.7) {
    recommendations.push("High conversion probability - prioritize immediate follow-up");
    recommendations.push("Schedule a demo or discovery call within 48 hours");
  } else if (prediction.predictionScore > 0.4) {
    recommendations.push("Moderate conversion probability - increase engagement frequency");
    recommendations.push("Send targeted content based on their industry and role");
  } else {
    recommendations.push("Low conversion probability - focus on nurturing");
    recommendations.push("Provide educational content to build trust and awareness");
  }

  const meetingFactor = prediction.factors.find(f => f.name === "Meeting Engagement");
  if (!meetingFactor || meetingFactor.value === 0) {
    recommendations.push("No meeting engagement detected - focus on scheduling discovery calls");
  }

  const longPipeline = prediction.factors.find(f => f.name === "Long Pipeline Duration");
  if (longPipeline && longPipeline.impact === 'negative') {
    recommendations.push("Prospect has been in pipeline for extended period - consider re-qualification");
  }

  return recommendations;
}

async function prepareTrainingData(startDate: Date, endDate: Date, features: string[]): Promise<any[]> {
  const trainingRows = await db.exec`
    SELECT p.id, p.status,
           COUNT(a.id) as activity_count,
           AVG(CASE WHEN a.type = 'email_open' THEN 1 ELSE 0 END) as email_open_rate,
           AVG(CASE WHEN a.type = 'email_click' THEN 1 ELSE 0 END) as email_click_rate,
           COUNT(CASE WHEN a.type = 'meeting_scheduled' THEN 1 END) as meetings_scheduled,
           EXTRACT(DAYS FROM COALESCE(p.converted_at, NOW()) - p.created_at) as days_in_pipeline,
           p.company, p.industry, p.job_title, p.source, p.location
    FROM prospects p
    LEFT JOIN activities a ON p.id = a.prospect_id
    WHERE p.created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY p.id
  `;

  return trainingRows.map(row => ({
    ...row,
    converted: row.status === 'converted' ? 1 : 0,
    company_size: getCompanySizeScore(row.company),
    industry_score: getIndustryScore(row.industry),
    job_title_score: getJobTitleScore(row.job_title),
    lead_source_score: getLeadSourceScore(row.source),
    geographic_score: getGeographicScore(row.location)
  }));
}

async function trainModel(data: any[], type: string): Promise<{ accuracy: number }> {
  const shuffled = data.sort(() => Math.random() - 0.5);
  const trainSize = Math.floor(shuffled.length * 0.8);
  const trainData = shuffled.slice(0, trainSize);
  const testData = shuffled.slice(trainSize);
  
  let correct = 0;
  for (const testCase of testData) {
    const features = {
      company_size: testCase.company_size,
      industry_score: testCase.industry_score,
      job_title_score: testCase.job_title_score,
      email_engagement: parseFloat(testCase.email_open_rate) || 0,
      click_engagement: parseFloat(testCase.email_click_rate) || 0,
      activity_level: parseInt(testCase.activity_count) || 0,
      meetings_scheduled: parseInt(testCase.meetings_scheduled) || 0,
      lead_source_score: testCase.lead_source_score,
      geographic_score: testCase.geographic_score
    };
    
    const prediction = calculateConversionScore(features);
    const predicted = prediction > 0.5 ? 1 : 0;
    
    if (predicted === testCase.converted) {
      correct++;
    }
  }

  return {
    accuracy: testData.length > 0 ? correct / testData.length : 0
  };
}

function getCompanySizeScore(company: string): number {
  if (!company) return 0.3;
  
  const size = company.toLowerCase();
  if (size.includes('enterprise') || size.includes('corp') || size.includes('inc')) return 0.8;
  if (size.includes('llc') || size.includes('ltd')) return 0.6;
  return 0.4;
}

function getIndustryScore(industry: string): number {
  if (!industry) return 0.3;
  
  const highValueIndustries = ['technology', 'software', 'finance', 'healthcare', 'manufacturing'];
  const normalizedIndustry = industry.toLowerCase();
  
  return highValueIndustries.some(hvi => normalizedIndustry.includes(hvi)) ? 0.8 : 0.5;
}

function getJobTitleScore(jobTitle: string): number {
  if (!jobTitle) return 0.3;
  
  const title = jobTitle.toLowerCase();
  if (title.includes('ceo') || title.includes('founder') || title.includes('president')) return 0.9;
  if (title.includes('vp') || title.includes('director') || title.includes('head')) return 0.8;
  if (title.includes('manager') || title.includes('lead')) return 0.6;
  return 0.4;
}

function getLeadSourceScore(source: string): number {
  if (!source) return 0.3;
  
  const highValueSources = ['referral', 'partner', 'demo_request', 'webinar'];
  return highValueSources.includes(source.toLowerCase()) ? 0.8 : 0.5;
}

function getGeographicScore(location: string): number {
  if (!location) return 0.5;
  
  const highValueRegions = ['california', 'new york', 'texas', 'london', 'toronto'];
  const normalizedLocation = location.toLowerCase();
  
  return highValueRegions.some(hvr => normalizedLocation.includes(hvr)) ? 0.8 : 0.6;
}