# NutriSight — Final Defense Q&A (Android App + Backend)

This Q&A is prepared to help you rehearse and explain the NutriSight Android mobile application and its supporting backend for your thesis final defense. Answers are concise and written for panelists who may not be deep in the code base.

## Quick Tips for the Defense

- Keep explanations short and direct (30–60 seconds per question).
- Reference file names and components when asked (e.g., `cameraController.ts`, `model_inference.ts`).
- Explain trade-offs: why a pragmatic engineering change was chosen over a model retrain.

---

## 1. Overview & Motivation

Q: What is NutriSight and the purpose of your project?

A: NutriSight is an Android mobile application (with a Node.js + TypeScript backend). The mobile app captures images or scans barcodes; the backend uses a CNN ONNX model and nutrition APIs to provide nutrition, allergen, and tailored food recommendations.

Q: Who benefits from this system?

A: People who track their diet, those with food allergies, and researchers or developers who need a food-recognition tool.

Q: What is NutriSight and the purpose of your project?

A: NutriSight is an Android app with a backend that recognizes food from images or barcodes and provides nutrition, allergen, and meal recommendations.

The goal is to help users make healthier choices by combining a simple mobile UX with AI-powered food recognition and nutrition data.

---

## 2. High-level Architecture

Q: How does the Android app interact with the backend, and what were the key mobile design decisions?

A: The Android app sends photos or barcodes to the backend using HTTP request. We keep images temporary and focus on a simple one-tap experience. Backend endpoints return top predictions and optional nutrition details when requested.

Q: How does an image request flow through the system?

A: The Android app sends a photo or barcode to `POST /camera/predict-food`. The backend runs the model and returns the top guesses. If needed, the app calls `POST /camera/get-food-data` for detailed nutrition and allergen info.

---

## 3. Model & Inference

Q: What model do you use and why ONNX?

A: A custom CNN exported to ONNX. ONNX makes the model portable and fast to run in Node.js using `onnxruntime-node`.

Q: What classes and input size does the model use?

A: The model expects 252x252 images and predicts among 125 classes (a mix of Filipino dishes and other common foods) plus one `non_food` class.

Q: What is `non_food` and how is it used?

A: `non_food` marks images that likely do not contain food. If it ranks in the top 3 with probability >= 0.5 and no exempt fruit is detected, the API returns `error: "not food"`.

---

## 4. Key Business Logic (Non-Food / Exempt Fruits)

Q: What are exempt fruits and why are they needed?

A: Some fruits (banana, apple, orange, strawberry) were often misclassified as non-food by the model. We whitelist them so the app does not say "not food" when a clear fruit is present.

Q: How do you implement exempt-fruit handling?

A: The backend checks the top 3 predictions. If an exempt fruit has probability >= 0.5, it removes `non_food` from results and returns the fruit first.

Q: Why not retrain to fix this issue?

A: Retraining is the long-term fix but requires more images and time. Whitelisting is a quick, reliable way to improve user experience now.

---

## 5. Nutrition & Allergen Processing

Q: How do you get nutrition data for a predicted food?

A: If the food is in the local database, we return that. If not, we ask external APIs in order: USDA, Nutritionix, Open Food Facts, and finally a Gemini-based fallback.

Q: How do you calculate calories/macros consistently?

A: We search for common names (e.g., "calories", "energy", "kcal") across API data and add up matching values to get consistent totals for calories, protein, carbs, and fat.

Q: How do you detect allergens?

A: We parse ingredients with Gemini AI and then cross-check with a local allergen list to ensure we detect common allergens reliably.

---

## 6. Endpoints & Data Format (Quick Reference)

- `POST /camera/predict-food` — accepts base64 image, returns { message, data: [ { label, prob } ] }
- `POST /camera/get-food-data` — accepts `foodName`, returns grouped nutrition, ingredients, serving size
- `POST /camera/barcode` — barcode nutrition lookup (USDA, Nutritionix, Open Food Facts)
- `GET /account/recommend-foods` — returns recommended foods for meal times (includes `servingSize`, macros)

Bonus: `server` start commands: `npm run dev` for dev, `npm run build` followed by `npm start` for production.

---

## 7. Algorithm Choices & Trade-offs

Q: What are the main algorithms of this backend server contributing to the thesis?

A: The core pieces are the CNN image classifier, the dual-layer allergen detection (Gemini + local mapping), nutrition normalization (units, grouping), and the API fallback cascade for reliable data.

Q: How do you justify decisions like quick fixes vs retrain?

A: Use a small, safe rule to fix urgent UX issues now (e.g., exempt fruits), and collect data to retrain the model for a long-term fix.

---

## 8. Evaluation & Metrics

Q: How do you measure model success?

A: We measure how often the top guess is correct, how often the correct label appears in the top three, common mistake rates, and how long inference takes. We also track when `non_food` wrongly flags food images.

Q: What evidence do you have that the exempt-fruit change helps?

A: Logs and manual tests show fewer wrong "not food" results for fruits. We recommend logging and checking the results to measure improvements precisely.

---

## 9. Security & Privacy

Q: Do you store images permanently?

A: No. Images are sent to the backend and then discarded (`imgBuffer = null`). For production, keep storage secure if needed.

Q: How are API keys and sensitive secrets protected?

A: Store keys in environment variables or a secret manager (e.g., Heroku Config Vars, Vault). Do not commit them into the repo.

---

## 10. Demo Checklist (What to show during defense)

- Show a quick image classification (non-food vs fruit) and explain `predictFoodHandler` decisions.
- Fetch `get-food-data` for a detected label to show nutrition/grouping and managed allergens.
- Run an image showing a plate with multiple foods and show the top three guesses.
- Demonstrate barcode lookup (USDA or Nutritionix fallback) and `get-food-data` output.

---

## 11. Rapid Fire (Short Answers)

- Q: How does the app work in one sentence?
  A: Take a photo or scan a barcode; the app shows predicted food, nutrition details, and allergens.
- Q: What if the photo has no food?
  A: The app returns an error and asks the user to try again.
- Q: How does a user correct a wrong prediction?
  A: The user can pick the correct food from the suggested list or retake the photo.
- Q: Are images stored permanently?
  A: No — images are processed and discarded for privacy.
- Q: Is user data safe?
  A: Yes — the app uses authenticated sessions and secrets are stored on the server, not in the app.
- Q: How long does a prediction take?
  A: Typically a few seconds depending on network and server load. The app is designed to return quick results for a smooth user experience.

---

## 12. Appendix: Suggested Answers for Common Panel Concerns

- On correctness vs speed: The system prioritizes correct nutrition mapping and allergen safety; we can tune latency by using smaller models or GPU-backed inference.
- On long-term improvements: Plan for retraining the model with more fruit examples and implementing object detection for multi-item plates.
- On dataset biases: Acknowledge potential class imbalance; propose augmentations and data collection as mitigation.

---
