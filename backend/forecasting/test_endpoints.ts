import { api } from "encore.dev/api";

export const testConnection = api(
  { method: "GET", path: "/forecasting/test", expose: true },
  async (): Promise<{ status: string; message: string; timestamp: Date }> => {
    return {
      status: "success",
      message: "Forecasting service is operational",
      timestamp: new Date()
    };
  }
);

export const getFeatures = api(
  { method: "GET", path: "/forecasting/features", expose: true },
  async (): Promise<{ features: string[] }> => {
    return {
      features: [
        "Prospect Conversion Prediction",
        "Revenue Forecasting",
        "Optimal Outreach Timing",
        "Cohort Analysis", 
        "Performance Predictions",
        "ML Model Training",
        "Trend Analysis",
        "Pattern Detection"
      ]
    };
  }
);