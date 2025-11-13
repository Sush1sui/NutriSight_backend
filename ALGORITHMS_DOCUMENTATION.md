# Algorithm Documentation

This document describes all algorithms and computational concepts used in the NutriSight backend system.

---

## 🎯 Algorithm Priority Guide for Thesis

### 🔴 **CRITICAL** - Must Include in Thesis (Core CNN Food Scanner Functionality)

- **Algorithm #1**: CNN Image Classification
- **Algorithm #2**: Allergen Detection (AI + Local Mapping)
- **Algorithm #3**: Nutrition Normalization
- **Algorithm #5**: API Fallback Cascade

### 🟡 **HIGH** - Should Include in Thesis (Important Supporting Features)

- **Algorithm #4**: Unit Conversion
- **Algorithm #8**: Nutrition Grouping
- **Algorithm #6**: Database Indexing
- **Algorithm #7**: Diet Aggregation
- **Algorithm #13**: Meal Entry Deduplication

### 🟢 **MEDIUM** - Include if Space Permits (Technical Implementation)

- **Algorithm #12**: Session Population
- **Algorithm #14**: Date String Normalization
- **Algorithm #17**: Local Allergen Keyword Mapping
- **Algorithm #18**: Food Recommendation Matching

### ⚪ **LOW** - Optional (Utility Functions & Security)

- **Algorithm #9**: Nutritionix Nutrient Mapping
- **Algorithm #10**: Ingredient Text Extraction
- **Algorithm #11**: Ingredient Cleaning
- **Algorithm #15**: Authentication Rate Limiting
- **Algorithm #16**: Signup Rate Limiting

---

## **1. IMAGE CLASSIFICATION ALGORITHM**

**Priority: 🔴 CRITICAL**

**Location:** `src/utils/model_inference.ts`

**Algorithm Name:** Softmax Classification with Top-K Selection

### **Concept: Convolutional Neural Network (CNN) Inference**

**Description:** A deep learning pipeline that transforms raw food images into probability distributions over 101 Filipino food classes. The algorithm preprocesses images using ImageNet normalization standards, performs forward propagation through an ONNX neural network model, applies softmax normalization to convert logits into probabilities, and returns the top-K most confident predictions sorted by likelihood.

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

**Priority: 🔴 CRITICAL**

**Location:** `src/utils/ingredientsNutritionsPredict.ts`, `src/utils/allergenMapping.ts`, `src/controllers/cameraController.ts`

**Algorithm Name:** Dual-Layer Allergen Detection (AI + Local Mapping)

### **Concept: Semantic Matching with LLM + Comprehensive Keyword Hash Map**

**Description:** A two-tier safety system that combines AI-powered semantic understanding with deterministic local keyword matching. The primary layer uses Google Gemini AI to intelligently match ingredients against user allergens with contextual awareness (e.g., "milk chocolate" contains milk). The secondary layer employs a comprehensive hash map of 1,100+ allergen variations to catch technical terms, scientific names, and edge cases that AI might miss (e.g., "casein", "whey", "albumin"). Results are merged with deduplication to provide maximum user safety.

- **Purpose:** Identify allergens in food ingredients using dual validation
- **Method:** AI Natural Language Processing + Deterministic Keyword Matching

### **Algorithm Steps:**

#### **2.1 AI-Powered Detection (Gemini API)**

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
  5. Filter AI-detected allergens:
     - Only match single, simple ingredient names
     - Ingredient must exist in ingredients array
     - Allergen must match user's allergen list

AI Output: {
  ingredients: string[],
  triggeredAllergens: [{ingredient, allergen}],
  groupedNutrition: [...]
}
```

#### **2.2 Local Keyword Mapping (Deterministic Validation)**

```
Input: ingredients, userAllergens

Data Structure: allergenKeywordMapping<string, string[]> = {
  "peanuts": ["peanut", "groundnut", "arachis oil", "beer nuts", ...],  // 39 variations
  "milk": ["milk", "dairy", "whey", "casein", "lactose", "cheese", ...], // 115+ variations
  "eggs": ["egg", "albumin", "mayonnaise", "meringue", "lecithin", ...], // 61 variations
  "soy": ["soy", "tofu", "tempeh", "edamame", "miso", "tamari", ...],    // 68 variations
  "wheat": ["wheat", "flour", "bread", "pasta", "gluten", ...],           // 106 variations
  "fish": ["fish", "salmon", "tuna", "anchovy", "caviar", ...],           // 103 variations
  "sesame": ["sesame", "tahini", "gomasio", "halvah", ...],               // 31 variations
  "sulfites": ["sulfite", "sulfur dioxide", "e220", "wine", ...],         // 36 variations
  "celery": ["celery", "celeriac", "celery salt", "lovage", ...],         // 16 variations
  "mustard": ["mustard", "dijon", "wasabi", "horseradish", ...],          // 40 variations
  "lupin": ["lupin", "lupini beans", "lupinus", ...],                     // 13 variations
  "molluscs": ["clam", "mussel", "oyster", "squid", "octopus", ...],      // 37 variations
  "gluten": ["gluten", "wheat", "barley", "rye", "malt", "beer", ...],    // 52 variations
  "lactose": ["lactose", "milk sugar", "dairy", "whey", ...],             // 28 variations
  "fructose": ["fructose", "HFCS", "honey", "agave", "apple", ...],       // 38 variations
  "histamine": ["aged cheese", "fermented", "wine", "salami", ...],       // 90+ variations
  "nightshades": ["tomato", "potato", "eggplant", "pepper", ...],         // 81 variations
  "dairy": ["milk", "cheese", "yogurt", "butter", "cream", ...],          // 70 variations
}
// Total: 1,100+ keyword variations across 18 allergen categories

Steps:
  1. Normalize ingredients to lowercase: ingredientsLower[]
  2. For each userAllergen:
     a. Get keyword array from allergenKeywordMapping (O(1) hash lookup)
     b. Skip if allergen is "none" or "no allergies"
     c. For each ingredient (original casing):
        - For each keyword:
          • Check: ingredient.includes(keyword) OR keyword.includes(ingredient)
          • If match found:
            * Add {ingredient: original, allergen: original} to results
            * Break to next ingredient (avoid duplicates per ingredient)

Local Output: [{ingredient, allergen}, ...]
```

#### **2.3 Result Merging (Deduplication)**

```
Purpose: Combine AI and local results without duplicates
Input: aiAllergens[], localAllergens[], userAllergens[]

Steps:
  1. Initialize merged[] = [...aiAllergens]
  2. Create existingKeys = Set<string>
  3. For each AI allergen:
     - Add "ingredient:allergen" (lowercase) to existingKeys
  4. For each local allergen:
     - Create key = "ingredient:allergen" (lowercase)
     - If key NOT in existingKeys:
       * Add to merged[]
       * Add key to existingKeys

Final Output: merged[] (no duplicates)

Example:
  AI Results:    [{ingredient: "milk", allergen: "dairy"}]
  Local Results: [{ingredient: "milk", allergen: "dairy"},
                  {ingredient: "whey protein", allergen: "milk"}]
  Merged:        [{ingredient: "milk", allergen: "dairy"},
                  {ingredient: "whey protein", allergen: "milk"}]
```

**Benefits of Dual-Layer Approach:**

1. **AI Layer**: Contextual understanding, handles variations naturally
2. **Local Layer**: Comprehensive coverage, catches technical terms, deterministic
3. **Redundancy**: If AI fails/errors, local mapping provides safety net
4. **Cost-Effective**: Local checks are free and instant
5. **Reliability**: Not dependent solely on API uptime or AI accuracy

**Key Rules:**

- No full phrases or grouped ingredients in allergen matching
- Ingredient name in triggeredAllergens MUST exist in ingredients array
- Case-insensitive matching for flexibility

**Time Complexity:** O(n) where n = number of ingredients

---

## **3. NUTRITION DATA NORMALIZATION ALGORITHM**

**Priority: 🔴 CRITICAL**

**Location:** `src/utils/foodCameraUtils.ts`

**Algorithm Name:** Priority-Based Consolidation with Map Deduplication

### **Concept: Data Deduplication and Standardization**

**Description:** A multi-stage data cleaning pipeline that reconciles nutritional information from heterogeneous API sources (USDA, Nutritionix, Open Food Facts) into a unified, conflict-free format. The algorithm employs priority-based consolidation to resolve duplicate energy fields, uses case-insensitive Map-based deduplication to eliminate redundant nutrients while preserving the highest values, and extracts unit information with intelligent defaulting. This ensures consistent, reliable nutrition data regardless of source.

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

**Priority: 🟡 HIGH**

**Location:** `src/utils/convertToGrams.ts`

**Algorithm Name:** Density-Aware Unit Normalization

### **Concept: Multi-System Unit Conversion with Density Tables**

**Description:** A comprehensive unit standardization system that converts diverse measurement units (metric, imperial, volume) into a uniform gram-based representation. The algorithm handles direct mass conversions through multiplication factors, performs context-aware volume-to-mass transformations using a 45-entry density lookup table for substances like milk, oil, and honey, and applies nutrient-specific formulas for International Units (IU) based on vitamin types. This enables accurate nutritional comparisons and calculations across different measurement systems.

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

**Priority: 🔴 CRITICAL**

**Location:** `src/controllers/cameraController.ts`

**Algorithm Name:** Waterfall Pattern with Graceful Degradation

### **Concept: Multi-Source Data Retrieval with Graceful Degradation**

**Description:** A fault-tolerant data acquisition strategy that attempts food data retrieval from multiple sources in priority order, gracefully degrading through progressively less accurate but more available alternatives. The algorithm follows the waterfall pattern: starting with authoritative sources (USDA), falling back to commercial databases (Nutritionix), then crowd-sourced data (Open Food Facts), and finally AI-generated estimates (Gemini). Each tier performs full data validation, normalization, and enrichment before either returning results or cascading to the next source, maximizing availability while optimizing for accuracy and cost.

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

**Priority: � HIGH**

**Location:** Model files (`src/models/`)

**Algorithm Name:** B-Tree Compound Indexing with Leftmost Prefix Rule

### **Concept: Compound Indexes for Query Optimization**

**Description:** A strategic indexing architecture that leverages MongoDB's B-Tree index structures and compound indexing to dramatically reduce query execution times. The algorithm employs the leftmost prefix rule for multi-field queries (userId + date + mealType), uses sparse indexes to conserve storage on optional fields, implements unique constraints to enforce business logic (one weight per user per day), and creates targeted indexes for common access patterns like date-range queries and foreign key lookups. This transforms O(n) collection scans into O(log n) index seeks.

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

**Priority: � HIGH**

**Location:** `src/utils/populateUserData.ts`

**Algorithm Name:** Hash Map Grouping with Population (JOIN)

### **Concept: Relational to Document Transformation**

**Description:** A data denormalization pipeline that reconstructs hierarchical diet history documents from normalized relational tables, simulating SQL JOIN and GROUP BY operations in MongoDB. The algorithm performs population (JOIN) between MealEntry and ScanResult collections, accumulates entries into a hash map grouped by date strings, organizes meals into structured breakfast/lunch/dinner/snack categories, and converts the map into a sorted array. This transformation maintains API backward compatibility by presenting normalized 3NF data in the legacy embedded document format expected by the frontend.

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

**Priority: 🟡 HIGH**

**Location:** `src/utils/ingredientsNutritionsPredict.ts`

**Algorithm Name:** Prompt-Driven Categorical Classification

### **Concept: AI-Powered Nutritional Classification**

**Description:** An intelligent nutrient categorization system that uses Gemini AI's domain knowledge of nutrition science to automatically organize raw nutrient data into scientifically meaningful groups. The algorithm constructs precise prompts defining macronutrient (carbs, proteins, fats), micronutrient (vitamins, minerals), and other nutrient (amino acids, fatty acids) categories, parses the AI's structured JSON response, filters out negligible values (< 0.01), and removes empty groups. This automated classification eliminates the need for hardcoded nutrient categorization rules while adapting to new or uncommon nutrients.

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

**Priority: ⚪ LOW**

**Location:** `src/utils/nutritionixMap.ts`

**Algorithm Name:** Direct Hash Map Translation

### **Concept: Hash Map Lookup for O(1) Translation**

**Description:** A constant-time translation layer that converts Nutritionix's proprietary numeric attribute IDs into standardized human-readable nutrient names with appropriate units. The algorithm maintains a comprehensive 203-entry hash map derived from USDA's FoodData Central nutrient database, performs direct key lookups for each nutrient in the API response, and constructs normalized nutrient objects with correct units (g, mg, µg, IU). This decoupling allows the application to work with semantic nutrient names while efficiently processing Nutritionix's compact numeric format.

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

**Priority: ⚪ LOW**

**Location:** `src/utils/foodCameraUtils.ts`

**Algorithm Name:** Depth-First Search (DFS) with Language Filtering

### **Concept: Recursive Tree Traversal with Language Filtering**

**Description:** A depth-first tree traversal algorithm that navigates Open Food Facts' hierarchical ingredient taxonomy to extract English-language ingredient names while ignoring non-English entries. The algorithm recursively explores nested ingredient structures (e.g., "milk" containing "lactose", "whey"), validates language codes using the "en:" prefix pattern, accumulates text values into a flat array, and handles arbitrary nesting depths. This flattening process converts complex ingredient hierarchies into simple lists suitable for allergen matching and display.

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

**Priority: ⚪ LOW**

**Location:** `src/utils/foodCameraUtils.ts`

**Algorithm Name:** Regex-Based Sanitization with Set Deduplication

### **Concept: String Normalization with Deduplication**

**Description:** A multi-stage text sanitization pipeline that transforms raw, inconsistent ingredient strings from various APIs into clean, standardized forms suitable for exact matching. The algorithm applies regex-based parenthetical content removal to eliminate qualifiers like "(enriched)", strips special characters while preserving meaningful delimiters (& and -), normalizes whitespace and casing, filters out noise (empty strings, excessively long names > 40 chars), and uses Set-based deduplication to ensure uniqueness. This produces a canonical ingredient list optimized for reliable allergen detection.

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

**Priority: � MEDIUM**

**Location:** `src/controllers/authLocalController.ts`, `authGoogleController.ts`

**Algorithm Name:** Lazy Loading with Parallel Data Hydration

### **Concept: Lazy Loading with Data Enrichment**

**Description:** A selective data hydration strategy that enriches minimal user account records with related data on-demand during authentication events. The algorithm triggers only at strategic checkpoints (login, session validation, OAuth callback), fetches the base UserAccount document, executes parallel queries to retrieve associated MealEntry and LoggedWeight records using indexed lookups, transforms the relational data into nested structures via aggregation functions, and attaches the enriched data to the session object. This balances performance (loads data once per session) with memory efficiency (avoids storing redundant data in UserAccount).

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

**Priority: � HIGH**

**Location:** `src/controllers/accountController.ts`

**Algorithm Name:** Find-or-Create Pattern with Composite Key Matching

### **Concept: Find-or-Create Pattern with Multi-Field Lookup**

**Description:** A database normalization technique that maintains a single canonical representation of each unique food item across all users and meal entries. The algorithm attempts to locate existing ScanResult records using a two-pronged search strategy: first by external API reference (sourceId + source) for API-sourced foods, then by semantic identity (name + brand) for manual entries. Upon finding a match, it reuses the existing record's ID; otherwise, it creates a new ScanResult and stores the sourceId for future deduplication. This approach dramatically reduces storage redundancy and ensures data consistency.

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

**Priority: 🟡 HIGH**

**Location:** `src/utils/getDateString.ts`

**Algorithm Name:** ISO 8601 Date Normalization with Zero-Padding

### **Concept: Timezone-Agnostic Date Formatting**

**Description:** A timezone-independent date normalization utility that converts diverse date representations (Date objects, ISO strings, custom formats) into a canonical YYYY-MM-DD string format. The algorithm extracts date components using local time methods (avoiding timezone shifts), applies zero-padding to month and day values for consistent length, and produces lexicographically sortable strings. This standardization is critical for database indexing, date-based queries, and ensuring that users in different timezones reference the same logical calendar date for meal logging.

- **Purpose:** Consistent date strings regardless of timezone

### **Algorithm Steps:**

```
Input: ISO date string or date string

Steps:
  1. Extract date portion from ISO string using regex: /^(\d{4}-\d{2}-\d{2})/
  2. If match found, return the YYYY-MM-DD part directly
  3. Fallback: Parse to Date object and convert to ISO, then slice
  4. Format: "YYYY-MM-DD"

Example:
  Input: "2025-10-20T15:30:00+08:00"
  Output: "2025-10-20"

  Input: "2025-10-20T15:30:00Z"
  Output: "2025-10-20"

Benefits:
  - Timezone-agnostic (works regardless of server location)
  - Preserves user's local date from ISO string
  - Sortable lexicographically
  - Database index friendly
```

**Time Complexity:** O(1)

---

## **15. AUTHENTICATION RATE LIMITING ALGORITHM**

**Priority: ⚪ LOW**

**Location:** `src/models/UserAccount.ts`

**Algorithm Name:** Stateful Counter with Time-Based Lockout

### **Concept: Exponential Backoff for Brute Force Prevention**

**Description:** A security mechanism that defends against brute-force password attacks by temporarily locking accounts after repeated failed login attempts. The algorithm maintains stateful counters (loginAttempts) and timestamps (lockUntil) for each account, checks lock status before authentication, increments failure counters on invalid passwords, triggers a 15-minute lockout after 5 failed attempts, and automatically resets counters upon successful login. This rate-limiting approach makes automated password guessing computationally infeasible while allowing legitimate users to recover from typos.

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

## **16. SIGNUP RATE LIMITING ALGORITHM**

**Priority: ⚪ LOW**

**Location:** `src/utils/mongoRateLimit.ts`, `src/models/Rate.ts`, `src/controllers/authLocalController.ts`

**Algorithm Name:** Sliding Window Counter with TTL-Based Expiration

### **Concept: MongoDB-Backed Rate Limiting with Automatic Cleanup**

**Description:** A distributed rate-limiting system that prevents signup spam and abuse by tracking request counts per IP address and email using MongoDB as a persistent store. The algorithm implements sliding window counters that expire after configurable time windows, uses atomic findOneAndUpdate operations to prevent race conditions in concurrent environments, leverages MongoDB TTL indexes for automatic document cleanup when windows expire, and employs a fail-open strategy to maintain availability even if the rate limiter encounters errors. This approach eliminates the need for Redis while providing reliable, scalable rate limiting suitable for multi-instance deployments.

- **Purpose:** Prevent spam account creation and OTP abuse
- **Storage:** MongoDB with TTL indexes (no Redis required)
- **Pattern:** Sliding window with atomic increments

### **Algorithm Steps:**

#### **16.1 Rate Model (MongoDB Schema)**

```
Collection: rates

Schema:
  - key: string (unique) - Format: "signup:ip:xxx.xxx.xxx.xxx" or "signup:email:user@example.com"
  - count: number (default: 0) - Number of requests in current window
  - createdAt: Date (default: Date.now) - Window start time
  - expireAt: Date - Absolute expiration timestamp

Indexes:
  1. { key: 1 } - Unique constraint for fast lookups
  2. { expireAt: 1 } - TTL index (expireAfterSeconds: 0)
     → MongoDB automatically deletes docs when expireAt <= now

Benefits:
  - Automatic cleanup (no manual sweeping)
  - Distributed consistency (shared state across app instances)
  - Persistent (survives app restarts)
  - No external dependencies (Redis-free)
```

#### **16.2 Get Current Count**

```
Input: key (string), windowSeconds (number)

Algorithm (getKeyValue):
  1. Query: Rate.findOne({ key })

  2. If no document found:
     return 0 (never seen before)

  3. If document.expireAt exists:
     a. If expireAt <= now:
        return 0 (window expired, treat as reset)
     b. Else:
        return document.count (within window)

  4. If no expireAt (legacy docs):
     a. Calculate age: now - document.createdAt
     b. If age > windowSeconds * 1000:
        return 0 (window expired)
     c. Else:
        return document.count

Output: Current count for this key (0 if expired)
```

#### **16.3 Increment Counter (Atomic)**

```
Input: key (string), windowSeconds (number)

Algorithm (incrementKey):
  1. Calculate timestamps:
     now = new Date()
     expireAt = new Date(now + windowSeconds * 1000)

  2. Attempt atomic increment (non-expired docs only):
     query = {
       key,
       $or: [
         { expireAt: { $exists: false } },  // legacy docs
         { expireAt: { $gt: now } }         // not yet expired
       ]
     }
     update = { $inc: { count: 1 } }
     options = { new: true }

     result = Rate.findOneAndUpdate(query, update, options)

  3. If increment succeeded (result != null):
     return result.count

  4. If increment failed (window expired or first request):
     Reset counter with upsert:
     query = { key }
     update = {
       $set: {
         count: 1,
         createdAt: now,
         expireAt
       }
     }
     options = { upsert: true, new: true }

     result = Rate.findOneAndUpdate(query, update, options)
     return result.count || 1

Output: New count after increment
```

#### **16.4 Rate Limiting Check (sendOtp)**

```
Purpose: Prevent OTP spam (per-email and per-IP)

Configuration (env vars with defaults):
  - EMAIL_WINDOW: 3600 seconds (1 hour)
  - MAX_PER_EMAIL: 3 attempts
  - IP_WINDOW: 3600 seconds (1 hour)
  - MAX_PER_IP: 20 attempts

Algorithm:
  1. Extract identifiers:
     email = req.body.email.toLowerCase()
     ip = req.headers['x-forwarded-for'] || req.ip

  2. Build keys:
     emailKey = "signup:email:" + email
     ipKey = "signup:ip:" + ip

  3. Check email limit:
     emailCount = await getKeyValue(emailKey, EMAIL_WINDOW)
     if (emailCount >= MAX_PER_EMAIL):
       return 429 "Too many signup attempts for this email"

  4. Check IP limit:
     ipCount = await getKeyValue(ipKey, IP_WINDOW)
     if (ipCount >= MAX_PER_IP):
       return 429 "Too many signup attempts from this IP"

  5. Increment both counters (atomic):
     await incrementKey(emailKey, EMAIL_WINDOW)
     await incrementKey(ipKey, IP_WINDOW)

  6. Proceed with OTP generation and email

Error Handling (Fail-Open):
  - All rate limit operations wrapped in try-catch
  - On error: log warning and continue (don't block user)
  - Rationale: Prefer availability over strict limiting
```

#### **16.5 Rate Limiting Check (register)**

```
Purpose: Prevent mass account creation from single IP

Configuration (env vars with defaults):
  - IP_WINDOW: 600 seconds (10 minutes)
  - MAX_PER_IP: 500 accounts

Algorithm:
  1. Extract IP:
     ip = req.headers['x-forwarded-for'] || req.ip

  2. Build key:
     ipKey = "signup:ip:" + ip

  3. Check IP limit:
     ipCount = await getKeyValue(ipKey, IP_WINDOW)
     if (ipCount >= MAX_PER_IP):
       return 429 "Too many account creations from this IP"

  4. Increment counter (atomic):
     await incrementKey(ipKey, IP_WINDOW)

  5. Proceed with account creation

Design Rationale (IP-only for register):
  - Allows multiple users behind same NAT (home WiFi, office)
  - High MAX_PER_IP (500) accommodates legitimate shared networks
  - Per-email not needed (already unique in DB)
  - Focuses on preventing automated bot attacks
```

### **Key Design Decisions**

#### **1. Why MongoDB over Redis?**

```
Advantages:
  ✅ No additional infrastructure (already using Mongo)
  ✅ Persistent across restarts (Redis volatile by default)
  ✅ Simpler deployment (one less service)
  ✅ TTL indexes handle cleanup automatically
  ✅ Sufficient performance for moderate traffic

Trade-offs:
  ⚠️ Slightly higher latency than Redis (milliseconds)
  ⚠️ More disk I/O (less critical for infrequent writes)

Suitable for:
  - Small to medium scale (< 1000 req/sec)
  - Applications already using MongoDB
  - Cost-sensitive deployments
```

#### **2. Why Fail-Open Strategy?**

```
Philosophy: Availability > Strict Security

Reasoning:
  - Rate limiter failure shouldn't block legitimate users
  - False positives worse than false negatives for signup
  - Logs still capture errors for investigation
  - Other security layers exist (email verification, account lockout)

Implementation:
  try {
    // rate limit check
  } catch (err) {
    console.warn("Rate limit check failed:", err)
    // continue anyway (fail-open)
  }
```

#### **3. Why TTL Index over Cron Cleanup?**

```
TTL Index (Chosen):
  ✅ Automatic (no cron jobs)
  ✅ Built-in MongoDB feature
  ✅ Runs in background (non-blocking)
  ✅ Efficient (only removes expired docs)

Cron Cleanup (Alternative):
  ⚠️ Requires job scheduler
  ⚠️ Manual implementation
  ⚠️ Potential for accumulation between runs
  ⚠️ Additional complexity

TTL Limitation:
  - Cleanup may lag by 60 seconds (MongoDB background task)
  - Acceptable for rate limiting use case
```

#### **4. Why Separate Windows for sendOtp vs register?**

```
sendOtp:
  - Per-email: 3 requests / 1 hour
  - Per-IP: 20 requests / 1 hour
  - Rationale: Prevent OTP enumeration and email bombing

register:
  - Per-IP: 500 accounts / 10 minutes
  - Rationale: Stop automated bot signups while allowing shared IPs

Different threat models:
  - sendOtp: Targets individual users (harassment, enumeration)
  - register: Targets infrastructure (spam accounts, abuse)
```

### **Time Complexity Analysis**

| Operation         | Complexity | Notes                           |
| ----------------- | ---------- | ------------------------------- |
| getKeyValue       | O(log n)   | Indexed key lookup              |
| incrementKey      | O(log n)   | Indexed update + atomic counter |
| TTL cleanup       | O(1)       | Background process, amortized   |
| Rate limit check  | O(log n)   | Two indexed lookups             |
| Worst case (cold) | O(log n)   | Index creation on first query   |

**Where n = number of active rate limit keys (typically < 10,000)**

### **Space Complexity**

```
Per Rate Document: ~150 bytes
  - _id: 12 bytes (ObjectId)
  - key: ~40 bytes (string with prefix)
  - count: 8 bytes (number)
  - createdAt: 8 bytes (Date)
  - expireAt: 8 bytes (Date)
  - Indexes: ~50 bytes
  - MongoDB overhead: ~20 bytes

Example Storage (1000 active sessions):
  1000 docs × 150 bytes = 150 KB

TTL Cleanup Impact:
  - Max lifetime: windowSeconds (600-3600 sec)
  - Auto-deleted after expireAt
  - Steady state: only active windows stored
```

### **Monitoring & Tuning**

#### **Key Metrics to Track**

```javascript
// Log rate limit hits
if (count >= MAX_PER_IP) {
  console.warn("Rate limit hit", {
    key: ipKey,
    count,
    max: MAX_PER_IP,
    timestamp: new Date(),
  });
}

// Monitor rate collection size
db.rates.stats(); // Check totalSize, count, avgObjSize

// Track 429 responses
// (can integrate with monitoring tools like Datadog, Sentry)
```

#### **Tuning Guidelines**

```
Too many 429 errors:
  → Increase MAX_PER_IP / MAX_PER_EMAIL
  → Increase WINDOW_SECONDS (longer window = more lenient)

Spam getting through:
  → Decrease MAX_PER_IP / MAX_PER_EMAIL
  → Add CAPTCHA for high-risk IPs
  → Implement device fingerprinting

Collection growing too large:
  → Verify TTL index is active: db.rates.getIndexes()
  → Check expireAt values are being set
  → Reduce WINDOW_SECONDS to expire faster

Performance degradation:
  → Add compound index if querying by multiple fields
  → Consider migrating to Redis for > 1000 req/sec
  → Use MongoDB replica set for read scaling
```

### **Security Considerations**

#### **IP Spoofing Prevention**

```javascript
// Trust proxy setting (Heroku, AWS ALB, etc.)
app.set("trust proxy", 1);

// Extract real IP (respects X-Forwarded-For)
const ip =
  (req.headers["x-forwarded-for"] as string) ||
  req.socket?.remoteAddress ||
  req.ip ||
  "unknown";

// Fallback for missing IP
if (ip === "unknown") {
  // Can choose to block or allow (currently allows)
  console.warn("Unable to determine client IP");
}
```

#### **Distributed Attack Mitigation**

```
Single IP attack:
  ✅ Blocked by IP rate limit

Distributed attack (botnet with many IPs):
  ⚠️ Harder to detect with IP-only limiting

Additional defenses:
  - Email verification (required)
  - CAPTCHA on suspicious activity
  - Behavioral analysis (request patterns)
  - Cloudflare / WAF (DDoS protection)
```

#### **Privacy Considerations**

```
IP Address Storage:
  - Hashed in key (not stored in plaintext)
  - Auto-deleted after window expires (TTL)
  - GDPR compliance: minimal retention, legitimate interest

Email Storage:
  - Hashed in key (lowercased for consistency)
  - Tied to actual user account (already stored)
  - No additional PII collected
```

---

## **17. LOCAL ALLERGEN KEYWORD MAPPING ALGORITHM**

**Priority: 🟡 MEDIUM**

**Location:** `src/utils/allergenMapping.ts`

**Algorithm Name:** Hash Map-Based Keyword Matching with Bidirectional Search

### **Concept: Comprehensive Keyword Database with O(1) Lookups**

**Description:** A deterministic allergen detection system built on a hash map of 1,100+ keyword variations across 18 allergen categories. The algorithm provides a safety net for AI-based detection by using comprehensive keyword matching that includes scientific names, brand names, international terms, processed forms, and common dishes containing allergens. It performs case-insensitive, bidirectional substring matching (ingredient.includes(keyword) OR keyword.includes(ingredient)) to catch both exact matches and partial matches while maintaining O(1) average-case hash map lookups.

- **Purpose:** Provide deterministic allergen detection as a safety layer
- **Method:** Hash map keyword matching with bidirectional substring search

### **Data Structure**

```typescript
allergenKeywordMapping: {
  "peanuts": string[],    // 39 variations
  "milk": string[],       // 115+ variations
  "eggs": string[],       // 61 variations
  "soy": string[],        // 68 variations
  "wheat": string[],      // 106 variations
  "fish": string[],       // 103 variations
  "sesame": string[],     // 31 variations
  "sulfites": string[],   // 36 variations
  "celery": string[],     // 16 variations
  "mustard": string[],    // 40 variations
  "lupin": string[],      // 13 variations
  "molluscs": string[],   // 37 variations
  "gluten": string[],     // 52 variations
  "lactose": string[],    // 28 variations
  "fructose": string[],   // 38 variations
  "histamine": string[],  // 90+ variations
  "nightshades": string[],// 81 variations
  "dairy": string[]       // 70 variations
}

Total: 1,100+ keyword variations
```

### **Algorithm Steps**

```
Function: hasAllergen(ingredients: string[], userAllergens: string[]): boolean

Input:
  - ingredients: string[] (food ingredient list)
  - userAllergens: string[] (user's allergen profile)

Steps:
  1. Normalize ingredients:
     ingredientsLower = ingredients.map(i => i.toLowerCase())

  2. For each userAllergen in userAllergens:
     a. Skip if allergen is "none" or "no allergies"

     b. Get keywords from hash map (O(1) lookup):
        keywords = allergenKeywordMapping[userAllergen.toLowerCase()]

     c. If keywords not found, skip allergen

     d. For each ingredient (original case) in ingredients:
        - For each keyword in keywords:
          • Check bidirectional match:
            IF ingredientsLower[i].includes(keyword)
            OR keyword.includes(ingredientsLower[i])
          • If match found:
            * Return true (allergen detected)
            * Break to next allergen

  3. If no matches found:
     Return false (no allergens detected)

Output: boolean (true = allergen present, false = safe)
```

### **Function: getTriggeredAllergens**

```
Function: getTriggeredAllergens(
  ingredients: string[],
  userAllergens: string[]
): Array<{ingredient: string, allergen: string}>

Input: Same as hasAllergen()

Steps:
  1. Initialize triggeredAllergens = []
  2. Normalize ingredients to lowercase
  3. For each userAllergen:
     a. Get keywords from hash map
     b. For each ingredient:
        - For each keyword:
          • If bidirectional match found:
            * Push {ingredient: original, allergen: original}
            * Break to next ingredient (avoid duplicates)
  4. Return triggeredAllergens[]

Output: Detailed list of ingredient-allergen pairs

Example:
  Input:
    ingredients = ["milk chocolate", "whey protein", "flour"]
    userAllergens = ["milk", "dairy"]

  Output:
    [
      {ingredient: "milk chocolate", allergen: "milk"},
      {ingredient: "milk chocolate", allergen: "dairy"},
      {ingredient: "whey protein", allergen: "milk"},
      {ingredient: "whey protein", allergen: "dairy"}
    ]
```

### **Keyword Coverage Examples**

```
Milk (115+ variations):
  - Base: milk, dairy, cream, butter
  - Scientific: casein, whey, lactose, lactalbumin
  - Products: cheese, yogurt, ice cream, kefir
  - International: ghee, paneer, queso, fromage
  - Hidden: nonfat milk solids, milk powder, curds

Wheat (106 variations):
  - Base: wheat, flour, bread, pasta
  - Scientific: triticum, gluten
  - Types: durum, semolina, spelt, kamut
  - Products: couscous, seitan, bulgur
  - Hidden: wheat starch, wheat germ

Fish (103 variations):
  - Types: salmon, tuna, cod, mackerel, sardine
  - Products: fish sauce, anchovy paste, caviar
  - International: bonito, surimi, fish stock
  - Scientific: pisces
  - Hidden: worcestershire sauce (contains anchovy)
```

### **Time Complexity Analysis**

```
Best Case: O(1)
  - Single ingredient, first keyword matches immediately
  - Hash map lookup is O(1)

Average Case: O(n × m × k)
  Where:
    n = number of ingredients (typically 5-20)
    m = number of user allergens (typically 1-5)
    k = average keywords per allergen (typically 20-60)

  Example:
    10 ingredients × 3 allergens × 40 keywords = 1,200 comparisons
    Still very fast (< 1ms on modern hardware)

Worst Case: O(n × m × k)
  - All ingredients checked against all keywords
  - No early termination
  - Still efficient due to simple string operations

Hash Map Lookup: O(1) average case
  - Direct key access to keyword array
  - No iteration through allergen list
```

### **Space Complexity**

```
Static Data: O(1)
  - allergenKeywordMapping is pre-defined
  - 1,100 keywords × ~15 bytes avg = ~16 KB
  - Loaded once at module import

Runtime: O(n + m)
  - ingredientsLower array: O(n)
  - triggeredAllergens result: O(n × m) worst case
  - No dynamic memory allocation in core loop

Total: O(n + m) runtime + O(1) static
```

### **Benefits Over AI-Only Detection**

```
1. Deterministic:
   - Same input always produces same output
   - No API rate limits or failures
   - No token costs

2. Comprehensive:
   - 1,100+ variations vs AI's contextual understanding
   - Catches technical/scientific terms AI might miss
   - Includes regional and international names

3. Fast:
   - Sub-millisecond execution
   - No network latency
   - No API dependency

4. Safety Net:
   - Works when AI fails or errors
   - Redundancy for critical health feature
   - Can operate offline

5. Cost-Effective:
   - Zero API costs
   - Unlimited usage
   - No rate limiting
```

### **Integration with AI Detection**

```
mergeAllergenDetection(
  geminiAllergens: Array,
  ingredients: string[],
  userAllergens: string[]
): Array {
  // Step 1: Get AI results
  const merged = [...geminiAllergens];

  // Step 2: Get local mapping results
  const localAllergens = getTriggeredAllergens(ingredients, userAllergens);

  // Step 3: Deduplicate using Set
  const existingKeys = new Set(
    merged.map(a => `${a.ingredient}:${a.allergen}`.toLowerCase())
  );

  // Step 4: Add unique local results
  for (const local of localAllergens) {
    const key = `${local.ingredient}:${local.allergen}`.toLowerCase();
    if (!existingKeys.has(key)) {
      merged.push(local);
      existingKeys.add(key);
    }
  }

  return merged; // Combined results without duplicates
}
```

---

## **18. FOOD RECOMMENDATION MATCHING ALGORITHM**

**Priority: 🟡 MEDIUM**

**Location:** `src/controllers/accountController.ts`

**Algorithm Name:** Meal-Specific Macro Range Filtering with Allergen Exclusion

### **Concept: Meal-Categorized Nutrient Matching with Safety Filtering**

**Description:** A personalized food recommendation system that queries the local Foods database to suggest suitable meals based on the user's daily macro targets and allergen profile. The algorithm distributes daily macro goals across four meal types using frontend-aligned percentages (Breakfast: 25%, Lunch: 35%, Dinner: 30%, Snacks: 10%), establishes a flexible range of 50-150% around each meal's target macros, iterates through the food database to match foods against each meal type's requirements, filters results using the local allergen mapping system, and returns categorized food name recommendations.

- **Purpose:** Suggest meal-specific foods matching user's daily nutritional goals without allergens
- **Method:** Meal-categorized database query with macro range filtering and allergen exclusion

### **Algorithm Steps**

```
Endpoint: GET /account/recommend-foods
Authentication: Required (JWT session)

Input:
  - User session (contains dailyRecommendation and allergens)

Steps:
  1. Extract user data from session:
     const { dailyRecommendation, allergens } = req.user;

  2. Calculate per-meal macro targets based on meal distribution:
     mealTargets = {
       breakfast: {
         calories: dailyRecommendation.calories * 0.25,
         carbs: dailyRecommendation.carbs * 0.25,
         protein: dailyRecommendation.protein * 0.25,
         fat: dailyRecommendation.fat * 0.25
       },
       lunch: {
         calories: dailyRecommendation.calories * 0.35,
         carbs: dailyRecommendation.carbs * 0.35,
         protein: dailyRecommendation.protein * 0.35,
         fat: dailyRecommendation.fat * 0.35
       },
       dinner: {
         calories: dailyRecommendation.calories * 0.3,
         carbs: dailyRecommendation.carbs * 0.3,
         protein: dailyRecommendation.protein * 0.3,
         fat: dailyRecommendation.fat * 0.3
       },
       snacks: {
         calories: dailyRecommendation.calories * 0.1,
         carbs: dailyRecommendation.carbs * 0.1,
         protein: dailyRecommendation.protein * 0.1,
         fat: dailyRecommendation.fat * 0.1
       }
     }

  3. Initialize categorized recommendations:
     recommendations = {
       breakfast: [] as string[],
       lunch: [] as string[],
       dinner: [] as string[],
       snacks: [] as string[]
     }

  4. Query all foods from database:
     foods = await FoodModel.find({}).lean();

  5. For each food in database:
     a. Check for allergen conflicts:
        if (hasAllergen(food.common_ingredients, allergens)) {
          continue; // Skip this food
        }

     b. Extract macros from nutrition array:
        foodCalories = getNutritionValue("calories")
        foodCarbs = getNutritionValue("carbohydrates")
        foodProtein = getNutritionValue("protein")
        foodFat = getNutritionValue("fat")

     c. For each meal type (breakfast, lunch, dinner, snacks):
        - Check if food matches meal target (50-150% range):
          if (foodCalories >= target.calories * 0.5 &&
              foodCalories <= target.calories * 1.5 &&
              foodCarbs >= target.carbs * 0.5 &&
              foodCarbs <= target.carbs * 1.5 &&
              foodProtein >= target.protein * 0.5 &&
              foodProtein <= target.protein * 1.5 &&
              foodFat >= target.fat * 0.5 &&
              foodFat <= target.fat * 1.5) {
            recommendations[mealType].push(food.name);
          }

  6. Limit results to 10 foods per meal type:
     recommendations.breakfast = recommendations.breakfast.slice(0, 10);
     recommendations.lunch = recommendations.lunch.slice(0, 10);
     recommendations.dinner = recommendations.dinner.slice(0, 10);
     recommendations.snacks = recommendations.snacks.slice(0, 10);

  7. Return categorized recommendations:
     res.json({
       message: "Daily recommendations retrieved",
       recommendations,
       mealDistribution: {
         breakfast: "25%",
         lunch: "35%",
         dinner: "30%",
         snacks: "10%"
       }
     });

Output: {
  message: string,
  recommendations: {
    breakfast: string[],
    lunch: string[],
    dinner: string[],
    snacks: string[]
  },
  mealDistribution: {
    breakfast: "25%",
    lunch: "35%",
    dinner: "30%",
    snacks: "10%"
  }
}
```

### **Example Request/Response**

```
GET /account/recommend-foods
Authorization: Bearer <token>

User Data:
  dailyRecommendation: {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 67
  }
  allergens: ["milk", "peanuts"]

Calculated Targets:
  breakfast: {
    calories: 500 (range: 250-750),
    protein: 37.5g (range: 18.75-56.25),
    carbs: 50g (range: 25-75),
    fat: 16.75g (range: 8.375-25.125)
  }
  lunch: {
    calories: 700 (range: 350-1050),
    protein: 52.5g (range: 26.25-78.75),
    carbs: 70g (range: 35-105),
    fat: 23.45g (range: 11.725-35.175)
  }
  dinner: {
    calories: 600 (range: 300-900),
    protein: 45g (range: 22.5-67.5),
    carbs: 60g (range: 30-90),
    fat: 20.1g (range: 10.05-30.15)
  }
  snacks: {
    calories: 200 (range: 100-300),
    protein: 15g (range: 7.5-22.5),
    carbs: 20g (range: 10-30),
    fat: 6.7g (range: 3.35-10.05)
  }

Response:
  {
    "message": "Daily recommendations retrieved",
    "recommendations": {
      "breakfast": ["Tapsilog", "Pancit Canton", "Longganisa"],
      "lunch": ["Chicken Adobo", "Sinigang na Baboy", "Kare-kare"],
      "dinner": ["Lechon Kawali", "Pinakbet", "Bicol Express"],
      "snacks": ["Turon", "Banana Cue", "Lumpia Shanghai"]
    },
    "mealDistribution": {
      "breakfast": "25%",
      "lunch": "35%",
      "dinner": "30%",
      "snacks": "10%"
    }
  }
```

Total: O(log n + f × i × m × k)
Dominated by database query in most cases
Allergen filtering is post-query, so f is limited

```

### **Space Complexity**

```

Query Results: O(f)

- Limited to 20 foods maximum
- Each food document ~1-2 KB
- Total: ~20-40 KB in memory

Filtered Results: O(f)

- Worst case: all 20 foods are safe (no allergens)
- Best case: 0 foods (all have allergens)
- Typical: 10-15 foods

Response Object: O(f)

- JSON serialization of filtered results
- Additional targets object is O(1)

Total: O(f) where f ≤ 20 (capped)

```

---

DUPLICATE CONTENT REMOVED (Lines 1774-1828 were duplicate of earlier example)

---

### **Time Complexity Analysis**

```

Database Query: O(n)

- Full table scan of Foods collection
- No indexed query used (fetches all foods)
- n = total number of foods in database

Allergen Filtering: O(n × i × m × k)
Where:
n = total foods in database
i = avg ingredients per food (typically 5-15)
m = user allergens (typically 1-5)
k = avg keywords per allergen (20-60)

Example:
1000 foods × 10 ingredients × 3 allergens × 40 keywords = 1,200,000 comparisons
Fast due to simple string operations (< 50ms on modern hardware)

Meal Type Matching: O(n × 4)

- Each food checked against 4 meal types (breakfast, lunch, dinner, snacks)
- 12 range comparisons per meal type (4 macros × 3 conditions each)
- Total: n foods × 4 meals × 12 comparisons = 48n comparisons

Total: O(n + n × i × m × k + 48n) = O(n × i × m × k)
Dominated by allergen filtering complexity
Linear with respect to database size

```

### **Space Complexity**

```

Query Results: O(n)

- Full database loaded into memory
- Each food document ~1-2 KB
- For 1000 foods: ~1-2 MB in memory

Categorized Recommendations: O(4 × 10) = O(1)

- 4 meal categories × 10 foods max each
- Maximum 40 food names (strings)
- Each food name ~20-50 bytes
- Total: ~1-2 KB for recommendations

Response Object: O(1)

- Fixed-size structure (4 arrays + metadata)
- Limited to 40 total items maximum

Total: O(n) for processing, O(1) for response

```

### **Edge Cases**

```

Case 1: No matching foods for any meal type

- All arrays return empty
- Response: {
  recommendations: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  mealDistribution: {...}
  }
- Client shows "No recommendations available" message

Case 2: All foods have allergens

- All foods filtered out by hasAllergen()
- Response: {
  recommendations: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  mealDistribution: {...}
  }

Case 3: User has no allergens

- allergens = ["none"] or []
- hasAllergen() always returns false
- All matching foods returned (up to 10 per meal type)

Case 4: Missing dailyRecommendation

- If dailyRecommendation.calories is 0 or undefined
- Returns empty recommendations for all meal types
- Response: {
  recommendations: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  mealDistribution: {...}
  }

Case 5: Extreme macro targets

- User needs 300g protein/day (75g for breakfast)
- May return 0 results for specific meal types (no foods match)
- Fallback: could widen range to 25-200% instead of 50-150%

Case 6: Food matches multiple meal types

- A single food can appear in multiple categories
- Example: "Chicken Rice" might fit lunch AND dinner targets
- This is intentional - gives user flexibility

```

### **Optimization Opportunities**

```

1. Database Indexing:
   db.foods.createIndex({
   "nutrition.name": 1,
   "nutrition.value": 1
   })

   Impact: Faster nutrition value extraction

2. Caching:

   - Cache results for same macro targets + allergens
   - Use in-memory cache or Redis with TTL (e.g., 1 hour)
   - Key: `recommendations:${userId}:${dailyCalories}:${allergens.join(',')}`

   Impact: Reduce DB queries by 80-90% for repeat requests

3. Pre-filtering by allergens in query:

   - Add allergenTags field to Foods collection
   - Query: { allergenTags: { $nin: userAllergens } }
   - Reduces foods to iterate through

   Impact: Faster allergen exclusion at database level

4. Early termination per meal type:

   - Stop checking foods for a meal type once 10 matches found
   - Reduces unnecessary comparisons

   Impact: Faster response when many matching foods exist

5. Parallel processing:

   - Check all 4 meal types in parallel (Promise.all)
   - Independent operations, no shared state

   Impact: 4x faster with multi-core systems

6. Scoring/Ranking:

   - Calculate "closeness score" to ideal macros
   - Sort by best matches before slicing to 10
   - Return highest quality recommendations

   Impact: Better user experience with most relevant foods

```

```

---

## **SUMMARY TABLE**

| Algorithm               | Purpose                  | Time Complexity  | Space Complexity |
| ----------------------- | ------------------------ | ---------------- | ---------------- |
| CNN Inference           | Food classification      | O(1) per image   | O(1)             |
| Allergen Detection      | Safety matching (AI)     | O(n)             | O(n)             |
| Local Allergen Mapping  | Safety matching (local)  | O(n × m × k)     | O(n + m)         |
| Food Recommendation     | Personalized suggestions | O(n × i × m × k) | O(n)             |
| Nutrition Normalization | Data standardization     | O(n)             | O(n)             |
| Unit Conversion         | Standardize units        | O(1)             | O(1)             |
| API Cascade             | Data retrieval           | O(k) worst case  | O(1)             |
| Database Indexing       | Query optimization       | O(log n)         | O(n)             |
| Diet Aggregation        | Data transformation      | O(n log n)       | O(n)             |
| Nutrition Grouping      | AI categorization        | O(n)             | O(n)             |
| Nutrient Mapping        | ID translation           | O(n)             | O(1)             |
| Ingredient Extraction   | Text parsing             | O(n)             | O(n)             |
| Deduplication           | Storage optimization     | O(log n)         | O(1)             |
| Session Population      | Data enrichment          | O(m + w)         | O(m + w)         |
| Date Normalization      | Time formatting          | O(1)             | O(1)             |
| Rate Limiting           | Security                 | O(1)             | O(1)             |
| Signup Rate Limiting    | Spam prevention          | O(log n)         | O(k)             |

**Where:**

- n = number of items (nutrients, ingredients, database records, etc.)
- k = number of API fallback sources or active rate limit keys
- m = meal entries or user allergens
- w = weight logs
- f = foods returned from query (≤ 20)
- i = ingredients per food

---

**Last Updated:** November 13, 2025  
**Version:** 1.2

---

**Last Updated:** October 20, 2025  
**Version:** 1.0
