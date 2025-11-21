// Test script for title extraction functionality
import { extractBestTitle, extractTitleFromFilename } from './titleExtractor.js';

// Test data
const testData = [
  {
    text: "GUSTAV MAIER'IN TUHAF ÖYKÜSÜ\n\nBy John Smith\n\nFADE IN:\n\nINT. HOUSE - DAY",
    metadata: {},
    filename: "gustav_maier_1_bolum.pdf"
  },
  {
    text: "\n\n\n\n    THE MATRIX\n\n\nWritten by\nLarry and Andy Wachowski\n\n\nFADE IN:",
    metadata: { info: { Title: "The Matrix Script" } },
    filename: "matrix_screenplay.pdf"
  },
  {
    text: "Page 1\n\n\nCONTINUED\n\nSenaryo Başlık Yok\n\nINT. CAFE - MORNING",
    metadata: {},
    filename: "kahve_dukkani_senaryo_v3_final.pdf"
  }
];

// Test multiple filenames for common title extraction
const multipleFiles = [
  "Gustav_Maier_1_Bolum.pdf",
  "Gustav_Maier_2_Bolum.pdf", 
  "Gustav_Maier_3_Bolum.pdf",
  "Gustav_Maier_Final_Bolum.pdf"
];

console.log("=== Title Extraction Tests ===");

testData.forEach((test, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log(`File: ${test.filename}`);
  console.log(`Extracted Title: "${extractBestTitle(test.text, test.metadata, test.filename)}"`);
});

console.log("\n=== Multiple Files Common Title Test ===");
console.log(`Files: ${multipleFiles.join(', ')}`);
console.log(`Common Title: "${extractTitleFromFilename(multipleFiles)}"`);

export default { extractBestTitle, extractTitleFromFilename };