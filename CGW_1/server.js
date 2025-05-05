const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());

app.use(bodyParser.json());

// Store the latest sensor data
let sensorData = {
  alpha: 0,  // rotation around z-axis
  beta: 0,   // rotation around x-axis
  gamma: 0,  // rotation around y-axis
  timestamp: Date.now()
};

// POST endpoint to receive sensor data from smartphone
app.post('/sensor-data', (req, res) => {
  const data = req.body;
  
  // Update the stored sensor data
  if (data.alpha !== undefined) sensorData.alpha = data.alpha;
  if (data.beta !== undefined) sensorData.beta = data.beta;
  if (data.gamma !== undefined) sensorData.gamma = data.gamma;
  sensorData.timestamp = Date.now();
  
  console.log('Received sensor data:', sensorData);
  res.status(200).send({ status: 'ok' });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.send(JSON.stringify(sensorData));
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

setInterval(() => {
  if (wss.clients.size > 0) {
    const message = JSON.stringify(sensorData);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}, 20);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server is ready`);
  console.log(`POST sensor data to http://localhost:${PORT}/sensor-data`);
  console.log(`Connect your WebGL app to ws://localhost:${PORT}`);
});