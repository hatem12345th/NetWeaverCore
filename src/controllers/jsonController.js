import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const parseJsonFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    const filePath = path.join(__dirname, '../', req.file.path);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse the JSON
    const jsonData = JSON.parse(fileContent);

    // Delete the temporary file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      data: jsonData,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

  } catch (error) {
    // Clean up the file if something went wrong
    if (req.file) {
      const filePath = path.join(__dirname, '../', req.file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const response = {
      success: false,
      error: error.message || 'Failed to parse JSON file'
    };

    if (error instanceof SyntaxError) {
      response.details = 'Invalid JSON format';
    }

    res.status(500).json(response);
  }
};