const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const https = require('https'); // Change this from http to https
const os = require('os');
const cors = require('cors');
const getLocalIP = require('./get-ip');

// Remove this line as fs is already imported above
// const fs = require('fs');

const app = express();

// Remove the cors middleware
// app.use(cors({ ... }));

// Add this middleware to manually set CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

const uploadDir = 'uploads/';
const dataFilePath = path.join(__dirname, 'participants_data.json');
const activityFilePath = path.join(__dirname, 'current_activity.json');

if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const upload = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel") {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .xlsx and .xls format allowed!'));
    }
  }
});

// Get the local network IP address
const networkInterfaces = os.networkInterfaces();
const localNetworkIP = networkInterfaces.en0 ? networkInterfaces.en0.find(iface => iface.family === 'IPv4').address : '192.168.0.119';

// Update CORS configuration
app.use(bodyParser.json());

require('dotenv').config();

// Use process.env.SERVER_IP instead of hardcoding the IP
app.use(cors({
  origin: [
    'https://localhost:3000',
    'http://localhost:3000',
    `https://${process.env.SERVER_IP}:3000`,
    `http://${process.env.SERVER_IP}:3000`
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

let participants = {};
let isDemoMode = true;
let dailyCheckInCount = 0;
let currentActivityName = 'HKACM';
let scanEntries = [];

// Load participants data
if (fs.existsSync(dataFilePath)) {
  const data = fs.readFileSync(dataFilePath, 'utf8');
  participants = JSON.parse(data);
}


// Load current activity name
if (fs.existsSync(activityFilePath)) {
  const activityData = fs.readFileSync(activityFilePath, 'utf8');
  currentActivityName = JSON.parse(activityData).currentActivityName || 'HKACM';
} else {
  // If the file doesn't exist, create it with the default name
  saveActivityName();
}


function saveParticipantsData() {
  fs.writeFileSync(dataFilePath, JSON.stringify(participants, null, 2));
}


function saveActivityName() {
  try {
    fs.writeFileSync(activityFilePath, JSON.stringify({ currentActivityName }, null, 2));
  } catch (error) {
    console.error('Error writing activity name to file:', error);
    throw error;
  }
}


function resetDailyCheckInCount() {
  const now = new Date();
  const night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const msToMidnight = night.getTime() - now.getTime();

  setTimeout(() => {
    dailyCheckInCount = 0;
    resetDailyCheckInCount();
  }, msToMidnight);
}

resetDailyCheckInCount();

app.post('/api/set-demo-mode', (req, res) => {
  const { isDemoMode: newMode } = req.body;
  isDemoMode = newMode;
  res.json({ success: true, message: `Switched to ${isDemoMode ? 'Demo' : 'Production'} mode` });
});


app.get('/api/participants', (req, res) => {
  const participantList = Object.entries(participants).map(([id, data]) => ({
    id,
    ...data
  }));
  res.json(participantList);
});


app.post('/api/clear-participants', (req, res) => {
  try {
    participants = {};
    saveParticipantsData();
    res.json({ message: 'All participant data cleared successfully', totalPeople: 0 });
  } catch (error) {
    res.status(500).send('Error clearing participant data');
  }
});


app.post('/api/upload-participants', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    participants = {};

    data.forEach(row => {
      participants[row.id] = {
        name: row.cname || '',
        ename: row.ename || '',
        email: row.email || '',
        voice: row.voice || '',
        isValid: row.status.toLowerCase() === 'valid',
        checkIns: []
      };
    });

    saveParticipantsData();

    res.json({ message: 'Participants updated successfully', totalPeople: Object.keys(participants).length });
  } catch (error) {
    res.status(500).send('Error processing file');
  } finally {
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error('Error deleting temporary file:', err);
      }
    });
  }
});


app.get('/api/export-checkins', (req, res) => {
  try {
    const checkInRecords = Object.entries(participants).map(([id, data], index) => {
      const record = {
        '序號': index + 1,
        ID: id,
        'Chinese Name': data.name,
        'English Name': data.ename,
        Email: data.email,
        Voice: data.voice,
      };

      for (let i = 0; i < 10; i++) {
        record[`Check-in ${i + 1}`] = data.checkIns && data.checkIns[i] 
          ? moment.tz(data.checkIns[i], "Asia/Hong_Kong").format('YYYY-MM-DD HH:mm:ss')
          : '';
      }

      return record;
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(checkInRecords);
    
    ws['!cols'] = [
      { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 10 },
      ...Array(10).fill({ wch: 20 })
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Check-ins');
    
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=checkins.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(buf);
  } catch (error) {
    console.error('Error exporting check-ins:', error);
    res.status(500).json({ message: 'Error exporting check-ins' });
  }
});

// Add this new endpoint
app.get('/api/total-people', (req, res) => {
  const totalPeople = Object.keys(participants).length;
  res.json({ totalPeople });
});


app.get('/api/daily-check-in-count', (req, res) => {
  res.json({ dailyCheckInCount });
});


app.post('/api/check-in', (req, res) => {
  const { qrData, checkInTime, isDemoMode, activityName } = req.body;
  const participant = participants[qrData];

  // Store the scan entry
  scanEntries.unshift({
    id: qrData,
    time: checkInTime,
    name: participant ? participant.name : 'Unknown',
    status: participant ? (participant.isValid ? 'Valid' : 'Invalid') : 'Not Found'
  });

  // Limit scanEntries to the last 100 entries
  if (scanEntries.length > 100) {
    scanEntries = scanEntries.slice(0, 100);
  }

  if (participant) {
    if (participant.isValid) {
      const hkTime = moment.tz(checkInTime, "Asia/Hong_Kong");
      const today = hkTime.format('YYYY-MM-DD');
      const todayCheckIns = participant.checkIns ? participant.checkIns.filter(checkIn => 
        moment.tz(checkIn, "Asia/Hong_Kong").format('YYYY-MM-DD') === today
      ) : [];

      if (todayCheckIns.length === 0 || isDemoMode) {
        if (!participant.checkIns) {
          participant.checkIns = [];
        }
        participant.checkIns.unshift(hkTime.toISOString());
        if (participant.checkIns.length > 10) {
          participant.checkIns = participant.checkIns.slice(0, 10);
        }
        dailyCheckInCount++;
        saveParticipantsData();
        res.json({ 
          message: `${participant.name}，簽到成功。請進入活動場地。`, 
          participant: {
            name: participant.name,
            ename: participant.ename,
            email: participant.email,
            voice: participant.voice,
            isValid: participant.isValid,
            checkIns: participant.checkIns
          },
          multipleCheckIns: todayCheckIns.length > 0,
          checkInCount: todayCheckIns.length + 1,
          dailyCheckInCount: dailyCheckInCount,
          totalPeople: Object.keys(participants).length,
          activityName: activityName
        });
      } else {
        res.json({ 
          message: `${participant.name}，您今天已經簽到過。`, 
          participant: {
            name: participant.name,
            ename: participant.ename,
            email: participant.email,
            voice: participant.voice,
            isValid: participant.isValid,
            checkIns: participant.checkIns
          },
          multipleCheckIns: true,
          checkInCount: todayCheckIns.length + 1,
          dailyCheckInCount: dailyCheckInCount,
          totalPeople: Object.keys(participants).length,
          activityName: activityName
        });
      }
    } else {
      res.json({ 
        message: '抱歉，您的資料無效。',
        dailyCheckInCount: dailyCheckInCount,
        totalPeople: Object.keys(participants).length,
        activityName: activityName
      });
    }
  } else {
    res.json({ 
      message: '找不到參與者資料。',
      dailyCheckInCount: dailyCheckInCount,
      totalPeople: Object.keys(participants).length,
      activityName: activityName
    });
  }
});

// Add new endpoints for activity name
app.get('/api/current-activity', (req, res) => {
  res.json({ currentActivityName });
});

app.post('/api/set-current-activity', (req, res) => {
  const { activityName } = req.body;
  if (!activityName) {
    return res.status(400).json({ success: false, message: '活動名稱不能為空' });
  }
  try {
    currentActivityName = activityName;
    saveActivityName();
    res.json({ success: true, message: 'Current activity name updated successfully' });
  } catch (error) {
    console.error('Error saving activity name:', error);
    res.status(500).json({ success: false, message: 'Error saving activity name' });
  }
});

// Add a new endpoint to retrieve scan entries
app.get('/api/scan-entries', (req, res) => {
  res.json(scanEntries);
});

app.post('/api/reset-daily-check-in-count', (req, res) => {
  try {
    dailyCheckInCount = 0;
    res.json({ success: true, message: '今日總簽到次數已重置', dailyCheckInCount: 0 });
  } catch (error) {
    console.error('Error resetting daily check-in count:', error);
    res.status(500).json({ success: false, message: '重置今日總簽到次數時發生錯誤' });
  }
});

// Add this new endpoint
app.post('/api/clear-check-in-records', (req, res) => {
  try {
    Object.values(participants).forEach(participant => {
      participant.checkIns = [];
    });
    saveParticipantsData();
    dailyCheckInCount = 0; // Reset daily check-in count as well
    res.json({ success: true, message: 'All check-in records cleared successfully' });
  } catch (error) {
    console.error('Error clearing check-in records:', error);
    res.status(500).json({ success: false, message: 'Error clearing check-in records' });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

const PORT = process.env.PORT || 3001;
const HOST = getLocalIP();

const startServer = () => {
  https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
    console.log(`Server is running on https://${HOST}:${PORT}`);
  }).on('error', (err) => {
    console.error('Error starting server:', err);
  });
};

startServer();
