// faceUtils.js
const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODELS_PATH = path.join(__dirname, 'models');

const loadModels = async () => {
await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, 'models', 'ssd_mobilenetv1_model'));
await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, 'models', 'face_landmark_68_model'));
await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, 'models', 'face_recognition_model'));
};

const getDescriptor = async (imagePath) => {
  const img = await canvas.loadImage(imagePath);
  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
  if (!detection) throw new Error('No face detected');
  return Array.from(detection.descriptor);
};

const euclideanDistance = (desc1, desc2) => {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += (desc1[i] - desc2[i]) ** 2;
  }
  return Math.sqrt(sum);
};

module.exports = { loadModels, getDescriptor, euclideanDistance };
