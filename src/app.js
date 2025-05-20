import express from 'express';
import gns3Routes from './routes/gns3Routes.js';


const app = express();

// Ensure uploads directory exists


// Middleware
app.use(express.json());

app.use('/api', gns3Routes);
app.get('/', (req, res) => {
  res.send('Hello from local network!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Something went wrong!' 
  });
});


export default app;