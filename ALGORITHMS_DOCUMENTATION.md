# Algorithm Documentation

This document describes all algorithms and computational concepts used in the NutriSight backend system.

---

## **1. IMAGE CLASSIFICATION ALGORITHM**

**Location:** `src/utils/model_inference.ts`

### **Concept: Convolutional Neural Network (CNN) Inference**

- **Purpose:** Classify food images into 101 Filipino food categories
- **Model:** Custom-trained ONNX model (256x256 input size)

### **Algorithm Steps:**

#### **1.1 Image Preprocessing**

```
Input: Raw image buffer
Steps:
  1. Resize image to 256×256 pixels using sharp library
  2. Remove alpha channel (convert to RGB)
  3. Convert pixel values from [0, 255] to [0, 1] by dividing by 255
  4. Apply ImageNet normalization:
     - mean = [0.485, 0.456, 0.406]
     - std = [0.229, 0.224, 0.225]
     - normalized_pixel = (pixel - mean) / std
  5. Reorder dimensions from HWC (Height, Width, Channels) to CHW (Channels, Height, Width)
  6. Convert to Float32Array
Output: Tensor [1, 3, 256, 256]
```

#### **1.2 Softmax Activation**

```
Purpose: Convert raw model outputs (logits) to probabilities
Formula: softmax(x_i) = exp(x_i - max(x)) / Σ exp(x_j - max(x))
Steps:
  1. Find maximum value in array (numerical stability)
  2. Subtract max from all values
  3. Apply exponential function to each value
  4. Sum all exponentials
  5. Divide each exponential by sum
Output: Probability distribution (sums to 1.0)
```

#### **1.3 Top-K Selection**

```
Purpose: Return most likely food predictions
Steps:
  1. Pair each probability with its class index
  2. Sort by probability (descending)
  3. Take top K results (default K=5)
  4. Map indices to class names
Output: [{label: "adobo", prob: 0.85}, ...]
```

**Time Complexity:** O(n log n) for sorting, where n = number of classes

---

## **2. ALLERGEN DETECTION ALGORITHM**

**Location:** `src/utils/ingredientsNutritionsPredict.ts`

### **Concept: AI-Powered String Matching with Context**

- **Purpose:** Identify allergens in food ingredients using Gemini AI
- **Method:** Natural Language Processing with structured prompts

### **Algorithm Steps:**

```
Input:
  - foodName: string
  - userAllergens: string[]
  - ingredients: string[]

Steps:
  1. Construct structured prompt with food name, ingredients, user allergens
  2. Send to Gemini 2.5 Flash Lite API
  3. Request JSON response format:
     {
       "ingredients": [predicted if not provided],
       "triggeredAllergens": [{"ingredient": "...", "allergen": "..."}],
       "groupedNutrition": [...]
     }
  4. Parse JSON response with regex: /\{[\s\S]*\}/
  5. Filter triggered allergens:
     - Only match single, simple ingredient names
     - Ingredient must exist in ingredients array
     - Allergen must match user's allergen list
  6. Validate ingredients against user's allergen profile

Output: {
  ingredients: string[],
  triggeredAllergens: [{ingredient, allergen}],
  groupedNutrition: [...]
}
```

**Key Rules:**

- No full phrases or grouped ingredients in allergen matching
- Ingredient name in triggeredAllergens MUST exist in ingredients array
- Case-insensitive matching for flexibility

**Time Complexity:** O(n) where n = number of ingredients

---

## **3. NUTRITION DATA NORMALIZATION ALGORITHM**

**Location:** `src/utils/foodCameraUtils.ts`

### **Concept: Data Deduplication and Standardization**

- **Purpose:** Convert nutrition data from multiple APIs into uniform format
- **Challenge:** Different APIs use different units, naming conventions, and duplicate fields

### **Algorithm Steps:**

#### **3.1 Energy Field Consolidation**

```
Problem: Open Food Facts returns multiple energy fields:
  - energy_value, energy-kcal_value, energy-serving_value, etc.

Solution:
  1. Identify all fields matching /^energy/i regex
  2. Priority order:
     a. Serving-specific energy (energy-serving)
     b. Explicit energy kcal (energy-kcal or energy)
     c. Computed energy (energy computed)
     d. Highest value among remaining
  3. Remove all other energy entries
  4. Normalize to single "Energy kcal" field

Output: Single canonical energy value in kcal
```

#### **3.2 Deduplication by Nutrient Name**

```
Purpose: Remove duplicate nutrients with different units/sources
Steps:
  1. Convert all nutrient names to lowercase
  2. Create Map<lowercase_name, nutrient>
  3. For duplicates, keep entry with largest numeric value
  4. Preserve original casing in final output

Example:
  Input: [{name: "Protein", value: 10, unit: "g"},
          {name: "protein", value: 12, unit: "g"}]
  Output: [{name: "Protein", value: 12, unit: "g"}]
```

#### **3.3 Unit Extraction**

```
Purpose: Parse nutrient values with units from API responses
Steps:
  1. Search for keys ending with "_value"
  2. Parse numeric value
  3. Look for corresponding "{key}_unit" field
  4. Default to "g" if unit not found
  5. Exception: energy fields default to "kcal"

Output: {name: string, value: number, unit: string}
```

**Time Complexity:** O(n) for single pass, O(n) for deduplication = O(n) overall

---

## **4. UNIT CONVERSION ALGORITHM**

**Location:** `src/utils/convertToGrams.ts`

### **Concept: Multi-System Unit Conversion with Density Tables**

- **Purpose:** Standardize all nutrition values to grams (or kcal for energy)

### **Algorithm Steps:**

#### **4.1 Mass Conversion**

```
Supported Units:
  - Metric: g (base), mg (÷1000), µg (÷1,000,000), kg (×1000)
  - Imperial: oz (×28.3495), lb (×453.592), st (×6350.29)

Formula: grams = value × conversion_factor
```

#### **4.2 Volume to Mass Conversion**

```
Challenge: Volume (ml, L) needs density to convert to mass
Steps:
  1. Extract substance name from nutrient context
  2. Lookup density in densityMap (45+ substances)
  3. Apply formula: grams = volume × density
  4. If no density found, return original unit

Density Examples:
  - Water: 1.0 g/ml
  - Milk: 1.03 g/ml
  - Olive oil: 0.92 g/ml
  - Honey: 1.42 g/ml

Volume Units: ml, L, dl, cl, tbsp, tsp, cup, pint, quart, gal
```

#### **4.3 International Units (IU) Conversion**

```
Context-Dependent Conversion:
  - Vitamin A: IU × 0.0000003 = grams
  - Vitamin D: IU × 0.000000025 = grams
  - Vitamin E: IU × 0.00067 = grams
  - Unknown: Keep as IU (no conversion)
```

**Time Complexity:** O(1) - constant time lookup and arithmetic

---

## **5. API FALLBACK CASCADE ALGORITHM**

**Location:** `src/controllers/cameraController.ts`

### **Concept: Multi-Source Data Retrieval with Graceful Degradation**

- **Purpose:** Maximize successful food data retrieval
- **Pattern:** Waterfall/cascade pattern

### **Algorithm Steps:**

#### **5.1 Barcode Scanning Cascade**

```
Priority Order:
  1. USDA FoodData Central API
     ↓ (if fails or no data)
  2. Nutritionix API
     ↓ (if fails or no data)
  3. Open Food Facts API
     ↓ (if fails or no data)
  4. Return 404 error

Each step includes:
  - API request
  - Response validation
  - Data normalization
  - Allergen scanning
  - Unit conversion
```

#### **5.2 Food Name Search Cascade**

```
Priority Order:
  1. Local MongoDB Database (Foods collection)
     ↓ (if not found)
  2. USDA FoodData Central API (Survey FNDDS data)
     ↓ (if fails)
  3. Nutritionix Natural Language API
     ↓ (if fails)
  4. Gemini AI Fallback (generates nutrition estimate)
     ↓ (if fails)
  5. Return 500 error
```

**Advantages:**

- High availability (4 data sources)
- Cost optimization (cheaper sources first)
- Quality degradation (most accurate → AI estimation)

**Time Complexity:** O(1) per API call, worst case O(k) where k = number of fallback sources

---

## **6. DATABASE INDEXING STRATEGY**

**Location:** Model files (`src/models/`)

### **Concept: Compound Indexes for Query Optimization**

#### **6.1 MealEntry Indexes**

```
Index 1: {userId: 1, date: 1}
Purpose: Fast retrieval of all meals for a user on specific date
Query: db.mealentries.find({userId: "abc", date: "2025-10-20"})
Complexity: O(log n + k) where k = matching documents

Index 2: {userId: 1, date: 1, mealType: 1}
Purpose: Get specific meal type (breakfast/lunch/dinner) for user on date
Query: db.mealentries.find({userId: "abc", date: "2025-10-20", mealType: "breakfast"})
Complexity: O(log n + k)

Index 3: {scanResultId: 1}
Purpose: Find all users who consumed a specific food
```

#### **6.2 LoggedWeight Indexes**

```
Index 1: {userId: 1, date: 1} - UNIQUE
Purpose: Prevent duplicate weight logs for same date
Constraint: One weight per user per day
Complexity: O(log n) for lookup

Index 2: {userId: 1}
Purpose: Get all weight history for user
```

#### **6.3 ScanResult Indexes**

```
Index 1: {sourceId: 1, source: 1} - SPARSE
Purpose: Deduplication - prevent storing same food from same API twice
Example: Nutritionix food ID "abc123" only stored once

Index 2: {name: 1, brand: 1}
Purpose: Find existing food by name and brand
Use case: Avoid duplicate entries for "Piattos" by "Oishi"
```

**Index Selection Algorithm:**

- B-Tree indexes for equality and range queries
- Compound indexes for multi-field queries (leftmost prefix rule)
- Sparse indexes for optional fields (save space)
- Unique constraints for business rules

**Time Complexity:** O(log n) for indexed lookups vs O(n) for full table scan

---

## **7. DIET HISTORY AGGREGATION ALGORITHM**

**Location:** `src/utils/populateUserData.ts`

### **Concept: Relational to Document Transformation**

- **Purpose:** Convert normalized database (3NF) back to nested JSON for frontend
- **Pattern:** JOIN + GROUP BY simulation in MongoDB

### **Algorithm Steps:**

```
Input: userId
Steps:
  1. Query MealEntry collection:
     - Filter by userId
     - Populate scanResultId (JOIN with ScanResult)
     - Sort by date descending

  2. Initialize groupedByDate map: Map<date_string, DietHistory>

  3. For each mealEntry:
     a. Extract date string
     b. If date not in map, create new DietHistory object:
        {
          date: string,
          breakfast: [],
          lunch: [],
          dinner: [],
          otherMealTime: []
        }
     c. Extract scanResult data (populated)
     d. Build meal object:
        {
          id: mealEntry._id,
          name, foodName, brand, servingSize,
          ingredients, nutritionData,
          triggeredAllergens: mealEntry.triggeredAllergens,
          quantity: mealEntry.quantity
        }
     e. Push to appropriate meal array: groupedByDate[date][mealType]

  4. Convert map to array: Object.values(groupedByDate)

Output: DietHistory[] (grouped by date, sorted descending)
```

**SQL Equivalent:**

```sql
SELECT date, mealType, scanResult.*, mealEntry.quantity
FROM mealEntry
JOIN scanResult ON mealEntry.scanResultId = scanResult._id
WHERE mealEntry.userId = ?
ORDER BY date DESC
GROUP BY date, mealType
```

**Time Complexity:**

- O(n log n) for sorting
- O(n) for grouping
- Overall: O(n log n)

---

## **8. NUTRITION GROUPING ALGORITHM**

**Location:** `src/utils/ingredientsNutritionsPredict.ts`

### **Concept: AI-Powered Nutritional Classification**

- **Purpose:** Categorize nutrients into Macronutrients, Micronutrients, Other Nutrients
- **Method:** Prompt engineering with structured output

### **Algorithm Steps:**

```
Input: nutrition array [{name, value, unit}, ...]

Prompt Engineering:
  "Organize the nutrition data into three groups:
   - Macronutrients (carbs, protein, fat, fiber, sugar, calories)
   - Micronutrients (vitamins, minerals)
   - Other Nutrients (amino acids, fatty acids, etc.)"

AI Processing:
  1. Gemini analyzes nutrient names
  2. Applies domain knowledge of nutrition science
  3. Returns structured JSON:
     {
       "groupedNutrition": [
         {"title": "Macronutrients", "items": [...]},
         {"title": "Micronutrients", "items": [...]},
         {"title": "Other Nutrients", "items": [...]}
       ]
     }

Post-processing:
  1. Filter out zero or near-zero values (< 0.01)
  2. Remove empty groups
  3. Validate structure

Output: Grouped nutrition with meaningful values only
```

**Classification Examples:**

- **Macronutrients:** Protein, Carbohydrates, Total Fat, Dietary Fiber, Sugars, Calories
- **Micronutrients:** Vitamin A, Vitamin C, Calcium, Iron, Potassium, Sodium
- **Other Nutrients:** Omega-3 fatty acids, Cholesterol, Saturated Fat, Trans Fat

**Time Complexity:** O(n) where n = number of nutrients

---

## **9. NUTRITIONIX NUTRIENT MAPPING ALGORITHM**

**Location:** `src/utils/nutritionixMap.ts`

### **Concept: Hash Map Lookup for O(1) Translation**

- **Purpose:** Convert Nutritionix numeric IDs to human-readable names with units

### **Algorithm Steps:**

```
Data Structure: Constant hash map (203 entries)
Key: Nutritionix attr_id (number)
Value: {name: string, unit: string}

Example:
  203 → {name: "Protein", unit: "g"}
  208 → {name: "Energy", unit: "kcal"}
  301 → {name: "Calcium, Ca", unit: "mg"}

Algorithm:
  1. Receive full_nutrients array from Nutritionix API
  2. For each {attr_id, value}:
     a. Lookup attr_id in NUTRITIONIX_NUTRIENT_MAP
     b. If found, create {name: map.name, value: value, unit: map.unit}
     c. If not found, skip (unknown nutrient)
  3. Return normalized array

Output: [{name: "Protein", value: 25, unit: "g"}, ...]
```

**Time Complexity:** O(n) where n = number of nutrients in response

---

## **10. INGREDIENT TEXT EXTRACTION ALGORITHM**

**Location:** `src/utils/foodCameraUtils.ts`

### **Concept: Recursive Tree Traversal with Language Filtering**

- **Purpose:** Extract English ingredient names from nested Open Food Facts structure

### **Algorithm Steps:**

```
Input: ingredients array (nested tree structure from OFF API)
Structure: [{id, text, ingredients: [nested...]}]

Algorithm (Depth-First Search):
  1. Initialize result array
  2. For each ingredient object:
     a. Check if id starts with "en:" (English language code)
     b. If yes, extract text field and convert to lowercase
     c. Push to result array
     d. If ingredient has nested "ingredients" array, recurse
  3. Return flattened list of English ingredient names

Example:
  Input: [
    {id: "en:wheat", text: "Wheat"},
    {id: "en:milk", text: "Milk", ingredients: [
      {id: "en:lactose", text: "Lactose"}
    ]}
  ]
  Output: ["wheat", "milk", "lactose"]
```

**Time Complexity:** O(n) where n = total number of ingredients (including nested)

---

## **11. INGREDIENT CLEANING ALGORITHM**

**Location:** `src/utils/foodCameraUtils.ts`

### **Concept: String Normalization with Deduplication**

- **Purpose:** Clean ingredient strings for accurate allergen matching

### **Algorithm Steps:**

```
Input: Raw ingredient strings from APIs

Steps:
  1. Remove content in parentheses: /\s*\(.*?\)/g
     Example: "Wheat (enriched)" → "Wheat"

  2. Remove special characters except & and -: /[^a-zA-Z0-9&\-\s]/g
     Example: "Milk, whole" → "Milk whole"

  3. Trim whitespace

  4. Convert to lowercase

  5. Filter:
     a. Remove empty strings
     b. Remove overly long names (> 40 chars)
     c. Remove duplicates using Set

Output: Clean, unique ingredient list
```

**Time Complexity:** O(n) where n = number of ingredients

---

## **12. SESSION POPULATION ALGORITHM**

**Location:** `src/controllers/authLocalController.ts`, `authGoogleController.ts`

### **Concept: Lazy Loading with Data Enrichment**

- **Purpose:** Populate user session with denormalized data for frontend compatibility

### **Algorithm Steps:**

```
Trigger Points:
  - Login
  - Session check
  - Account onboarding
  - Google OAuth callback

Steps:
  1. Fetch base user object from UserAccount collection

  2. Call populateUserWithDynamicData(userObj):
     a. Build dietHistory:
        - Query MealEntry + ScanResult (JOIN)
        - Group by date
        - Format as nested structure
     b. Build loggedWeights:
        - Query LoggedWeight collection
        - Format as array [{value, date}, ...]

  3. Attach to user object:
     userObj.dietHistory = [...]
     userObj.loggedWeights = [...]

  4. Store enriched user in session

  5. Return to frontend

Result: Frontend receives backward-compatible user object
```

**Performance Optimization:**

- Only populate on auth endpoints (not every API call)
- Uses indexed queries for fast retrieval
- Caches in Express session

**Time Complexity:** O(m + w) where m = meal entries, w = weight logs

---

## **13. MEAL ENTRY DEDUPLICATION ALGORITHM**

**Location:** `src/controllers/accountController.ts`

### **Concept: Find-or-Create Pattern with Multi-Field Lookup**

- **Purpose:** Prevent duplicate food items in ScanResult collection

### **Algorithm Steps:**

```
Problem: Same food from different API calls or manual entry

Solution:
  1. When adding meal:
     a. Try to find existing ScanResult:
        Query 1: Match by sourceId + source (API reference)
        Query 2: Match by name + brand (manual entry)

     b. If found:
        - Use existing ScanResult._id
        - Don't create duplicate

     c. If not found:
        - Create new ScanResult
        - Store with sourceId for future deduplication

  2. Create MealEntry with reference to ScanResult

  3. Multiple users can reference same ScanResult

Benefits:
  - Storage efficiency (no duplicate food data)
  - Consistency (same food = same nutrition data)
  - Update once, reflect everywhere
```

**Time Complexity:** O(log n) for indexed lookup + O(1) for reference creation

---

## **14. DATE STRING NORMALIZATION ALGORITHM**

**Location:** `src/utils/getDateString.ts`

### **Concept: Timezone-Agnostic Date Formatting**

- **Purpose:** Consistent date strings regardless of timezone

### **Algorithm Steps:**

```
Input: Date object, ISO string, or date string

Steps:
  1. Parse input to Date object
  2. Extract components:
     - year: getFullYear()
     - month: getMonth() + 1 (zero-indexed)
     - day: getDate()
  3. Pad with leading zeros:
     - month: String(month).padStart(2, '0')
     - day: String(day).padStart(2, '0')
  4. Format: "YYYY-MM-DD"

Example:
  Input: new Date("2025-10-20T15:30:00Z")
  Output: "2025-10-20"

Benefits:
  - Consistent across all timezones
  - Sortable lexicographically
  - Database index friendly
```

**Time Complexity:** O(1)

---

## **15. AUTHENTICATION RATE LIMITING ALGORITHM**

**Location:** `src/models/UserAccount.ts`

### **Concept: Exponential Backoff for Brute Force Prevention**

- **Purpose:** Protect accounts from password guessing attacks

### **Algorithm Steps:**

```
Fields:
  - loginAttempts: number (default 0)
  - lockUntil: Date | null (default null)

Login Flow:
  1. Check if account is locked:
     if (lockUntil && lockUntil > now) {
       return error "Account locked until {lockUntil}"
     }

  2. Attempt login (password verification)

  3. If success:
     - Reset loginAttempts = 0
     - Clear lockUntil = null

  4. If failure:
     - Increment loginAttempts++
     - If loginAttempts >= 5:
       * Set lockUntil = now + 15 minutes
       * Return "Account locked for 15 minutes"
     - Else:
       * Return "Invalid password"

Unlock:
  - Automatic after lockUntil expires
  - Manual by admin (reset fields)
```

**Time Complexity:** O(1)

---

## **SUMMARY TABLE**

| Algorithm               | Purpose              | Time Complexity | Space Complexity |
| ----------------------- | -------------------- | --------------- | ---------------- |
| CNN Inference           | Food classification  | O(1) per image  | O(1)             |
| Allergen Detection      | Safety matching      | O(n)            | O(n)             |
| Nutrition Normalization | Data standardization | O(n)            | O(n)             |
| Unit Conversion         | Standardize units    | O(1)            | O(1)             |
| API Cascade             | Data retrieval       | O(k) worst case | O(1)             |
| Database Indexing       | Query optimization   | O(log n)        | O(n)             |
| Diet Aggregation        | Data transformation  | O(n log n)      | O(n)             |
| Nutrition Grouping      | AI categorization    | O(n)            | O(n)             |
| Nutrient Mapping        | ID translation       | O(n)            | O(1)             |
| Ingredient Extraction   | Text parsing         | O(n)            | O(n)             |
| Deduplication           | Storage optimization | O(log n)        | O(1)             |
| Session Population      | Data enrichment      | O(m + w)        | O(m + w)         |
| Date Normalization      | Time formatting      | O(1)            | O(1)             |
| Rate Limiting           | Security             | O(1)            | O(1)             |

**Where:**

- n = number of items (nutrients, ingredients, etc.)
- k = number of API fallback sources
- m = meal entries
- w = weight logs

---

**Last Updated:** October 20, 2025  
**Version:** 1.0
