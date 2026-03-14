export interface ATSCalibrationConfig {
  version: string
  resumeQuality: { slope: number; intercept: number }
  targetRole: { slope: number; intercept: number }
  overall: { slope: number; intercept: number }
}

export const DEFAULT_ATS_CALIBRATION: ATSCalibrationConfig = {
  version: "2026-03-14",
  resumeQuality: { slope: 1, intercept: 0 },
  targetRole: { slope: 1, intercept: 0 },
  overall: { slope: 1, intercept: 0 },
}

export interface CalibrationSample {
  predictedResumeQuality: number
  predictedTargetRole: number
  predictedOverall: number
  observedOutcome: number
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function applyCalibration(
  value: number,
  coeffs: { slope: number; intercept: number }
) {
  return clampScore(value * coeffs.slope + coeffs.intercept)
}

export function applyAtsCalibration(
  scores: {
    resumeQuality: number
    targetRole: number | null
    overall: number
  },
  config: ATSCalibrationConfig = DEFAULT_ATS_CALIBRATION
) {
  return {
    resumeQuality: applyCalibration(scores.resumeQuality, config.resumeQuality),
    targetRole:
      scores.targetRole === null
        ? null
        : applyCalibration(scores.targetRole, config.targetRole),
    overall: applyCalibration(scores.overall, config.overall),
  }
}

export function trainSimpleCalibration(samples: CalibrationSample[]) {
  if (samples.length === 0) return DEFAULT_ATS_CALIBRATION

  // Lightweight least-squares fit for overall only; others default to identity.
  const x = samples.map((sample) => sample.predictedOverall)
  const y = samples.map((sample) => sample.observedOutcome)
  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length
  const numerator = x.reduce(
    (sum, value, index) => sum + (value - xMean) * ((y[index] || 0) - yMean),
    0
  )
  const denominator = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0)
  const slope = denominator > 0 ? numerator / denominator : 1
  const intercept = yMean - slope * xMean

  return {
    ...DEFAULT_ATS_CALIBRATION,
    overall: {
      slope: Number(slope.toFixed(4)),
      intercept: Number(intercept.toFixed(4)),
    },
  } satisfies ATSCalibrationConfig
}
