import * as ort from "onnxruntime-node";
import sharp from "sharp";

// ImageNet mean/std
const mean = [0.485, 0.456, 0.406];
const std = [0.229, 0.224, 0.225];

// Preprocess image to Float32Array [1, 3, 256, 256]
async function preprocessImageBuffer(
  imageBuffer: Buffer
): Promise<Float32Array> {
  const image = sharp(imageBuffer).resize(256, 256).removeAlpha().raw();
  const { data } = await image.toBuffer({ resolveWithObject: true });
  const floatData = new Float32Array(3 * 256 * 256);

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = y * 256 * 3 + x * 3 + c;
        const chwIdx = c * 256 * 256 + y * 256 + x;
        floatData[chwIdx] = (data[idx] / 255 - mean[c]) / std[c];
      }
    }
  }
  return floatData;
}

function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

/**
 * Classifies an image using an ONNX CNN model.
 * @param imageBuffer Buffer of the image (e.g. from multer or base64 decode)
 * @param modelPath Path to the ONNX model file
 * @param classNames Array of class names (index matches model output)
 * @param topK Number of top predictions to return (default 5)
 * @returns Array of {label, prob} sorted by probability descending
 */
export async function classifyImage(
  imageBuffer: Buffer,
  modelPath: string,
  classNames: string[],
  topK = 5
): Promise<{ label: string; prob: number }[]> {
  const session = await ort.InferenceSession.create(modelPath);
  const input = await preprocessImageBuffer(imageBuffer);

  const tensor = new ort.Tensor("float32", input, [1, 3, 256, 256]);
  // Try to infer input/output names
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
  const results = await session.run(feeds);
  const output = results[outputName].data as Float32Array;

  // Apply softmax to get probabilities
  const probs = softmax(Array.from(output));

  // Get top-K indices
  const top = probs
    .map((p, i) => ({ prob: p, idx: i }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, topK)
    .map(({ prob, idx }) => ({
      label: classNames[idx] || `class_${idx}`,
      prob,
    }));

  return top;
}
