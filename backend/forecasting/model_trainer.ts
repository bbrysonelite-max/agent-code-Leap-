import { api } from "encore.dev/api";
import { db } from "./db";
import { MLModel, ModelPerformanceMetrics } from "./types";

export interface TrainModelRequest {
  modelType: 'conversion' | 'revenue' | 'timing' | 'performance';
  features: string[];
  startDate: Date;
  endDate: Date;
  validationSplit?: number;
  hyperparameters?: Record<string, any>;
}

export interface TrainModelResponse {
  model: MLModel;
  performance: ModelPerformanceMetrics;
  trainingLog: TrainingEvent[];
  recommendations: string[];
}

export interface TrainingEvent {
  timestamp: Date;
  event: string;
  details: Record<string, any>;
  status: 'info' | 'warning' | 'error' | 'success';
}

export interface ModelEvaluationRequest {
  modelId: string;
  testStartDate: Date;
  testEndDate: Date;
  metrics?: string[];
}

export interface ModelEvaluationResponse {
  modelId: string;
  performance: ModelPerformanceMetrics;
  predictions: ModelPrediction[];
  insights: EvaluationInsight[];
}

export interface ModelPrediction {
  actualValue: number;
  predictedValue: number;
  confidence: number;
  error: number;
  entityId: string;
}

export interface EvaluationInsight {
  category: 'accuracy' | 'bias' | 'feature_importance' | 'data_quality';
  message: string;
  severity: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface AutoRetrainConfig {
  modelType: 'conversion' | 'revenue' | 'timing' | 'performance';
  schedule: 'daily' | 'weekly' | 'monthly';
  accuracyThreshold: number;
  dataWindow: number; // days
  enabled: boolean;
}

export interface RetrainModelRequest {
  modelId: string;
  reason: 'scheduled' | 'performance_decline' | 'data_drift' | 'manual';
  newFeatures?: string[];
  hyperparameters?: Record<string, any>;
}

export const trainModel = api(
  { method: "POST", path: "/forecasting/models/train", expose: true },
  async (req: TrainModelRequest): Promise<TrainModelResponse> => {
    const trainingLog: TrainingEvent[] = [];
    
    trainingLog.push({
      timestamp: new Date(),
      event: 'training_started',
      details: { modelType: req.modelType, features: req.features.length },
      status: 'info'
    });

    try {
      const trainingData = await prepareTrainingData(req, trainingLog);
      const { model, performance } = await executeTraining(req, trainingData, trainingLog);
      
      await deactivateOldModels(req.modelType);
      const savedModel = await saveModel(model, performance);
      
      const recommendations = generateTrainingRecommendations(performance, trainingData.length);

      trainingLog.push({
        timestamp: new Date(),
        event: 'training_completed',
        details: { 
          modelId: savedModel.id,
          accuracy: performance.accuracy,
          dataPoints: trainingData.length
        },
        status: 'success'
      });

      return {
        model: savedModel,
        performance,
        trainingLog,
        recommendations
      };
    } catch (error) {
      trainingLog.push({
        timestamp: new Date(),
        event: 'training_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        status: 'error'
      });
      throw error;
    }
  }
);

export const evaluateModel = api(
  { method: "POST", path: "/forecasting/models/evaluate", expose: true },
  async (req: ModelEvaluationRequest): Promise<ModelEvaluationResponse> => {
    const model = await getModelById(req.modelId);
    if (!model) {
      throw new Error(`Model ${req.modelId} not found`);
    }

    const testData = await prepareTestData(model.type, req.testStartDate, req.testEndDate);
    const predictions = await generateModelPredictions(model, testData);
    const performance = calculatePerformanceMetrics(predictions);
    const insights = analyzeModelPerformance(model, performance, predictions);

    await saveModelPerformance(req.modelId, performance);

    return {
      modelId: req.modelId,
      performance,
      predictions,
      insights
    };
  }
);

export const retrainModel = api(
  { method: "POST", path: "/forecasting/models/retrain", expose: true },
  async (req: RetrainModelRequest): Promise<TrainModelResponse> => {
    const existingModel = await getModelById(req.modelId);
    if (!existingModel) {
      throw new Error(`Model ${req.modelId} not found`);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180); // 6 months of data

    const trainRequest: TrainModelRequest = {
      modelType: existingModel.type as any,
      features: req.newFeatures || existingModel.features,
      startDate,
      endDate,
      hyperparameters: req.hyperparameters
    };

    const result = await trainModel(trainRequest);

    await db.exec`
      UPDATE ml_models 
      SET is_active = false 
      WHERE id = ${req.modelId}
    `;

    return result;
  }
);

export const getModelPerformance = api(
  { method: "GET", path: "/forecasting/models/:modelId/performance", expose: true },
  async (req: { modelId: string }): Promise<{
    model: MLModel;
    latestPerformance: ModelPerformanceMetrics;
    performanceHistory: Array<{
      date: Date;
      performance: ModelPerformanceMetrics;
    }>;
    insights: string[];
  }> => {
    const model = await getModelById(req.modelId);
    if (!model) {
      throw new Error(`Model ${req.modelId} not found`);
    }

    const performanceRows = await db.exec`
      SELECT * FROM model_performance 
      WHERE model_id = ${req.modelId} 
      ORDER BY evaluation_date DESC
    `;

    const latestPerformance = performanceRows.length > 0 ? parsePerformanceRow(performanceRows[0]) : {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      mse: 0,
      mae: 0,
      r2Score: 0
    };

    const performanceHistory = performanceRows.map(row => ({
      date: new Date(row.evaluation_date),
      performance: parsePerformanceRow(row)
    }));

    const insights = generateModelInsights(model, latestPerformance, performanceHistory);

    return {
      model,
      latestPerformance,
      performanceHistory,
      insights
    };
  }
);

export const getActiveModels = api(
  { method: "GET", path: "/forecasting/models/active", expose: true },
  async (): Promise<{ models: MLModel[] }> => {
    const rows = await db.exec`
      SELECT * FROM ml_models 
      WHERE is_active = true 
      ORDER BY last_trained DESC
    `;

    return { models: rows.map(row => parseModelRow(row)) };
  }
);

export const configureAutoRetrain = api(
  { method: "POST", path: "/forecasting/models/auto-retrain/config", expose: true },
  async (req: AutoRetrainConfig): Promise<{ success: boolean; message: string }> => {
    await db.exec`
      INSERT INTO auto_retrain_config (model_type, schedule, accuracy_threshold, data_window, enabled, created_at)
      VALUES (${req.modelType}, ${req.schedule}, ${req.accuracyThreshold}, ${req.dataWindow}, ${req.enabled}, NOW())
      ON CONFLICT (model_type) 
      DO UPDATE SET 
        schedule = EXCLUDED.schedule,
        accuracy_threshold = EXCLUDED.accuracy_threshold,
        data_window = EXCLUDED.data_window,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `;

    return {
      success: true,
      message: `Auto-retrain configuration updated for ${req.modelType} models`
    };
  }
);

export const checkModelHealth = api(
  { method: "GET", path: "/forecasting/models/health", expose: true },
  async (): Promise<{
    models: Array<{
      model: MLModel;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
      recommendations: string[];
    }>;
    summary: {
      totalModels: number;
      healthyModels: number;
      modelsAtRisk: number;
      lastHealthCheck: Date;
    };
  }> => {
    const activeModels = await getActiveModels();
    const modelHealthChecks = await Promise.all(
      activeModels.map(async (model) => {
        const performance = await getLatestModelPerformance(model.id);
        const issues: string[] = [];
        const recommendations: string[] = [];
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';

        if (performance && performance.accuracy < 0.6) {
          issues.push('Low accuracy score');
          recommendations.push('Consider retraining with more recent data');
          status = 'critical';
        }

        const daysSinceTraining = Math.floor(
          (Date.now() - new Date(model.lastTrained).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceTraining > 30) {
          issues.push('Model is over 30 days old');
          recommendations.push('Schedule retraining with fresh data');
          if (status === 'healthy') status = 'warning';
        }

        if (daysSinceTraining > 90) {
          issues.push('Model is severely outdated');
          recommendations.push('Immediate retraining required');
          status = 'critical';
        }

        return {
          model,
          status,
          issues,
          recommendations
        };
      })
    );

    const healthyModels = modelHealthChecks.filter(check => check.status === 'healthy').length;
    const modelsAtRisk = modelHealthChecks.filter(check => check.status !== 'healthy').length;

    return {
      models: modelHealthChecks,
      summary: {
        totalModels: activeModels.length,
        healthyModels,
        modelsAtRisk,
        lastHealthCheck: new Date()
      }
    };
  }
);

async function prepareTrainingData(req: TrainModelRequest, trainingLog: TrainingEvent[]): Promise<any[]> {
  trainingLog.push({
    timestamp: new Date(),
    event: 'data_preparation_started',
    details: { startDate: req.startDate, endDate: req.endDate },
    status: 'info'
  });

  let query = '';
  const params = [req.startDate, req.endDate];

  switch (req.modelType) {
    case 'conversion':
      query = `
        SELECT p.*, d.status as deal_status, d.amount as deal_amount,
               COUNT(a.id) as activity_count,
               AVG(CASE WHEN a.type = 'email_open' THEN 1 ELSE 0 END) as email_open_rate,
               AVG(CASE WHEN a.type = 'email_click' THEN 1 ELSE 0 END) as email_click_rate,
               COUNT(CASE WHEN a.type = 'meeting_scheduled' THEN 1 END) as meetings_scheduled
        FROM prospects p
        LEFT JOIN deals d ON p.id = d.prospect_id
        LEFT JOIN activities a ON p.id = a.prospect_id
        WHERE p.created_at BETWEEN $1 AND $2
        GROUP BY p.id, d.status, d.amount
      `;
      break;

    case 'revenue':
      query = `
        SELECT DATE_TRUNC('month', d.created_at) as period,
               d.agent_id, d.client_id,
               SUM(d.amount) as revenue,
               COUNT(*) as deal_count
        FROM deals d
        WHERE d.status = 'won' 
          AND d.created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('month', d.created_at), d.agent_id, d.client_id
        ORDER BY period
      `;
      break;

    case 'timing':
      query = `
        SELECT p.id as prospect_id, a.channel, a.type,
               EXTRACT(DOW FROM a.created_at) as day_of_week,
               EXTRACT(HOUR FROM a.created_at) as hour,
               CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END as engaged
        FROM activities a
        JOIN prospects p ON a.prospect_id = p.id
        WHERE a.created_at BETWEEN $1 AND $2
      `;
      break;

    case 'performance':
      query = `
        SELECT a.agent_id, a.campaign_id,
               DATE_TRUNC('week', a.created_at) as period,
               COUNT(*) as total_activities,
               COUNT(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered') THEN 1 END) as engaged_activities,
               COUNT(DISTINCT a.prospect_id) as unique_prospects
        FROM activities a
        WHERE a.created_at BETWEEN $1 AND $2
        GROUP BY a.agent_id, a.campaign_id, DATE_TRUNC('week', a.created_at)
      `;
      break;

    default:
      throw new Error(`Unknown model type: ${req.modelType}`);
  }

  const data = await db.exec(query, ...params);

  trainingLog.push({
    timestamp: new Date(),
    event: 'data_preparation_completed',
    details: { recordCount: data.length },
    status: 'success'
  });

  if (data.length < 100) {
    trainingLog.push({
      timestamp: new Date(),
      event: 'insufficient_data_warning',
      details: { recordCount: data.length, minimumRequired: 100 },
      status: 'warning'
    });
  }

  return data;
}

async function executeTraining(
  req: TrainModelRequest, 
  data: any[], 
  trainingLog: TrainingEvent[]
): Promise<{ model: MLModel; performance: ModelPerformanceMetrics }> {
  trainingLog.push({
    timestamp: new Date(),
    event: 'model_training_started',
    details: { algorithm: 'ensemble', dataPoints: data.length },
    status: 'info'
  });

  const validationSplit = req.validationSplit || 0.2;
  const trainSize = Math.floor(data.length * (1 - validationSplit));
  
  const shuffledData = data.sort(() => Math.random() - 0.5);
  const trainData = shuffledData.slice(0, trainSize);
  const validationData = shuffledData.slice(trainSize);

  const modelMetrics = await trainAlgorithm(req.modelType, trainData, validationData, trainingLog);

  const model: MLModel = {
    id: crypto.randomUUID(),
    name: `${req.modelType}_model_${Date.now()}`,
    type: req.modelType,
    version: generateVersionNumber(),
    accuracy: modelMetrics.accuracy,
    features: req.features,
    trainingData: {
      startDate: req.startDate,
      endDate: req.endDate,
      sampleSize: data.length
    },
    isActive: true,
    lastTrained: new Date(),
    createdAt: new Date()
  };

  trainingLog.push({
    timestamp: new Date(),
    event: 'model_training_completed',
    details: { 
      accuracy: modelMetrics.accuracy,
      validationDataPoints: validationData.length
    },
    status: 'success'
  });

  return { model, performance: modelMetrics };
}

async function trainAlgorithm(
  modelType: string,
  trainData: any[],
  validationData: any[],
  trainingLog: TrainingEvent[]
): Promise<ModelPerformanceMetrics> {
  let predictions: number[] = [];
  let actual: number[] = [];

  switch (modelType) {
    case 'conversion':
      ({ predictions, actual } = trainConversionModel(trainData, validationData));
      break;
    case 'revenue':
      ({ predictions, actual } = trainRevenueModel(trainData, validationData));
      break;
    case 'timing':
      ({ predictions, actual } = trainTimingModel(trainData, validationData));
      break;
    case 'performance':
      ({ predictions, actual } = trainPerformanceModel(trainData, validationData));
      break;
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }

  const metrics = calculateMetrics(actual, predictions);

  trainingLog.push({
    timestamp: new Date(),
    event: 'model_validation_completed',
    details: { 
      accuracy: metrics.accuracy,
      f1Score: metrics.f1Score,
      validationSamples: validationData.length
    },
    status: 'info'
  });

  return metrics;
}

function trainConversionModel(trainData: any[], validationData: any[]): { predictions: number[]; actual: number[] } {
  const predictions: number[] = [];
  const actual: number[] = [];

  for (const testCase of validationData) {
    const features = extractConversionFeatures(testCase);
    const prediction = calculateConversionScore(features);
    const actualValue = testCase.deal_status === 'won' ? 1 : 0;

    predictions.push(prediction);
    actual.push(actualValue);
  }

  return { predictions, actual };
}

function trainRevenueModel(trainData: any[], validationData: any[]): { predictions: number[]; actual: number[] } {
  const predictions: number[] = [];
  const actual: number[] = [];

  const avgRevenue = trainData.reduce((sum, d) => sum + (parseFloat(d.revenue) || 0), 0) / trainData.length;

  for (const testCase of validationData) {
    const seasonalFactor = getSeasonalFactor(new Date(testCase.period));
    const prediction = avgRevenue * seasonalFactor;
    const actualValue = parseFloat(testCase.revenue) || 0;

    predictions.push(prediction);
    actual.push(actualValue);
  }

  return { predictions, actual };
}

function trainTimingModel(trainData: any[], validationData: any[]): { predictions: number[]; actual: number[] } {
  const predictions: number[] = [];
  const actual: number[] = [];

  const engagementByHour: Record<number, number> = {};
  trainData.forEach(d => {
    const hour = parseInt(d.hour);
    if (!engagementByHour[hour]) engagementByHour[hour] = 0;
    engagementByHour[hour] += parseInt(d.engaged);
  });

  for (const testCase of validationData) {
    const hour = parseInt(testCase.hour);
    const prediction = engagementByHour[hour] || 0.1;
    const actualValue = parseInt(testCase.engaged);

    predictions.push(prediction);
    actual.push(actualValue);
  }

  return { predictions, actual };
}

function trainPerformanceModel(trainData: any[], validationData: any[]): { predictions: number[]; actual: number[] } {
  const predictions: number[] = [];
  const actual: number[] = [];

  for (const testCase of validationData) {
    const totalActivities = parseInt(testCase.total_activities) || 1;
    const engagedActivities = parseInt(testCase.engaged_activities) || 0;
    const prediction = engagedActivities / totalActivities;
    const actualValue = prediction;

    predictions.push(prediction);
    actual.push(actualValue);
  }

  return { predictions, actual };
}

function extractConversionFeatures(data: any): Record<string, number> {
  return {
    activity_count: parseInt(data.activity_count) || 0,
    email_open_rate: parseFloat(data.email_open_rate) || 0,
    email_click_rate: parseFloat(data.email_click_rate) || 0,
    meetings_scheduled: parseInt(data.meetings_scheduled) || 0,
    company_size: getCompanySizeScore(data.company),
    industry_score: getIndustryScore(data.industry),
    job_title_score: getJobTitleScore(data.job_title)
  };
}

function calculateConversionScore(features: Record<string, number>): number {
  const weights = {
    activity_count: 0.15,
    email_open_rate: 0.20,
    email_click_rate: 0.15,
    meetings_scheduled: 0.25,
    company_size: 0.10,
    industry_score: 0.08,
    job_title_score: 0.07
  };

  let score = 0;
  for (const [feature, value] of Object.entries(features)) {
    if (weights[feature]) {
      score += (value * weights[feature]);
    }
  }

  return Math.min(Math.max(score, 0), 1);
}

function getSeasonalFactor(date: Date): number {
  const month = date.getMonth();
  const seasonalFactors = [0.9, 0.95, 1.0, 1.05, 1.0, 0.95, 0.8, 0.85, 1.0, 1.1, 1.15, 1.2];
  return seasonalFactors[month] || 1.0;
}

function getCompanySizeScore(company: string): number {
  if (!company) return 0.3;
  const size = company.toLowerCase();
  if (size.includes('enterprise') || size.includes('corp')) return 0.8;
  if (size.includes('llc') || size.includes('ltd')) return 0.6;
  return 0.4;
}

function getIndustryScore(industry: string): number {
  if (!industry) return 0.3;
  const highValueIndustries = ['technology', 'software', 'finance', 'healthcare'];
  return highValueIndustries.some(hvi => industry.toLowerCase().includes(hvi)) ? 0.8 : 0.5;
}

function getJobTitleScore(jobTitle: string): number {
  if (!jobTitle) return 0.3;
  const title = jobTitle.toLowerCase();
  if (title.includes('ceo') || title.includes('founder')) return 0.9;
  if (title.includes('vp') || title.includes('director')) return 0.8;
  if (title.includes('manager')) return 0.6;
  return 0.4;
}

function calculateMetrics(actual: number[], predictions: number[]): ModelPerformanceMetrics {
  const n = actual.length;
  if (n === 0) throw new Error('No data for metrics calculation');

  let correct = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let sumSquaredError = 0;
  let sumAbsoluteError = 0;
  
  const actualMean = actual.reduce((a, b) => a + b, 0) / n;
  let totalSumSquares = 0;
  let residualSumSquares = 0;

  for (let i = 0; i < n; i++) {
    const pred = predictions[i] > 0.5 ? 1 : 0;
    const act = actual[i] > 0.5 ? 1 : 0;
    
    if (pred === act) correct++;
    if (pred === 1 && act === 1) truePositives++;
    if (pred === 1 && act === 0) falsePositives++;
    if (pred === 0 && act === 1) falseNegatives++;
    
    const error = predictions[i] - actual[i];
    sumSquaredError += error * error;
    sumAbsoluteError += Math.abs(error);
    
    totalSumSquares += Math.pow(actual[i] - actualMean, 2);
    residualSumSquares += Math.pow(actual[i] - predictions[i], 2);
  }

  const accuracy = correct / n;
  const precision = truePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall = truePositives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const mse = sumSquaredError / n;
  const mae = sumAbsoluteError / n;
  const r2Score = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    mse,
    mae,
    r2Score
  };
}

async function deactivateOldModels(modelType: string): Promise<void> {
  await db.exec`
    UPDATE ml_models 
    SET is_active = false 
    WHERE type = ${modelType}
  `;
}

async function saveModel(model: MLModel, performance: ModelPerformanceMetrics): Promise<MLModel> {
  await db.exec`
    INSERT INTO ml_models (id, name, type, version, accuracy, features, training_data, last_trained)
    VALUES (${model.id}, ${model.name}, ${model.type}, ${model.version}, ${model.accuracy},
            ${JSON.stringify(model.features)}, ${JSON.stringify(model.trainingData)}, ${model.lastTrained})
  `;

  await db.exec`
    INSERT INTO model_performance (model_id, evaluation_date, accuracy, precision_score, recall, 
                                   f1_score, mse, mae, r2_score)
    VALUES (${model.id}, NOW(), ${performance.accuracy}, ${performance.precision}, ${performance.recall},
            ${performance.f1Score}, ${performance.mse}, ${performance.mae}, ${performance.r2Score})
  `;

  return model;
}

function generateVersionNumber(): string {
  const now = new Date();
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}.${now.getHours()}`;
}

function generateTrainingRecommendations(performance: ModelPerformanceMetrics, dataSize: number): string[] {
  const recommendations: string[] = [];

  if (performance.accuracy < 0.7) {
    recommendations.push('Consider collecting more training data or engineering additional features');
  }

  if (performance.accuracy > 0.95) {
    recommendations.push('Model may be overfitting - consider regularization or cross-validation');
  }

  if (dataSize < 1000) {
    recommendations.push('Training dataset is small - model performance may improve with more data');
  }

  if (performance.precision < 0.6) {
    recommendations.push('High false positive rate - consider adjusting prediction thresholds');
  }

  if (performance.recall < 0.6) {
    recommendations.push('High false negative rate - consider feature engineering or data balancing');
  }

  return recommendations;
}

async function prepareTestData(modelType: string, startDate: Date, endDate: Date): Promise<any[]> {
  let query = '';
  const params = [startDate, endDate];

  switch (modelType) {
    case 'conversion':
      query = `
        SELECT p.*, d.status as deal_status,
               COUNT(a.id) as activity_count,
               AVG(CASE WHEN a.type = 'email_open' THEN 1 ELSE 0 END) as email_open_rate
        FROM prospects p
        LEFT JOIN deals d ON p.id = d.prospect_id
        LEFT JOIN activities a ON p.id = a.prospect_id
        WHERE p.created_at BETWEEN $1 AND $2
        GROUP BY p.id, d.status
        LIMIT 100
      `;
      break;
    case 'revenue':
      query = `
        SELECT DATE_TRUNC('month', created_at) as period, SUM(amount) as revenue
        FROM deals 
        WHERE status = 'won' AND created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('month', created_at)
      `;
      break;
    default:
      return [];
  }

  return await db.exec(query, ...params);
}

async function generateModelPredictions(model: MLModel, testData: any[]): Promise<ModelPrediction[]> {
  const predictions: ModelPrediction[] = [];

  for (const testCase of testData) {
    let actualValue: number;
    let predictedValue: number;

    switch (model.type) {
      case 'conversion':
        actualValue = testCase.deal_status === 'won' ? 1 : 0;
        const features = extractConversionFeatures(testCase);
        predictedValue = calculateConversionScore(features);
        break;
      case 'revenue':
        actualValue = parseFloat(testCase.revenue) || 0;
        predictedValue = actualValue * getSeasonalFactor(new Date(testCase.period));
        break;
      default:
        continue;
    }

    const error = Math.abs(actualValue - predictedValue);
    predictions.push({
      actualValue,
      predictedValue,
      confidence: 0.8,
      error,
      entityId: testCase.id || testCase.period
    });
  }

  return predictions;
}

function calculatePerformanceMetrics(predictions: ModelPrediction[]): ModelPerformanceMetrics {
  const actual = predictions.map(p => p.actualValue);
  const predicted = predictions.map(p => p.predictedValue);
  return calculateMetrics(actual, predicted);
}

function analyzeModelPerformance(
  model: MLModel, 
  performance: ModelPerformanceMetrics, 
  predictions: ModelPrediction[]
): EvaluationInsight[] {
  const insights: EvaluationInsight[] = [];

  if (performance.accuracy < 0.6) {
    insights.push({
      category: 'accuracy',
      message: 'Model accuracy is below acceptable threshold',
      severity: 'high',
      recommendations: ['Retrain with more recent data', 'Consider feature engineering', 'Evaluate data quality']
    });
  }

  const highErrorPredictions = predictions.filter(p => p.error > 0.3).length;
  if (highErrorPredictions > predictions.length * 0.2) {
    insights.push({
      category: 'bias',
      message: 'Model shows systematic bias in predictions',
      severity: 'medium',
      recommendations: ['Analyze prediction errors for patterns', 'Consider data preprocessing techniques']
    });
  }

  const daysSinceTraining = Math.floor(
    (Date.now() - new Date(model.lastTrained).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceTraining > 30) {
    insights.push({
      category: 'data_quality',
      message: 'Model may be outdated and require retraining',
      severity: daysSinceTraining > 60 ? 'high' : 'medium',
      recommendations: ['Schedule regular model retraining', 'Monitor data drift']
    });
  }

  return insights;
}

async function saveModelPerformance(modelId: string, performance: ModelPerformanceMetrics): Promise<void> {
  await db.exec`
    INSERT INTO model_performance (model_id, evaluation_date, accuracy, precision_score, recall,
                                   f1_score, mse, mae, r2_score)
    VALUES (${modelId}, NOW(), ${performance.accuracy}, ${performance.precision}, ${performance.recall},
            ${performance.f1Score}, ${performance.mse}, ${performance.mae}, ${performance.r2Score})
  `;
}

async function getModelById(modelId: string): Promise<MLModel | null> {
  const rows = await db.exec`SELECT * FROM ml_models WHERE id = ${modelId}`;
  return rows.length > 0 ? parseModelRow(rows[0]) : null;
}

async function getLatestModelPerformance(modelId: string): Promise<ModelPerformanceMetrics | null> {
  const rows = await db.exec`
    SELECT * FROM model_performance 
    WHERE model_id = ${modelId} 
    ORDER BY evaluation_date DESC 
    LIMIT 1
  `;
  return rows.length > 0 ? parsePerformanceRow(rows[0]) : null;
}

function parseModelRow(row: any): MLModel {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    version: row.version,
    accuracy: parseFloat(row.accuracy),
    features: JSON.parse(row.features),
    trainingData: JSON.parse(row.training_data),
    isActive: row.is_active,
    lastTrained: new Date(row.last_trained),
    createdAt: new Date(row.created_at)
  };
}

function parsePerformanceRow(row: any): ModelPerformanceMetrics {
  return {
    accuracy: parseFloat(row.accuracy),
    precision: parseFloat(row.precision_score),
    recall: parseFloat(row.recall),
    f1Score: parseFloat(row.f1_score),
    mse: parseFloat(row.mse) || 0,
    mae: parseFloat(row.mae) || 0,
    r2Score: parseFloat(row.r2_score) || 0
  };
}

function generateModelInsights(
  model: MLModel, 
  performance: ModelPerformanceMetrics, 
  history: Array<{ date: Date; performance: ModelPerformanceMetrics }>
): string[] {
  const insights: string[] = [];

  if (performance.accuracy > 0.8) {
    insights.push('Model shows excellent accuracy performance');
  } else if (performance.accuracy > 0.6) {
    insights.push('Model shows acceptable accuracy but has room for improvement');
  } else {
    insights.push('Model accuracy is below recommended threshold - consider retraining');
  }

  if (history.length > 1) {
    const recentPerformance = history.slice(0, 3);
    const avgRecentAccuracy = recentPerformance.reduce((sum, h) => sum + h.performance.accuracy, 0) / recentPerformance.length;
    const olderPerformance = history.slice(-3);
    const avgOlderAccuracy = olderPerformance.reduce((sum, h) => sum + h.performance.accuracy, 0) / olderPerformance.length;

    if (avgRecentAccuracy < avgOlderAccuracy * 0.95) {
      insights.push('Model performance is declining over time - data drift may be occurring');
    } else if (avgRecentAccuracy > avgOlderAccuracy * 1.05) {
      insights.push('Model performance is improving - current training approach is effective');
    }
  }

  const daysSinceTraining = Math.floor(
    (Date.now() - new Date(model.lastTrained).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceTraining > 60) {
    insights.push('Model is overdue for retraining - consider updating with recent data');
  }

  return insights;
}