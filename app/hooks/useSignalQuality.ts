// hooks/useSignalQuality.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';

interface SignalQualityResults {
  signalQuality: string;
  qualityConfidence: number;
}

export default function useSignalQuality(
  ppgData: number[]
): SignalQualityResults {
  const modelRef = useRef<tf.LayersModel | null>(null);
  const [signalQuality, setSignalQuality] = useState<string>('--');
  const [qualityConfidence, setQualityConfidence] = useState<number>(0);

  // Load TensorFlow.js model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await tf.loadLayersModel('/model/model.json');
        modelRef.current = loadedModel;
        console.log('PPG quality assessment model loaded successfully');
      } catch (error) {
        console.error('Error loading model:', error);
      }
    };

    loadModel();
  }, []); // No dependencies, runs once on mount

  // Memoize assessSignalQuality to keep it stable across renders
  const assessSignalQuality = useCallback(async (signal: number[]) => {
    if (!modelRef.current || signal.length < 100) return;

    try {
      const features = await calculateFeatures(signal);
      const inputTensor = tf.tensor2d([features], [1, 8]); // 8 features for the older model
      const prediction = (await modelRef.current.predict(inputTensor)) as tf.Tensor;
      const probabilities = await prediction.data();

      const classIndex = probabilities.indexOf(Math.max(...probabilities));
      const classes = ['bad', 'acceptable', 'excellent'];
      const predictedClass = classes[classIndex];
      const confidence = probabilities[classIndex] * 100;

      setSignalQuality(predictedClass);
      setQualityConfidence(confidence);

      inputTensor.dispose();
      prediction.dispose();
    } catch (error) {
      console.error('Error assessing signal quality:', error);
    }
  }, []); // Empty dependency array since it only depends on modelRef, which is stable via useRef

  // Assess signal quality when ppgData changes
  useEffect(() => {
    if (ppgData.length >= 100) {
      assessSignalQuality(ppgData);
    }
  }, [ppgData, assessSignalQuality]); // Added assessSignalQuality

  const calculateFeatures = async (signal: number[]): Promise<number[]> => {
    if (!signal.length) return new Array(8).fill(0);

    // Calculate mean
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;

    // Calculate standard deviation
    const squaredDiffs = signal.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / signal.length;
    const std = Math.sqrt(variance);

    // Calculate skewness
    const cubedDiffs = signal.map((val) => Math.pow(val - mean, 3));
    const skewness =
      cubedDiffs.reduce((sum, val) => sum + val, 0) /
      signal.length /
      Math.pow(std + 1e-7, 3);

    // Calculate kurtosis
    const fourthPowerDiffs = signal.map((val) => Math.pow(val - mean, 4));
    const kurtosis =
      fourthPowerDiffs.reduce((sum, val) => sum + val, 0) /
      signal.length /
      Math.pow(std + 1e-7, 4);

    // Calculate signal range
    const max = Math.max(...signal);
    const min = Math.min(...signal);
    const signalRange = max - min;

    // Calculate zero crossings
    let zeroCrossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if (
        (signal[i] >= 0 && signal[i - 1] < 0) ||
        (signal[i] < 0 && signal[i - 1] >= 0)
      ) {
        zeroCrossings++;
      }
    }

    // Calculate RMS
    const squaredSum = signal.reduce((sum, val) => sum + val * val, 0);
    const rms = Math.sqrt(squaredSum / signal.length);

    // Calculate SNR (signal-to-noise ratio)
    const snr = mean / (std + 1e-7);

    return [
      mean,
      std,
      skewness,
      kurtosis,
      signalRange,
      zeroCrossings,
      rms,
      snr,
    ];
  };

  return { signalQuality, qualityConfidence };
}