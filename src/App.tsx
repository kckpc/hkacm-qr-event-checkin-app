import React, { useState, useEffect, useCallback, useRef } from 'react';
import QrScanner from 'react-qr-scanner';
import axios from 'axios';
import { saveAs } from 'file-saver';
import './App.css';

interface Participant {
  id: string;
  name: string;
  ename: string;
  voice: string;
  isValid: boolean;
  checkIns: string[];
  signedToday: boolean;
}

//test new commit
// Add this interface for the participants list
interface ParticipantsList {
  [key: string]: Participant;
}

// Define a constant for the base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || `https://${window.location.hostname}:3001/api`;
// Add this interface for scan entries
interface ScanEntry {
  id: string;
  time: string;
  name: string;
  status: string;
}

function formatToHKTime(date: Date): string {
  return date.toLocaleString('en-US', { 
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

const loadSounds = async () => {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const loadSound = async (url: string) => {
      console.log(`Attempting to load sound from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return await context.decodeAudioData(arrayBuffer);
    };

    const [success, error] = await Promise.all([
      loadSound('/sounds/success.mp3'),
      loadSound('/sounds/error.mp3')
    ]);

    return { context, success, error };
  } catch (error) {
    console.error('Error loading sounds:', error);
    throw error;
  }
};

const useAudio = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [successAudio, setSuccessAudio] = useState<AudioBuffer | null>(null);
  const [errorAudio, setErrorAudio] = useState<AudioBuffer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadSounds().then(({ context, success, error }) => {
      setAudioContext(context);
      setSuccessAudio(success);
      setErrorAudio(error);
      setIsLoaded(true);
    }).catch(err => {
      console.error('Failed to load sounds:', err);
    });
  }, []);

  const playSound = useCallback((type: 'success' | 'error') => {
    if (!audioContext || !successAudio || !errorAudio) {
      console.error('Audio not initialized');
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = type === 'success' ? successAudio : errorAudio;
    source.connect(audioContext.destination);
    source.start(0);
  }, [audioContext, successAudio, errorAudio]);

  return { playSound, isLoaded };
};

// Near the top of your file, after imports
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // For development only! Remove this in production.
  ...(process.env.NODE_ENV === 'development' && {
    httpsAgent: {
      rejectUnauthorized: false
    }
  })
});

function App() {
  const [manualEntry, setManualEntry] = useState('');
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [modeSwitchPassword, setModeSwitchPassword] = useState('');
  const [currentActivityName, setCurrentActivityName] = useState('HKACM');
  const [pendingActivityName, setPendingActivityName] = useState('HKACM');
  const [dailyCheckInCount, setDailyCheckInCount] = useState(0);
  const [lastCheckInStatus, setLastCheckInStatus] = useState('');
  const [totalPeople, setTotalPeople] = useState(0);

  // Add this state variable for storing all participants
  const [participants, setParticipants] = useState<ParticipantsList>({});

  // Dynamically construct the API URL based on the current hostname
  const API_URL = API_BASE_URL;

  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isCameraAuthorized, setIsCameraAuthorized] = useState(false);

  // Add this constant for the unchangeable system name
  const SYSTEM_NAME = 'HKACM 二維碼簽到系統';

  // Add these new refs for the audio elements
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  // Update these state variables to include loading status
  const [successAudio, setSuccessAudio] = useState<AudioBuffer | null>(null);
  const [errorAudio, setErrorAudio] = useState<AudioBuffer | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [soundsLoaded, setSoundsLoaded] = useState(false);

  const [lastSoundPlayed, setLastSoundPlayed] = useState<string | null>(null);

  // Add this state to keep track of sound play attempts
  const [soundPlayAttempts, setSoundPlayAttempts] = useState<string[]>([]);

  // Add new state for participant list authentication
  const [isParticipantListAuthenticated, setIsParticipantListAuthenticated] = useState(false);
  const [participantListPassword, setParticipantListPassword] = useState('');

  // Add this state for scan entries
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([]);

  // Add this new state for the last played sound
  const [lastPlayedSound, setLastPlayedSound] = useState<string | null>(null);

  // Add this state variable at the top of your component
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const [showClearCheckInConfirmation, setShowClearCheckInConfirmation] = useState(false);

  // Add this to your state declarations
  const [isClearingCheckIns, setIsClearingCheckIns] = useState(false);

  // Add these new state variables
  const [isScanListAuthenticated, setIsScanListAuthenticated] = useState(false);
  const [scanListPassword, setScanListPassword] = useState('');

  const [activeTab, setActiveTab] = useState<'participants' | 'scanRecords' | 'admin'>('participants');

  const [volume, setVolume] = useState(1); // 1 is max volume, 0 is muted

  const [audioContextInitialized, setAudioContextInitialized] = useState(false);

  const { playSound, isLoaded: isSoundLoaded } = useAudio();

  const getCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('mediaDevices API or enumerateDevices is not supported in this browser.');
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error: unknown) {
      console.error('Error getting cameras:', error);
      if (error instanceof Error) {
        setError('無法獲取攝像頭列表: ' + error.message);
      } else {
        setError('無法獲取攝像頭列表: 未知錯誤');
      }
    }
  }, [selectedCamera]);


  useEffect(() => {
    getCameras();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', getCameras);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', getCameras);
      };
    }
  }, [getCameras]);


  const handleCameraChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCameraId = event.target.value;
    setSelectedCamera(newCameraId);
    setScanning(false); // Stop scanning when changing camera
    // Optionally, you can restart scanning after a short delay
    // setTimeout(() => setScanning(true), 1000);
  };


  const fetchParticipants = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/participants`);
      const participantsData: ParticipantsList = {};
      response.data.forEach((p: Participant) => {
        participantsData[p.id] = p;
      });
      
      // Sort participants by their latest check-in
      const sortedParticipants = Object.values(participantsData).sort((a, b) => {
        const aLatest = a.checkIns && a.checkIns.length > 0 ? new Date(a.checkIns[0]).getTime() : 0;
        const bLatest = b.checkIns && b.checkIns.length > 0 ? new Date(b.checkIns[0]).getTime() : 0;
        return bLatest - aLatest; // Sort in descending order (latest first)
      });


      const sortedParticipantsObj: ParticipantsList = {};
      sortedParticipants.forEach(p => {
        sortedParticipantsObj[p.id] = p;
      });

      setParticipants(sortedParticipantsObj);
      setError(null);
    } catch (err: unknown) {
      setError('無法獲取參與者資料。請稍後再試。');
      console.error('Error fetching participants:', err);
    }
  };

  const fetchParticipantsOnLogin = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/participants`);
      const participantsData: ParticipantsList = {};
      response.data.forEach((p: Participant) => {
        participantsData[p.id] = p;
      });
      
      // Sort participants by their latest check-in
      const sortedParticipants = Object.values(participantsData).sort((a, b) => {
        const aLatest = a.checkIns && a.checkIns.length > 0 ? new Date(a.checkIns[0]).getTime() : 0;
        const bLatest = b.checkIns && b.checkIns.length > 0 ? new Date(b.checkIns[0]).getTime() : 0;
        return bLatest - aLatest; // Sort in descending order (latest first)
      });

      const sortedParticipantsObj: ParticipantsList = {};
      sortedParticipants.forEach(p => {
        sortedParticipantsObj[p.id] = p;
      });

      setParticipants(sortedParticipantsObj);
      setTotalPeople(Object.keys(sortedParticipantsObj).length); // Update total people count
      setError(null);
    } catch (err: unknown) {
      setError('無法獲取參與者資料。請稍後再試。');
      console.error('Error fetching participants:', err);
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manualEntry.trim()) {
      await checkParticipant(manualEntry);
      setManualEntry('');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setManualEntry(event.target.value);
  };

  useEffect(() => {
    return () => {
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioContext]);

  const checkParticipant = useCallback(async (id: string) => {
    console.log('Checking participant with ID:', id);
    setIsLoading(true);
    try {
      const checkInTime = new Date().toISOString();
      console.log('Sending check-in request to server...');
      const response = await axiosInstance.post(`${API_URL}/check-in`, {
        qrData: id,
        checkInTime: checkInTime,
        isDemoMode: isDemoMode,
        activityName: currentActivityName
      });
      
      console.log('Server response:', response.data);
      if (response.data.participant) {
        const participantData: Participant = {
          ...response.data.participant,
          id: id,
          signedToday: false
        };

        // Calculate if signed today
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        participantData.signedToday = participantData.checkIns.some(checkIn => 
          new Date(checkIn) >= today
        );


        setParticipant(participantData);
        
        // Update last check-in status with ID and duplicate check info
        setLastCheckInStatus(`ID: ${id} - ${response.data.message}${response.data.isDuplicate ? ' (重複簽到)' : ''}`);
        
        // Increment the daily check-in count
        setDailyCheckInCount(response.data.dailyCheckInCount);
        setTotalPeople(response.data.totalPeople);
        await fetchParticipants();
        setManualEntry('');

        if (isSoundLoaded) {
          playSound('success');
        }
      } else {
        setParticipant(null);
        setLastCheckInStatus(`ID: ${id} - ${response.data.message}`);

        if (isSoundLoaded) {
          playSound('error');
        }
      }
      setError(null);
    } catch (err: unknown) {
      console.error('Error checking participant:', err);
      setLastCheckInStatus(`ID: ${id} - 檢查參與者時發生錯誤`);
      setParticipant(null);
      if (axios.isAxiosError(err) && err.response) {
        setError(`錯誤：${err.response.status} - ${err.response.data.message}`);
      } else {
        setError('發生未知錯誤');
      }

      if (isSoundLoaded) {
        playSound('error');
      }
    } finally {
      setIsLoading(false);
      if (autoScan) {
        setTimeout(() => setScanning(true), 2000);
      }
    }
  }, [autoScan, currentActivityName, isDemoMode, playSound, isSoundLoaded, API_URL]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setUploadStatus('未選擇檔案');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('activityName', pendingActivityName);

    try {
      const response = await axiosInstance.post(`${API_URL}/upload-participants`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('參與者資料更新成功');
      await fetchParticipants();
      setTotalPeople(response.data.totalPeople);
      setCurrentActivityName(pendingActivityName);
      
      // Add this line to update the activity name on the server
      await axiosInstance.post(`${API_URL}/set-current-activity`, { activityName: pendingActivityName });
      
      setError(null);
      setShowUpdateConfirmation(false);
    } catch (err: unknown) {
      console.error('File upload error:', err);
      setUploadStatus('上傳檔案時發生錯誤');
      if (axios.isAxiosError(err) && err.response) {
        setError(`錯誤：${err.response.status} - ${JSON.stringify(err.response.data)}`);
      } else {
        setError('檔案上傳時發生未知錯誤');
      }
    }
  };

  const handleClearData = async () => {
    try {
      const response = await axiosInstance.post(`${API_URL}/clear-participants`);
      setUploadStatus('所有參與者資料已成功清除');
      setParticipant(null);
      setError(null);
      setShowClearConfirmation(false);
      setParticipants({});
      setTotalPeople(response.data.totalPeople);
    } catch (err: unknown) {
      setUploadStatus('清除參與者資料時發生錯誤');
      if (axios.isAxiosError(err) && err.response) {
        setError(`錯誤：${err.response.status} - ${err.response.data}`);
      } else {
        setError('清除資料時發生未知錯誤');
      }
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password === 'hkacmadmin') {
      setIsAuthenticated(true);
      await fetchParticipantsOnLogin();
      await fetchTotalPeople();
      await refreshScanEntries(); // Add this line
    } else {
      setError('密碼錯誤');
    }
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setPassword('');
    setParticipants({}); // Clear participants data on logout
  };

  const handleExportExcel = async () => {
    try {
      const response = await axiosInstance.get(`${API_URL}/export-checkins`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Generate filename with activity name, app name, date, and time
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const fileName = `${currentActivityName || 'Unnamed_Activity'}_${SYSTEM_NAME}_${dateStr}_${timeStr}.xlsx`;
      
      saveAs(blob, fileName);
      setError(null);
    } catch (err) {
      setError('匯出簽到記錄時發生錯誤');
      console.error('Error exporting check-ins:', err);
    }
  };

  const handleModeSwitchClick = () => {
    setShowModeSwitch(true);
  };

  const handleModeSwitchPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModeSwitchPassword(event.target.value);
  };

  const handleModeSwitchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (modeSwitchPassword === 'hkacmadmin') {
      try {
        const newMode = !isDemoMode;
        const response = await axiosInstance.post(`${API_URL}/set-demo-mode`, { isDemoMode: newMode });
        if (response.data.success) {
          setIsDemoMode(newMode);
          setShowModeSwitch(false);
          setModeSwitchPassword('');
          setError(null);
          setLastCheckInStatus(`已切換至${newMode ? '演示' : '正式'}模式`);
        } else {
          setError('切換模式失敗。請稍後再試。');
        }
      } catch (err) {
        setError('切換模式時發生錯誤。請稍後再試。');
        console.error('Error switching modes:', err);
      }
    } else {
      setError('模式切換密碼錯誤');
    }
  };

  const toggleAutoScan = () => {
    setAutoScan(!autoScan);
    if (!autoScan) {
      setScanning(true);
      setIsPreviewVisible(true);
    }
  };

  const handleCurrentActivityNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingActivityName(event.target.value);
  };

  const fetchTotalPeople = async () => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/total-people`);
      setTotalPeople(response.data.totalPeople);
    } catch (error) {
      console.error('Error fetching total number of people:', error);
    }
  };

  const toggleScanning = () => {
    if (scanning) {
      setScanning(false);
      setIsPreviewVisible(false);
    } else {
      setScanning(true);
      setIsPreviewVisible(true);
    }
  };

  const handleScan = useCallback((data: any) => {
    const currentTime = Date.now();
    if (data && currentTime - lastScanTime > 2000) { // 2000 milliseconds = 2 seconds
      console.log('Scan result:', data);
      // Extract the text from the scanned data object
      const scannedText = data.text || '';
      console.log('Extracted text:', scannedText);
      if (scannedText) {
        checkParticipant(scannedText);
        setLastScanTime(currentTime);
        if (!autoScan) {
          setScanning(false);
          setIsPreviewVisible(false);
        }
      }
    }
  }, [autoScan, checkParticipant, lastScanTime]);

  const handleCameraAuthorization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      setIsCameraAuthorized(true);
      setError(null);
    } catch (error) {
      console.error('Error authorizing camera:', error);
      setError('無法獲取攝像頭權限。請確保您已授予攝像頭訪問權限。');
      setIsCameraAuthorized(false);
    }
  };

  const fetchDailyCheckInCount = async () => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/daily-check-in-count`);
      setDailyCheckInCount(response.data.dailyCheckInCount);
    } catch (error) {
      console.error('Error fetching daily check-in count:', error);
      setError('無法獲取今日總簽到次數');
    }
  };

  const handleResetDailyCheckInCount = async () => {
    try {
      const response = await axiosInstance.post(`${API_URL}/reset-daily-check-in-count`);
      if (response.data.success) {
        setDailyCheckInCount(response.data.dailyCheckInCount);
        setLastCheckInStatus('今日總簽到次數已重置');
        setError(null); // Clear any previous errors
      } else {
        setError('重置今日總簽到次數失敗');
      }
    } catch (err) {
      console.error('Error resetting daily check-in count:', err);
      setError('重置今日總簽到次數時發生錯誤');
    }
  };

  // Add this function to fetch the current activity name
  const fetchCurrentActivity = async () => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/current-activity`);
      const activityName = response.data.currentActivityName || 'HKACM';
      setCurrentActivityName(activityName);
      setPendingActivityName(activityName);
    } catch (error) {
      console.error('Error fetching current activity:', error);
      setError('無法獲取當前活動名稱');
      // Set default name in case of error
      setCurrentActivityName('HKACM');
      setPendingActivityName('HKACM');
    }
  };

  // Add this function to fetch scan entries
  const fetchScanEntries = async () => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/scan-entries`);
      setScanEntries(response.data);
    } catch (error) {
      console.error('Error fetching scan entries:', error);
      setError('無法獲取掃描記錄');
    }
  };

  // Add this function to refresh scan entries
  const refreshScanEntries = useCallback(async () => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/scan-entries`);
      setScanEntries(response.data);
    } catch (error) {
      console.error('Error fetching scan entries:', error);
      setError('無法獲取掃描記錄');
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    const fetchInitialData = async () => {
      await fetchTotalPeople();
      await fetchDailyCheckInCount();
      await fetchCurrentActivity();
      await fetchScanEntries(); // Add this line
    };

    fetchInitialData();

    // Fetch data every 5 minutes
    const intervalId = setInterval(() => {
      fetchTotalPeople();
      fetchDailyCheckInCount();
      fetchScanEntries(); // Add this line
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Add this function to handle activity name confirmation
  const handleConfirmActivityName = async () => {
    try {
      const response = await axiosInstance.post(`${API_URL}/set-current-activity`, { activityName: pendingActivityName });
      if (response.data.success) {
        setCurrentActivityName(pendingActivityName);
        setError(null);
        setUploadStatus('活動名稱更新成功');
      } else {
        throw new Error(response.data.message || '更新活動名稱失敗');
      }
    } catch (err) {
      console.error('Error confirming activity name:', err);
      setError(err instanceof Error ? err.message : '更新活動名稱時發生錯誤');
      setUploadStatus('');
    }
  };

  // Add these two functions to manually trigger sounds
  const playSuccessSound = () => {
    console.log('Manually triggering success sound');
    playSound('success');
  };

  const playErrorSound = () => {
    console.log('Manually triggering error sound');
    playSound('error');
  };

  // Add new function to handle participant list password submission
  const handleParticipantListPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (participantListPassword === 'acmlist') {
      setIsParticipantListAuthenticated(true);
      setParticipantListPassword('');
      await fetchParticipants(); // Fetch participants when authenticated
    } else {
      setError('參與者列表密碼錯誤');
    }
  };

  // Add new function to handle participant list password change
  const handleParticipantListPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setParticipantListPassword(event.target.value);
  };

  // Add new function to lock participant list
  const handleLockParticipantList = () => {
    setIsParticipantListAuthenticated(false);
  };

  // Add an error handling function for the QR scanner
  const handleError = (err: any) => {
    console.error(err);
    setError('QR掃描錯誤：' + err.message);
  };

  // Add this new function to handle clearing check-in records
  const handleClearCheckInRecords = async () => {
    setIsClearingCheckIns(true);
    try {
      const response = await axiosInstance.post(`${API_URL}/clear-check-in-records`);
      if (response.data.success) {
        setUploadStatus('所有簽到記錄已成功清除');
        await fetchParticipants(); // Refresh the participant list
        setError(null);
        setShowClearCheckInConfirmation(false); // Close the pop-up
      } else {
        setError('清除簽到記錄失敗');
      }
    } catch (err) {
      console.error('Error clearing check-in records:', err);
      setError('清除簽到記錄時發生錯誤');
    } finally {
      setIsClearingCheckIns(false);
    }
  };

  // Add this new function to handle scan list password submission
  const handleScanListPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (scanListPassword === 'scanlist') {
      setIsScanListAuthenticated(true);
      setScanListPassword('');
      await refreshScanEntries(); // Refresh scan entries when authenticated
    } else {
      setError('掃描記錄密碼錯誤');
    }
  };

  // Add this new function to handle scan list password change
  const handleScanListPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setScanListPassword(event.target.value);
  };

  // Add this new function to lock scan list
  const handleLockScanList = () => {
    setIsScanListAuthenticated(false);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
  };

  axios.interceptors.response.use(
    response => response,
    error => {
      if (error.code === 'EPROTO') {
        console.error('EPROTO error occurred. This might be due to a protocol mismatch.');
        // You can choose to retry the request here if needed
      }
      return Promise.reject(error);
    }
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>{SYSTEM_NAME}</h1>
        <h2>{currentActivityName || '未設定當前活動'}</h2>
        <div className="mode-switch">
          <span>目前模式：{isDemoMode ? '演示' : '正式'}</span>
          <button onClick={handleModeSwitchClick} className="mode-switch-button">
            切換至{isDemoMode ? '正式' : '演示'}模式
          </button>
        </div>
      </header>
      
      <main className="App-main">
        {error && <div className="error-message">{error}</div>}

        {showModeSwitch && (
          <div className="modal mode-switch-confirmation">
            <div className="modal-content">
              <h3>確認模式切換</h3>
              <p>請輸入管理員密碼以切換至{isDemoMode ? '正式' : '演示'}模式：</p>
              <form onSubmit={handleModeSwitchSubmit} className="mode-switch-form">
                <input
                  type="password"
                  value={modeSwitchPassword}
                  onChange={handleModeSwitchPasswordChange}
                  placeholder="輸入管理員密碼"
                  className="input-field"
                />
                <div className="button-group">
                  <button type="submit" className="submit-button">確認切換</button>
                  <button onClick={() => setShowModeSwitch(false)} className="cancel-button">取消</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className="check-in-section">
          <h2>簽到</h2>
          <form onSubmit={handleManualSubmit} className="check-in-form">
            <input
              type="text"
              value={manualEntry}
              onChange={handleInputChange}
              placeholder="手動輸入參與者ID或掃描二維碼"
              className="input-field"
            />
            <button type="submit" className="submit-button">提交</button>
          </form>

          <div className="qr-scanner-section">
            <p className="status-message">最後簽到狀態：{lastCheckInStatus}</p>
            
            <select 
              value={selectedCamera || ''} 
              onChange={handleCameraChange}
              disabled={scanning}
            >
              {cameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${camera.deviceId}`}
                </option>
              ))}
            </select>
            
            <div className="scanner-container" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
              {isPreviewVisible && (
                <QrScanner
                  delay={300}
                  onError={handleError}
                  onScan={handleScan}
                  constraints={{ 
                    video: { 
                      facingMode: "environment",
                      deviceId: selectedCamera || undefined
                    } 
                  }}
                  style={{ width: '100%', maxWidth: '600px' }}
                />
              )}
            </div>
            <div className="scanner-controls">
              <button onClick={handleCameraAuthorization} className="authorize-camera-button">
                授權攝像頭
              </button>
              <div className="scan-buttons">
                <button 
                  onClick={toggleScanning} 
                  className={scanning ? "stop-scan-button" : "scan-button"}
                  disabled={!isCameraAuthorized}
                >
                  {scanning ? '停止掃描' : '開始掃描'}
                </button>
                <button 
                  onClick={toggleAutoScan} 
                  className={`auto-scan-button ${autoScan ? 'active' : ''}`}
                  disabled={!isCameraAuthorized}
                >
                  {autoScan ? '關閉自動掃描' : '開啟自動掃描'}
                </button>
              </div>
            </div>
          </div>

          <p className="check-in-count">今日總簽到次數：{dailyCheckInCount}</p>
          <p className="total-people">總人數：{totalPeople}</p>

          {isLoading && <p className="loading-message">載入中...</p>}
        </section>

        {participant && (
          <section className="participant-info">
            <h2>參與者資訊</h2>
            <table className="info-table">
              <tbody>
                <tr>
                  <td><strong>ID</strong></td>
                  <td>{participant.id}</td>
                  <td><strong>狀態</strong></td>
                  <td>{participant.isValid ? '有效' : '無效'}</td>
                </tr>
                <tr>
                  <td><strong>中文姓名</strong></td>
                  <td>{participant.name}</td>
                  <td><strong>英文姓名</strong></td>
                  <td>{participant.ename}</td>
                </tr>
                <tr>
                  <td><strong>聲部</strong></td>
                  <td>{participant.voice}</td>
                  <td><strong>今日已簽到</strong></td>
                  <td>{participant.signedToday ? '是' : '否'}</td>
                </tr>
              </tbody>
            </table>
            {participant.checkIns && participant.checkIns.length > 0 && (
              <div className="check-ins">
                <h3>簽到記錄</h3>
                <table className="check-in-history-table">
                  <thead>
                    <tr>
                      <th>序號</th>
                      <th>簽到時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participant.checkIns.map((checkIn, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{formatToHKTime(new Date(checkIn))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="tabs-container">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              與者列表
            </button>
            <button 
              className={`tab ${activeTab === 'scanRecords' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanRecords')}
            >
              最近掃描記錄
            </button>
            <button 
              className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              管理員登入
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'participants' && (
              <section className="participant-list-section">
                <h2>參與者列表</h2>
                {!isParticipantListAuthenticated ? (
                  <form onSubmit={handleParticipantListPasswordSubmit} className="login-form">
                    <input
                      type="password"
                      value={participantListPassword}
                      onChange={handleParticipantListPasswordChange}
                      placeholder="輸入參與者列表密碼"
                      className="input-field"
                    />
                    <button type="submit" className="submit-button">查看列表</button>
                  </form>
                ) : (
                  <div className="participant-list">
                    <div className="section-header">
                      <h3>參與者列表</h3>
                      <div className="button-group">
                        <button onClick={handleLockParticipantList} className="lock-button">鎖定列表</button>
                      </div>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>序號</th>
                            <th>ID</th>
                            <th>中文姓名</th>
                            <th>英文姓名</th>
                            <th>聲部</th>
                            <th>狀態</th>
                            <th>今日已簽到</th>
                            <th>簽到記錄</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(participants).map((p: Participant, index: number) => {
                            // Calculate if signed today
                            const now = new Date();
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const signedToday = p.checkIns.some(checkIn => 
                              new Date(checkIn) >= today
                            );

                            return (
                              <tr key={p.id}>
                                <td>{index + 1}</td>
                                <td>{p.id}</td>
                                <td>{p.name}</td>
                                <td>{p.ename}</td>
                                <td>{p.voice}</td>
                                <td>{p.isValid ? '有效' : '無效'}</td>
                                <td>{signedToday ? '是' : '否'}</td>
                                <td>
                                  {p.checkIns && p.checkIns.length > 0 ? (
                                    <ul className="check-in-list">
                                      {p.checkIns.map((checkIn, index) => (
                                        <li key={index}>{formatToHKTime(new Date(checkIn))}</li>
                                      ))}
                                    </ul>
                                  ) : '未簽到'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'scanRecords' && (
              <section className="scan-list-section">
                <h2>最近掃描記錄</h2>
                {!isScanListAuthenticated ? (
                  <form onSubmit={handleScanListPasswordSubmit} className="login-form">
                    <input
                      type="password"
                      value={scanListPassword}
                      onChange={handleScanListPasswordChange}
                      placeholder="輸入掃描記錄密碼"
                      className="input-field"
                    />
                    <button type="submit" className="submit-button">查看記錄</button>
                  </form>
                ) : (
                  <div className="scan-list">
                    <div className="section-header">
                      <h3>最近掃描記錄</h3>
                      <div className="button-group">
                        <button onClick={handleLockScanList} className="lock-button">鎖定記錄</button>
                        <button onClick={refreshScanEntries} className="refresh-button">刷新記錄</button>
                      </div>
                    </div>
                    <table className="scan-entries-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>時間</th>
                          <th>姓名</th>
                          <th>狀態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanEntries.map((entry, index) => (
                          <tr key={index}>
                            <td>{entry.id}</td>
                            <td>{formatToHKTime(new Date(entry.time))}</td>
                            <td>{entry.name}</td>
                            <td>{entry.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'admin' && (
              <section className="scan-list-section">
                <h2>管理員登入</h2>
                {!isAuthenticated ? (
                  <form onSubmit={handlePasswordSubmit} className="login-form">
                    <input
                      type="password"
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder="輸入管理員密碼"
                      className="input-field"
                    />
                    <button type="submit" className="submit-button">登入</button>
                  </form>
                ) : (
                  <div className="admin-panel">
                    <div className="section-header">
                      <h3>管理員功能</h3>
                      <button onClick={handleLock} className="lock-button">登出</button>
                    </div>
                    <div className="admin-controls">
                      <div className="input-group">
                        <input
                          type="text"
                          value={pendingActivityName}
                          onChange={handleCurrentActivityNameChange}
                          placeholder="HKACM 大型詩班"
                          className="input-field"
                        />
                        <button onClick={handleConfirmActivityName} className="confirm-button">確認活動名稱</button>
                      </div>
                      <div className="file-input-container">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          accept=".xlsx,.xls"
                          className="file-input"
                        />
                        <button onClick={() => setShowUpdateConfirmation(true)} className="upload-button">
                          {file ? file.name : "未選擇任何檔案"}上傳 Excel 檔案
                        </button>
                      </div>
                      <div className="admin-action-buttons">
                        <button onClick={() => setShowClearConfirmation(true)} className="admin-action-button clear-all">清除所有資料</button>
                        <button onClick={() => setShowClearCheckInConfirmation(true)} className="admin-action-button clear-checkins">清除簽到記錄</button>
                        <button onClick={handleExportExcel} className="admin-action-button export">匯出簽到記錄</button>
                        <button onClick={handleResetDailyCheckInCount} className="admin-action-button reset">重置今日總簽到次數</button>
                      </div>
                    </div>

                    {showClearCheckInConfirmation && (
                      <div className="modal clear-confirmation">
                        <div className="modal-content">
                          <h3>確認清除簽到記錄</h3>
                          <p>您確定要清除所有參與者的簽到記錄嗎？此操作無法撤銷。</p>
                          <div className="button-group">
                            <button 
                              onClick={handleClearCheckInRecords} 
                              className="confirm-clear-button"
                              disabled={isClearingCheckIns}
                            >
                              確認
                            </button>
                            <button 
                              onClick={() => setShowClearCheckInConfirmation(false)} 
                              className="cancel-clear-button"
                              disabled={isClearingCheckIns}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="sound-test-section">
                      <h4>音效測試</h4>
                      <div className="sound-test-buttons">
                        <button onClick={playSuccessSound} className="sound-test-button success">播放成功音效</button>
                        <button onClick={playErrorSound} className="sound-test-button error">播放錯誤音效</button>
                      </div>
                      <div className="volume-control">
                        <label htmlFor="volume-slider">音量控制:</label>
                        <input
                          type="range"
                          id="volume-slider"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                        />
                      </div>
                      <div className="sound-attempts">
                        <h5>音效播放嘗試:</h5>
                        <ul>
                          {soundPlayAttempts.slice(-5).map((attempt, index) => (
                            <li key={index}>{attempt}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="sound-indicator">
                        最後播放音效: {lastPlayedSound === 'success' ? '成功' : lastPlayedSound === 'error' ? '錯誤' : '無'}
                      </div>
                      <div className="sound-status">
                        <h5>音效載入狀態:</h5>
                        <p>
                          音效已載入: {soundsLoaded ? '是' : '否'} | 
                          成功音效: {successAudio ? '已載入' : '未載入'} | 
                          錯誤音效: {errorAudio ? '已載入' : '未載入'}
                        </p>
                      </div>
                    </div>

                    <p className="upload-status">{uploadStatus}</p>
                    {showUpdateConfirmation && (
                      <div className="modal update-confirmation">
                        <div className="modal-content">
                          <h3>確認更新</h3>
                          <p>您確定要上傳新的參與者資料嗎？這將會覆蓋現有的資料。</p>
                          <div className="button-group">
                            <button onClick={handleFileUpload} className="confirm-update-button">確認</button>
                            <button onClick={() => setShowUpdateConfirmation(false)} className="cancel-update-button">取消</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {showClearConfirmation && (
                      <div className="modal clear-confirmation">
                        <div className="modal-content">
                          <h3>確認清除</h3>
                          <p>您確定要清除所有參與者資料嗎？此操作無法撤銷。</p>
                          <div className="button-group">
                            <button onClick={handleClearData} className="confirm-clear-button">確認</button>
                            <button onClick={() => setShowClearConfirmation(false)} className="cancel-clear-button">取消</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
