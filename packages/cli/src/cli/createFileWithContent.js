const fs = require('fs');
const path = require('path');

// Function to create a file with content and handle folder creation
function createFileWithContent(filePath, content, callback) {
  // Extract the directory path from the file path
  const directory = path.dirname(filePath);

  // Create the directory if it doesn't exist
  fs.mkdirSync(directory, { recursive: true });

  // Write the content to the file
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error('Error creating file:', err);
    } else {
      console.log('File created successfully:', filePath);
    }

    // Invoke the callback function, if provided
    if (callback) {
      callback(err);
    }
  });
}

module.exports = createFileWithContent;
