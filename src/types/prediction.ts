export interface PredictionFactor {
  label: string; // "Section congestion"
  impactMinutes: number; // contribution to predicted delay
}

export interface Prediction {
  trainId: string;
  predictedEta: string;
  confidence: number; // 0-100
  rangeStart: string;
  rangeEnd: string;
  modelVersion: string;
  factors: PredictionFactor[];
}
