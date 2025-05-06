import app from './app.js';

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 NetWeaver Core running on port ${PORT}`);
});
