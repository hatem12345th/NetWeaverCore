import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sendCommandsOverSSH } from './utils/sshClient.js';




dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Placeholder test route

app.get('/', (req, res) => {
  res.send('NetWeaver Core API is running');
});

app.post('/api/send-config', async (req, res) => {
    const { host, username, password, commands } = req.body;
  
    const result = await sendCommandsOverSSH(host, username, password, commands);
    res.json(result);
  });

export default app;
