"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import CameraFeed from "./components/CameraFeed";
import ChartComponent from "./components/ChartComponent";
import MetricsCard from "./components/MetricsCard";
import SignalCombinationSelector from "./components/SignalCombinationSelector";
import usePPGProcessing from "./hooks/usePPGProcessing";
import useSignalQuality from "./hooks/useSignalQuality";
import useMongoDB from "./hooks/useMongoDB";
import Image from "next/image";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [signalCombination, setSignalCombination] = useState("default");
  const [currentSubject, setCurrentSubject] = useState("");
  const [confirmedSubject, setConfirmedSubject] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const {
    historicalData,
    loading,
    error,
    fetchHistoricalData,
    pushDataToMongo,
  } = useMongoDB(confirmedSubject);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    ppgData,
    valleys,
    heartRate,
    hrv,
    processFrame,
    startCamera,
    stopCamera,
  } = usePPGProcessing(isRecording, signalCombination, videoRef, canvasRef);

  const { signalQuality, qualityConfidence } = useSignalQuality(ppgData);

  // Single useEffect for camera and rendering
  useEffect(() => {
    let animationFrameId: number | undefined;

    const renderLoop = () => {
      processFrame(); // Relies on requestAnimationFrame sync
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    if (isRecording) {
      startCamera()
        .then(() => {
          animationFrameId = requestAnimationFrame(renderLoop);
        })
        .catch((err) => {
          console.error("Failed to start camera:", err);
          setIsRecording(false);
        });
    }

    return () => {
      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId);
      }
      stopCamera();
    };
  }, [isRecording, processFrame, startCamera, stopCamera]);

  const handlePushData = useCallback(async () => {
    // Require confirmedSubject only for saving data
    if (!confirmedSubject) {
      alert("Please confirm a Subject ID to save data.");
      return;
    }
    if (ppgData.length === 0) return;
    const recordData = {
      subjectId: confirmedSubject,
      heartRate: {
        bpm: isNaN(heartRate.bpm) ? 0 : heartRate.bpm,
        confidence: heartRate.confidence || 0,
      },
      hrv: {
        sdnn: isNaN(hrv.sdnn) ? 0 : hrv.sdnn,
        confidence: hrv.confidence || 0,
      },
      ppgData: ppgData,
      timestamp: new Date(),
    };
    try {
      await pushDataToMongo(recordData);
      console.log("✅ Data successfully saved to MongoDB");
    } catch (error: unknown) {
      console.error(
        "❌ Failed to save data:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [confirmedSubject, heartRate, hrv, ppgData, pushDataToMongo]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isSampling && ppgData.length > 0 && confirmedSubject) {
      intervalId = setInterval(() => handlePushData(), 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSampling, ppgData, confirmedSubject, handlePushData]);

  const confirmUser = () => {
    if (currentSubject.trim()) {
      setConfirmedSubject(currentSubject.trim());
    } else {
      alert("Please enter a valid Subject ID.");
    }
  };

  const handleStartRecording = () => {
    setIsRecording(!isRecording);
  };

  const handleStartSampling = () => {
    if (!isRecording || ppgData.length === 0) return;
    setIsSampling(!isSampling);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-100"
      }`}
    >
      {/* Header */}
      <header className="col-span-full flex items-center justify-between mb-6">
        <div className="flex-1"></div>
        <div className="flex items-center">
          <Image
            src="/favicon.ico"
            alt="HeartLens Icon"
            width={48}
            height={48}
            className="mr-3"
          />
          <h1
            className={`text-4xl lg:text-5xl xl:text-6xl font-bold ${
              isDarkMode ? "text-cyan-400" : "text-cyan-500"
            }`}
          >
            HeartLens
          </h1>
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={toggleDarkMode}
            className="bg-yellow-500 text-black px-3 py-1 rounded-md focus:ring-2 focus:ring-cyan-500"
          >
            Change Light/Dark Mode
          </button>
        </div>
      </header>

      {/* User Panel (Moved to Top) */}
      <div
        className={`col-span-full rounded-lg p-4 ${
          isDarkMode ? "bg-gray-700" : "bg-gray-200"
        }`}
      >
        <h2
          className={`text-lg lg:text-xl xl:text-2xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}
        >
          User Panel
        </h2>
        <input
          type="text"
          value={currentSubject}
          onChange={(e) => setCurrentSubject(e.target.value)}
          placeholder="Enter Subject ID (Optional)"
          className={`w-full p-2 rounded-md border focus:ring-2 focus:ring-cyan-500 ${
            isDarkMode
              ? "border-gray-600 bg-gray-600 text-white"
              : "border-gray-300 bg-white text-black"
          } mb-2`}
        />
        <button
          onClick={confirmUser}
          className={`bg-blue-500 text-white px-4 py-2 rounded-md mr-2 focus:ring-2 focus:ring-cyan-500 ${
            isDarkMode ? "bg-blue-500" : "bg-blue-400"
          }`}
        >
          Confirm User
        </button>
        {confirmedSubject && (
          <button
            onClick={fetchHistoricalData}
            className={`bg-blue-500 text-white px-4 py-2 rounded-md mr-2 focus:ring-2 focus:ring-cyan-500 ${
              isDarkMode ? "bg-blue-500" : "bg-blue-400"
            }`}
          >
            Fetch Historical Data
          </button>
        )}
        {loading && (
          <p
            className={`mt-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Loading historical data...
          </p>
        )}
        {error && (
          <p
            className={`mt-2 ${isDarkMode ? "text-red-500" : "text-red-600"}`}
          >
            Error: {error}
          </p>
        )}
        {confirmedSubject && historicalData && historicalData.lastAccess && (
          <div
            className={`mt-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}
          >
            <p>User: {confirmedSubject}</p>
            <p>
              Last Access:{" "}
              {new Date(historicalData.lastAccess).toLocaleString()}
            </p>
            <p>Avg Heart Rate: {historicalData.avgHeartRate} BPM</p>
            <p>Avg HRV: {historicalData.avgHRV} ms</p>
          </div>
        )}
      </div>

      {/* Camera Feed */}
      <div
        className={`rounded-lg p-4 ${
          isDarkMode ? "bg-gray-700" : "bg-gray-200"
        }`}
      >
        <div className="flex items-center mb-2">
          <h2
            className={`text-lg lg:text-xl xl:text-2xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Camera Feed
          </h2>
          <span
            className={`ml-2 w-3 h-3 rounded-full ${
              isRecording
                ? "bg-red-500 animate-pulse"
                : isDarkMode
                ? "bg-gray-600"
                : "bg-gray-400"
            }`}
          ></span>
        </div>
        <CameraFeed videoRef={videoRef} canvasRef={canvasRef} />
        <div className="mt-2 flex items-center">
          <div className="flex gap-2">
            <button
              onClick={handleStartRecording}
              className={`bg-cyan-500 text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-cyan-500 ${
                isDarkMode ? "bg-cyan-500" : "bg-cyan-400"
              }`}
            >
              {isRecording ? "Stop" : "Start"} Recording
            </button>
            <div className="relative">
              <button
                onClick={handleStartSampling}
                className={`bg-gray-500 text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-cyan-500 ${
                  isSampling ? "ring-2 ring-green-500 animate-pulse" : ""
                } ${isDarkMode ? "bg-gray-500" : "bg-gray-400"}`}
                disabled={!isRecording || ppgData.length === 0}
              >
                {isSampling ? "Stop" : "Start"} Sampling
              </button>
            </div>
          </div>
          <button
            onClick={handlePushData}
            className={`bg-green-500 text-white px-4 py-2 rounded-md ml-auto focus:ring-2 focus:ring-cyan-500 ${
              isDarkMode ? "bg-green-500" : "bg-green-400"
            }`}
            disabled={ppgData.length === 0}
          >
            Save Data
          </button>
        </div>
        <button
          onClick={() => setShowConfig((prev) => !prev)}
          className={`mt-2 w-full px-4 py-2 rounded-md text-white focus:ring-2 focus:ring-cyan-500 ${
            isDarkMode ? "bg-cyan-500" : "bg-cyan-400"
          }`}
        >
          Toggle Config
        </button>
        {showConfig && (
          <SignalCombinationSelector
            signalCombination={signalCombination}
            setSignalCombination={setSignalCombination}
          />
        )}
      </div>

      {/* Right Column */}
      <div className="grid grid-cols-1 gap-4">
        <div
          className={`rounded-lg p-4 ${
            isDarkMode ? "bg-gray-700" : "bg-gray-200"
          }`}
        >
          <h2
            className={`text-lg lg:text-xl xl:text-2xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            PPG Signal Chart
          </h2>
          <ChartComponent ppgData={ppgData} valleys={valleys} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricsCard
            title="HEART RATE"
            value={heartRate || { bpm: "--", confidence: 0 }}
            confidence={heartRate?.confidence || 0}
            className={
              isDarkMode ? "bg-blue-500 text-white" : "bg-blue-400 text-black"
            }
          />
          <MetricsCard
            title="HRV"
            value={hrv || { sdnn: "--", confidence: 0 }}
            confidence={hrv?.confidence || 0}
            className={
              isDarkMode ? "bg-green-500 text-white" : "bg-green-400 text-black"
            }
          />
          <MetricsCard
            title="SIGNAL QUALITY"
            value={signalQuality || "--"}
            confidence={qualityConfidence || 0}
            className={
              isDarkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-black"
            }
          />
        </div>
      </div>
    </div>
  );
}
