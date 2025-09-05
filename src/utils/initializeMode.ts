import * as fs from "fs";

const MODEL_DIR = "src/cnn_model";
const MODEL_PATH = `${MODEL_DIR}/model.onnx`;
const CLASS_NAMES_PATH = `${MODEL_DIR}/class_names.json`;

export let classNames: any[] | null = null;
export let modelPath: string | null = null;

async function downloadIfNotExistsOrReplace(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}`);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    if (!res.body) {
      reject(new Error("No response body"));
      return;
    }
    const reader = res.body.getReader();
    function pump() {
      return reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            fileStream.end();
            resolve(undefined);
            return;
          }
          fileStream.write(Buffer.from(value), pump);
        })
        .catch(reject);
    }
    pump();
    fileStream.on("error", reject);
  });
  console.log(`Downloaded and replaced ${dest}`);
}

// Download and replace files at startup
(async () => {
  try {
    await downloadIfNotExistsOrReplace(
      "https://huggingface.co/Sush1sui/nutrisight_v1/resolve/main/model.onnx",
      MODEL_PATH
    );
    await downloadIfNotExistsOrReplace(
      "https://huggingface.co/Sush1sui/nutrisight_v1/resolve/main/class_names.json",
      CLASS_NAMES_PATH
    );

    classNames = JSON.parse(fs.readFileSync(CLASS_NAMES_PATH, "utf-8"));
    if (!Array.isArray(classNames) || classNames.length === 0) {
      throw new Error("Invalid class names file");
    }
    console.log("Class names loaded:", classNames.length, "classes");

    modelPath = MODEL_PATH;
    console.log("Model path set:", modelPath);
  } catch (err) {
    console.error("Failed to download model files:", err);
    process.exit(1);
  }
})();
