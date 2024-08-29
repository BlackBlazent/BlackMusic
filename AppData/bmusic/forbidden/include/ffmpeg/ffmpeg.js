const fs = require('fs');
const childProcess = require('child_process');

// Set the input file path
const inputFile = 'input.mp4';

// Set the ffprobe command
const cmd = `ffprobe -i ${inputFile} -show_streams -print_format json`;

// Run the ffprobe command
childProcess.exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error(err);
  } else {
    const data = JSON.parse(stdout);
    console.log(data);
  }
});