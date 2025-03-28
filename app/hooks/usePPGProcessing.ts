import { useState, useRef, useCallback } from 'react';
import useSignalQuality from './useSignalQuality';

interface Valley {
  timestamp: Date;
  value: number;
  index: number;
}

interface HRVResult {
  sdnn: number;
  confidence: number;
}

interface HeartRateResult {
  bpm: number;
  confidence: number;
}

interface PPGProcessingResult {
  ppgData: number[];
  valleys: Valley[];
  heartRate: HeartRateResult;
  hrv: HRVResult;
  processFrame: () => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

export default function usePPGProcessing(
  isRecording: boolean,
  signalCombination: string,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): PPGProcessingResult {
  const [ppgData, setPpgData] = useState<number[]>([]);
  const [valleys, setValleys] = useState<Valley[]>([]);
  const [heartRate, setHeartRate] = useState<HeartRateResult>({ bpm: 0, confidence: 0 });
  const [hrv, setHRV] = useState<HRVResult>({ sdnn: 0, confidence: 0 });

  const streamRef = useRef<MediaStream | null>(null);
  const fpsRef = useRef<number>(30);
  const frameTimeRef = useRef<number>(0);
  const framesRef = useRef<number>(0);
  const isVideoReady = useRef<boolean>(false);

  // Use the signal quality hook to assess PPG signal quality
  const { signalQuality } = useSignalQuality(ppgData);

  const samplePoints = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.5, y: 0.5 },
    { x: 0.2, y: 0.8 },
    { x: 0.8, y: 0.8 },
  ];

  const startCamera = useCallback(async (): Promise<void> => {
    try {
      if (streamRef.current) {
        console.log('Stopping existing stream before starting a new one');
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!window.isSecureContext) {
        throw new Error('Camera access requires HTTPS');
      }

      console.log('Requesting camera access...');
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, playing video...');
          videoRef.current?.play().then(() => {
            if (canvasRef.current) {
              canvasRef.current.width = videoRef.current!.videoWidth;
              canvasRef.current.height = videoRef.current!.videoHeight;
              console.log('Canvas dimensions set:', canvasRef.current.width, 'x', canvasRef.current.height);
            }
            isVideoReady.current = true;
            console.log('Video is ready to play');
          }).catch((err) => {
            console.error('Error playing video:', err);
          });
        };
      }

      streamRef.current = newStream;

      try {
        const track = newStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        if (capabilities?.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] } as any);
          console.log('Torch enabled');
        } else {
          console.log('Torch not supported on this device');
        }
      } catch (torchError) {
        console.log('Torch not available:', torchError);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      throw err;
    }
  }, [videoRef, canvasRef]);

  const stopCamera = useCallback(() => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isVideoReady.current = false;
    console.log('Camera stopped');
  }, [videoRef]);

  const measureFPS = () => {
    const now = performance.now();
    const elapsed = now - frameTimeRef.current;
    if (elapsed >= 1000) {
      const currentFps = Math.round((framesRef.current * 1000) / elapsed);
      fpsRef.current = currentFps;
      framesRef.current = 0;
      frameTimeRef.current = now;
      console.log('FPS:', currentFps);
    }
    framesRef.current++;
  };

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isRecording || !isVideoReady.current) {
      console.log('Skipping frame: Not recording, refs not ready, or video not ready');
      return;
    }

    measureFPS();

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      console.log('Skipping frame: Canvas context not available');
      return;
    }

    try {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      console.log('Frame drawn on canvas');

      let rSum = 0, gSum = 0, bSum = 0;
      let validSamples = 0;

      samplePoints.forEach((point) => {
        const x = Math.floor(point.x * canvas.width);
        const y = Math.floor(point.y * canvas.height);
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          const pixel = context.getImageData(x, y, 1, 1).data;
          rSum += pixel[0];
          gSum += pixel[1];
          bSum += pixel[2];
          validSamples++;

          context.beginPath();
          context.arc(x, y, 5, 0, 2 * Math.PI);
          context.fillStyle = 'yellow';
          context.fill();
        }
      });

      if (validSamples === 0) {
        console.log('No valid samples found');
        return;
      }

      let ppgSignal = 0;
      switch (signalCombination) {
        case 'redOnly': ppgSignal = rSum / validSamples; break;
        case 'greenOnly': ppgSignal = gSum / validSamples; break;
        case 'blueOnly': ppgSignal = bSum / validSamples; break;
        case 'redMinusBlue': ppgSignal = (rSum - bSum) / validSamples; break;
        case 'custom': ppgSignal = (3 * rSum - bSum - gSum) / validSamples; break;
        default: ppgSignal = (2 * rSum - gSum - bSum) / validSamples;
      }

      setPpgData((prev) => {
        const newData = [...prev.slice(-300), ppgSignal];
        // Only calculate HR and HRV if signal quality is not "bad" and we have enough data
        if (newData.length >= 100 && signalQuality !== 'bad') {
          const newValleys = detectValleys(newData);
          setValleys(newValleys);
          const heartRateValue = calculateHeartRate(newValleys);
          setHeartRate(heartRateValue);
          const hrvValues = calculateHRV(newValleys);
          setHRV(hrvValues);
        }
        return newData;
      });
    } catch (err) {
      console.error('Error in processFrame:', err);
    }
  }, [isRecording, videoRef, canvasRef, signalCombination, signalQuality]);

  const smoothSignal = (signal: number[], windowSize: number = 5): number[] => {
    return signal.map((_, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const window = signal.slice(start, i + 1);
      return window.reduce((sum, val) => sum + val, 0) / window.length;
    });
  };

  const detectValleys = (signal: number[], providedFps: number = 30): Valley[] => {
    const valleys: Valley[] = [];
    const minValleyDistance = Math.floor(providedFps * 0.4); // Minimum 400 ms between valleys
    const windowSize = Math.floor(providedFps * 0.5);

    // Smooth the signal to reduce noise
    const smoothedSignal = smoothSignal(signal, 5);
    console.log('Smoothed Signal (first 20):', smoothedSignal.slice(0, 20)); // Debug: Log first 20 values

    // Calculate mean and std for threshold
    const meanSignal = smoothedSignal.reduce((sum, val) => sum + val, 0) / smoothedSignal.length;
    const stdSignal = Math.sqrt(
      smoothedSignal.reduce((sum, val) => sum + Math.pow(val - meanSignal, 2), 0) / smoothedSignal.length
    );
    const threshold = meanSignal - stdSignal; // Valleys must be below mean - 1 STD

    for (let i = windowSize; i < smoothedSignal.length - windowSize; i++) {
      if (
        smoothedSignal[i] < smoothedSignal[i - 1] &&
        smoothedSignal[i] < smoothedSignal[i + 1] &&
        smoothedSignal[i] < threshold
      ) {
        if (valleys.length === 0 || i - valleys[valleys.length - 1].index >= minValleyDistance) {
          valleys.push({
            timestamp: new Date(Date.now() - ((signal.length - i) / providedFps) * 1000),
            value: signal[i],
            index: i,
          });
        }
      }
    }
    console.log('Detected Valleys:', valleys); // Debug: Log detected valleys
    return valleys;
  };

  const calculateHeartRate = (valleys: Valley[]): HeartRateResult => {
    if (valleys.length < 2) return { bpm: 0, confidence: 0 };
    const intervals = valleys.slice(1).map((_, i) => (valleys[i + 1].timestamp.getTime() - valleys[i].timestamp.getTime()) / 1000);
    const validIntervals = intervals.filter(interval => interval >= 0.4 && interval <= 2.0);
    if (validIntervals.length === 0) return { bpm: 0, confidence: 0 };
    const sortedIntervals = [...validIntervals].sort((a, b) => a - b);
    const median = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    const mean = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const variance = validIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validIntervals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / mean) * 100;
    const confidence = Math.max(0, Math.min(100, 100 - coefficientOfVariation));
    const bpm = Math.round(60 / median);
    return { bpm, confidence };
  };

  const calculateHRV = (valleys: Valley[]): HRVResult => {
    if (valleys.length < 2) return { sdnn: 0, confidence: 0 };
    const rrIntervals = valleys.slice(1).map((_, i) => valleys[i + 1].timestamp.getTime() - valleys[i].timestamp.getTime());
    console.log('RR Intervals (ms):', rrIntervals); // Debug: Log RR intervals
    const validIntervals = rrIntervals.filter(interval => interval >= 250 && interval <= 2000);
    console.log('Valid RR Intervals (ms):', validIntervals); // Debug: Log filtered intervals
    if (validIntervals.length === 0) return { sdnn: 0, confidence: 0 };
    const meanRR = validIntervals.reduce((sum, rr) => sum + rr, 0) / validIntervals.length;
    const squaredDifferences = validIntervals.map((rr) => Math.pow(rr - meanRR, 2));
    const sdnn = Math.sqrt(squaredDifferences.reduce((sum, diff) => sum + diff, 0) / (validIntervals.length - 1));
    const intervalConfidence = Math.min(100, (validIntervals.length / 5) * 100);
    const cv = (sdnn / meanRR) * 100;
    const consistencyConfidence = Math.max(0, 100 - cv);
    const confidence = Math.min(100, (intervalConfidence + consistencyConfidence) / 2);
    return { sdnn: Math.round(sdnn), confidence: Math.round(confidence) };
  };

  return {
    ppgData,
    valleys,
    heartRate,
    hrv,
    processFrame,
    startCamera,
    stopCamera,
  };
}
