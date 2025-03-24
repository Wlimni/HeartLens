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
        loadedModel.summary(); // Log model structure to verify input shape
      } catch (error) {
        console.error('Error loading model:', error);
      }
    };
    loadModel();
  }, []);

  // Memoize assessSignalQuality
  const assessSignalQuality = useCallback(async (signal: number[]) => {
    if (!modelRef.current || signal.length < 100) return;

    try {
      const features = await calculateFeatures(signal);
      const inputTensor = tf.tensor2d([features], [1, 10]); // Updated to 10 features
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
  }, []);

  // Assess signal quality when ppgData changes
  useEffect(() => {
    if (ppgData.length >= 100) {
      assessSignalQuality(ppgData);
    }
  }, [ppgData, assessSignalQuality]);

  const calculateFeatures = async (signal: number[]): Promise<number[]> => {
    if (!signal.length) return new Array(10).fill(0); // Updated to 10

    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const squaredDiffs = signal.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / signal.length;
    const std = Math.sqrt(variance);
    const cubedDiffs = signal.map((val) => Math.pow(val - mean, 3));
    const skewness = cubedDiffs.reduce((sum, val) => sum + val, 0) / signal.length / Math.pow(std + 1e-7, 3);
    const fourthPowerDiffs = signal.map((val) => Math.pow(val - mean, 4));
    const kurtosis = fourthPowerDiffs.reduce((sum, val) => sum + val, 0) / signal.length / Math.pow(std + 1e-7, 4);
    const max = Math.max(...signal);
    const min = Math.min(...signal);
    const signalRange = max - min;
    let zeroCrossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if ((signal[i] >= 0 && signal[i - 1] < 0) || (signal[i] < 0 && signal[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const squaredSum = signal.reduce((sum, val) => sum + val * val, 0);
    const rms = Math.sqrt(squaredSum / signal.length);
    const snr = mean / (std + 1e-7);
    // Added features
    const peakCount = signal.filter((val, i) => i > 0 && i < signal.length - 1 && val > signal[i - 1] && val > signal[i + 1]).length;
    const mad = signal.reduce((sum, val) => sum + Math.abs(val - mean), 0) / signal.length;

    return [
      mean,
      std,
      skewness,
      kurtosis,
      signalRange,
      zeroCrossings,
      rms,
      snr,
      peakCount,
      mad,
    ];
  };

  return { signalQuality, qualityConfidence };
}