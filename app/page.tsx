"use client";
import { useState, useRef, useEffect } from "react";
import CameraFeed from "./components/CameraFeed";
import ChartComponent from "./components/ChartComponent";
import usePPGProcessing from "./hooks/usePPGProcessing";
import useSignalQuality from "./hooks/useSignalQuality";
import useMongoDB from "./hooks/useMongoDB";
import Image from "next/image"; // For the favicon

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [signalCombination, setSignalCombination] = useState("default");
  const [currentSubject, setCurrentSubject] = useState("");
  const [confirmedSubject, setConfirmedSubject] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  const { historicalData, loading, error, fetchHistoricalData, pushDataToMongo } = useMongoDB(confirmedSubject);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const { ppgData, valleys, heartRate, hrv, processFrame, startCamera, stopCamera } =
    usePPGProcessing(isRecording, signalCombination, videoRef, canvasRef);

  const { signalQuality, qualityConfidence } = useSignalQuality(ppgData);

  useEffect(() => {
    if (isRecording) startCamera();
    else stopCamera();
  }, [isRecording]);

  useEffect(() => {
    let animationFrame;
    const processFrameLoop = () => {
      if (isRecording) {
        processFrame();
        animationFrame = requestAnimationFrame(processFrameLoop);
      }
    };
    if (isRecording) processFrameLoop();
    return () => cancelAnimationFrame(animationFrame);
  }, [isRecording]);

  useEffect(() => {
    let intervalId = null;
    if (isSampling && ppgData.length > 0 && confirmedSubject) {
      intervalId = setInterval(() => handlePushData(), 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSampling, ppgData, confirmedSubject]);

  const confirmUser = () => {
    if (currentSubject.trim()) {
      setConfirmedSubject(currentSubject.trim());
    } else {
      alert("Please enter a valid Subject ID.");
    }
  };

  const handleStartRecording = () => {
    if (!confirmedSubject) {
      alert("Please enter a subject name before recording.");
      return;
    }
    setIsRecording(!isRecording);
  };

  const handleStartSampling = () => {
    if (!confirmedSubject) {
      alert("Please enter a subject name before sampling.");
      return;
    }
    if (!isRecording || ppgData.length === 0) return;
    setIsSampling(!isSampling);
  };

  const handlePushData = async () => {
    if (!confirmedSubject) {
      alert("Please enter a subject name before saving data.");
      return;
    }
    if (ppgData.length === 0) return;
    const recordData = {
      subjectId: confirmedSubject || 'unknown',
      heartRate: {
        bpm: isNaN(heartRate.bpm) ? 0 : heartRate.bpm,
        confidence: hrv.confidence || 0,
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
    } catch (error) {
      console.error("❌ Failed to save data:", error.message);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
      {/* Header with Centered HeartLens and Dark Mode Toggle */}
      <header className="col-span-full flex items-center justify-between mb-6">
        <div className="flex-1"></div> {/* Spacer */}
        <div className="flex items-center">
          <Image src="/favicon.ico" alt="HeartLens Icon" width={48} height={48} className="mr-3" />
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
            className="bg-gray-500 text-white px-3 py-1 rounded-md focus:ring-2 focus:ring-cyan-500"
          >
            Change Light/Dark Mode
          </button>
        </div>
      </header>

      {/* Left Column: Camera Feed */}
      <div className={`rounded-lg p-4 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}>
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
              isRecording ? "bg-red-500 animate-pulse" : isDarkMode ? "bg-gray-600" : "bg-gray-400"
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
      </div>

      {/* Right Column: Chart, Metrics, User Panel */}
      <div className="grid grid-cols-1 gap-4">
        {/* Chart Component */}
        <div className={`rounded-lg p-4 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}>
          <h2
            className={`text-lg lg:text-xl xl:text-2xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            PPG Signal Chart
          </h2>
          <ChartComponent ppgData={ppgData} valleys={valleys} />
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className={`rounded-lg p-4 text-white ${
              isDarkMode ? "bg-cyan-500" : "bg-cyan-400"
            }`}
          >
            <h3 className="font-bold text-base lg:text-lg">Heart Rate</h3>
            <p className="text-lg lg:text-xl">{heartRate.bpm || "--"} BPM</p>
          </div>
          <div
            className={`rounded-lg p-4 text-white ${
              isDarkMode ? "bg-green-500" : "bg-green-400"
            }`}
          >
            <h3 className="font-bold text-base lg:text-lg">HRV</h3>
            <p className="text-lg lg:text-xl">{hrv.sdnn || "--"} ms</p>
          </div>
        </div>

        {/* User Panel */}
        <div className={`rounded-lg p-4 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}>
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
            placeholder="Enter Subject ID"
            className={`w-full p-2 rounded-md border focus:ring-2 focus:ring-cyan-500 ${
              isDarkMode ? "border-gray-600 bg-gray-600 text-white" : "border-gray-300 bg-white text-black"
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
            <p className={`mt-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Loading historical data...
            </p>
          )}
          {error && (
            <p className={`mt-2 ${isDarkMode ? "text-red-500" : "text-red-600"}`}>
              Error: {error}
            </p>
          )}
          {confirmedSubject && historicalData && historicalData.lastAccess && (
            <div className={`mt-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              <p>Last Access: {new Date(historicalData.lastAccess).toLocaleString()}</p>
              <p>Avg Heart Rate: {historicalData.avgHeartRate} BPM</p>
              <p>Avg HRV: {historicalData.avgHRV} ms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}