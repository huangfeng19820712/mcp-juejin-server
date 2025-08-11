import cv from 'opencv4nodejs';

console.log('Node.js version:', process.version);
console.log('Available keys:', Object.keys(cv));
console.log('OpenCV version:', cv.version);
try {
    console.log('Attempting to create Mat...');
    const mat = new cv.Mat(100, 100, cv.CV_8UC3);
    console.log('Mat created:', mat.rows, 'x', mat.cols);
    mat.setTo([255, 0, 0]);
    cv.imwrite('./test-output.jpg', mat);
    console.log('Image saved as test-output.jpg');
} catch (error) {
    console.error('Runtime error:', error);
}