# NutriSight Backend

A comprehensive nutrition tracking and food recognition API built with Node.js, TypeScript, and MongoDB. NutriSight helps users track their diet, analyze nutritional content, and identify Filipino foods through computer vision and AI-powered analysis.

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-brightgreen.svg)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-5.1-lightgrey.svg)](https://expressjs.com/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Algorithms](#-algorithms)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🍔 Food Recognition & Analysis

- **AI-Powered Food Classification**: Classify 130 Filipino food dishes using a custom-trained CNN model (ONNX Runtime)
- **Barcode Scanning**: Retrieve nutritional information from product barcodes via USDA, Nutritionix, and Open Food Facts APIs
- **Multi-Source Data Aggregation**: Intelligent fallback cascade across 4+ nutrition databases
- **Food/Not-Food Detection**: External microservice integration to filter non-food images

### 🔬 Nutritional Intelligence

- **Dual-Layer Allergen Detection**: AI-powered ingredient analysis (Gemini AI) + comprehensive local keyword mapping (1,100+ variations) for maximum safety
- **Smart Food Recommendations**: Personalized daily meal suggestions based on macro targets and allergen profiles
- **Nutrition Grouping**: Automatic categorization into macronutrients, micronutrients, and other nutrients
- **Unit Normalization**: Smart conversion of all measurements to standardized grams/kcal
- **Multi-API Nutrition Data**: Seamless integration with USDA FoodData Central, Nutritionix, Open Food Facts, and Gemini AI

### 👤 User Management

- **Multiple Authentication Methods**:
  - Local authentication (email/password with OTP verification)
  - Google OAuth 2.0
- **Personalized Profiles**:
  - BMI calculation and tracking
  - Custom allergen profiles
  - Activity level-based calorie recommendations
  - Macro distribution (15% fat, 25% protein, 60% carbs)
- **Security Features**:
  - Bcrypt password hashing
  - Rate limiting (Mongo-backed counters)
  - Account lockout after failed login attempts (5 attempts → 15 min lockout)
  - Session management with MongoDB store

### 📊 Diet & Weight Tracking

- **Meal Logging**: Track breakfast, lunch, dinner, and snacks with nutritional breakdown
- **Diet History**: View aggregated nutrition data by date
- **Weight Tracking**: Log daily weight with historical trends
- **Personalized Recommendations**: Dynamic daily calorie and macro targets based on goals (lose/maintain/gain weight)

### 📸 Image Management

- **Cloudinary Integration**: Profile picture uploads with automatic optimization
- **Image Preprocessing**: Sharp library for efficient image resizing and normalization

---

## 🛠 Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.8
- **Framework**: Express 5.1
- **Build**: ts-node (dev), tsc (production)

### Database & Storage

- **Database**: MongoDB 8.x with Mongoose ODM
- **Session Store**: connect-mongo
- **Image Storage**: Cloudinary

### Authentication & Security

- **Local Auth**: Passport.js + bcrypt
- **OAuth**: Google OAuth 2.0 (passport-google-oauth2)
- **Sessions**: express-session with MongoDB store
- **Rate Limiting**: Custom Mongo-backed rate limiter

### AI & Machine Learning

- **Computer Vision**: ONNX Runtime (custom Filipino food CNN model)
- **Natural Language**: Google Gemini AI 2.5 Flash Lite
- **Image Processing**: Sharp

### External APIs

- **USDA FoodData Central**: Primary nutrition database
- **Nutritionix**: Secondary nutrition source
- **Open Food Facts**: Crowd-sourced food database
- **Food/Not-Food Microservice**: External image classification service

### Email

- **nodemailer**: Gmail SMTP for OTP delivery

---

## 🏗 Architecture

### Design Pattern

- **MVC Architecture**: Model-View-Controller separation
- **RESTful API**: Resource-based endpoints with HTTP verbs
- **Normalized Database (3NF)**: Efficient relational schema with Mongoose

### Key Architectural Decisions

#### 1. **Waterfall API Pattern**

```
USDA → Nutritionix → Open Food Facts → Gemini AI (fallback)
```

Ensures high availability while optimizing for accuracy and cost.

#### 2. **Normalized Database**

- **3NF compliance**: Eliminates redundancy
- **Collections**: UserAccount, MealEntry, ScanResult, LoggedWeight, Rate
- **Benefits**: Storage efficiency, data consistency, scalable queries

#### 3. **Rate Limiting Strategy**

- **Mongo-backed counters** (no Redis required)
- **TTL indexes** for automatic cleanup
- **Fail-open design** to prevent blocking legitimate users
- **Configurable thresholds** via environment variables

#### 4. **Session Management**

- **Lazy loading**: User data hydrated on auth events only
- **Populated responses**: Embedded diet history and logged weights for frontend compatibility
- **14-day session lifetime** with automatic cleanup

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- MongoDB 8.x (local or Atlas)
- npm or yarn
- Gmail account (for OTP emails)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/Sush1sui/NutriSight_backend.git
cd NutriSight_backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Create environment file**

```bash
cp .env.example .env
```

4. **Configure environment variables** (see [Environment Variables](#-environment-variables))

5. **Build TypeScript**

```bash
npm run build
```

6. **Run in development**

```bash
npm run dev
```

7. **Run in production**

```bash
npm start
```

The server will start on `http://localhost:3000` (or PORT from env).

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database & Sessions
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/NutriSight
SESSION_SECRET=your-long-random-secret-string

# Server
PORT=3000
NODE_ENV=development
SERVER_LINK=https://your-deployed-app.herokuapp.com/

# Email (Gmail recommended: use app password)
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your-gmail-app-password

# Signup Rate Limiting (optional, defaults shown)
SIGNUP_EMAIL_WINDOW_SECONDS=3600
SIGNUP_MAX_PER_EMAIL=3
SIGNUP_IP_WINDOW_SECONDS=600
SIGNUP_MAX_PER_IP=500

# External APIs (required for food features)
USDA_API_KEY=your_usda_api_key
NUTRITIONIX_APP_ID=your_nutritionix_app_id
NUTRITIONIX_API_KEY=your_nutritionix_api_key
HUGGINGFACE_API_KEY=your_huggingface_or_gemini_key

# Food/Not-Food Microservice (optional)
FOOD_NOT_FOOD_API_KEY=your_microservice_api_key

# Google OAuth (required for Google login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cloudinary (required for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

### Required Variables

- `MONGO_URI` - MongoDB connection string
- `EMAIL_USER` / `EMAIL_PASS` - Gmail credentials for OTP
- `USDA_API_KEY` - [Get free key](https://fdc.nal.usda.gov/api-key-signup.html)
- `NUTRITIONIX_APP_ID` / `NUTRITIONIX_API_KEY` - [Sign up](https://developer.nutritionix.com/)
- `HUGGINGFACE_API_KEY` - [Get key](https://huggingface.co/settings/tokens)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - [Google Cloud Console](https://console.cloud.google.com/)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` - [Sign up](https://cloudinary.com/)

### Optional Variables

- `SESSION_SECRET` - Defaults to "nutrisightsecret" (change in production!)
- `PORT` - Defaults to 3000
- `SERVER_LINK` - For self-ping (Heroku free tier keep-alive)
- `SIGNUP_*` - Rate limit tuning
- `FOOD_NOT_FOOD_API_KEY` - External microservice authentication

---

## 📚 API Documentation

### Base URL

```
Production: https://nutrisight-backend-dd22d1bd9780.herokuapp.com
Local: http://localhost:3000
```

### Authentication

#### Local Auth Endpoints

**POST** `/auth/send-otp`

```json
// Request
{
  "email": "user@example.com"
}

// Response
{
  "message": "OTP sent to email",
  "userId": "507f1f77bcf86cd799439011"
}
```

**POST** `/auth/register`

```json
// Request
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "securePassword123"
}

// Response
{
  "message": "OTP sent to email",
  "userId": "507f1f77bcf86cd799439011"
}
```

**POST** `/auth/verify-otp`

```json
// Request
{
  "email": "user@example.com",
  "otp": "1234"
}

// Response
{
  "message": "OTP verified successfully",
  "success": true,
  "email": "user@example.com"
}
```

**POST** `/auth/onboarding`

```json
// Request
{
  "name": "John Doe",
  "allergens": ["peanuts", "shellfish"],
  "gender": "male",
  "birthDate": "1995-01-01",
  "heightFeet": 5,
  "heightInches": 10,
  "weight": 70,
  "email": "user@example.com",
  "weightGoal": "lose",
  "targetWeight": 65,
  "activityLevel": "active",
  "loggedWeightPayload": [
    { "value": 70, "date": "2025-10-31" }
  ]
}

// Response
{
  "message": "Onboarding completed successfully",
  "success": true,
  "email": "user@example.com",
  "dailyRecommendation": {
    "calories": 2100,
    "protein": 131,
    "carbs": 315,
    "fat": 35
  }
}
```

**POST** `/auth/agreement`

```json
// Request
{
  "email": "user@example.com"
}

// Response (with populated user data)
{
  "message": "Agreement completed successfully",
  "user": { /* full user object with dietHistory and loggedWeights */ }
}
```

**POST** `/auth/login`

```json
// Request
{
  "email": "user@example.com",
  "password": "securePassword123"
}

// Response
{
  "message": "Login successful",
  "user": { /* populated user object */ }
}
```

**POST** `/auth/logout`

```json
// Response
{
  "message": "Logout successful"
}
```

**GET** `/auth/session`

```json
// Response (if authenticated)
{
  "user": { /* populated user object */ }
}

// Response (if not authenticated)
{
  "message": "Not authenticated"
}
```

**POST** `/auth/change-password`

```json
// Request
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}

// Response
{
  "message": "Password changed successfully"
}
```

**GET** `/auth/has-password`

```json
// Response
{
  "havePassword": true
}
```

#### Google OAuth Endpoints

**GET** `/auth/google/callback`

- Handles Google OAuth callback
- Redirects to frontend with session

### Camera / Food Recognition

**POST** `/camera/barcode`

```json
// Request
{
  "barcodeData": "012345678901"
}

// Response
{
  "message": "Barcode data received successfully",
  "data": {
    "name": "Product Name",
    "brand": "Brand Name",
    "ingredients": ["ingredient1", "ingredient2"],
    "triggeredAllergens": [
      { "ingredient": "milk", "allergen": "dairy" }
    ],
    "nutritionData": [
      {
        "title": "Macronutrients",
        "items": [
          { "name": "Protein", "value": 10, "unit": "g" }
        ]
      }
    ],
    "servingSize": "100g",
    "source": "usda"
  }
}
```

**POST** `/camera/predict-food`

```json
// Request
{
  "image": "base64EncodedImageString"
}

// Response
{
  "message": "Food scan data received successfully",
  "data": [
    { "label": "adobo", "prob": 0.85 },
    { "label": "sinigang", "prob": 0.10 },
    { "label": "lechon", "prob": 0.03 }
  ],
  "error": "not food" // only if microservice detects non-food
}
```

**POST** `/camera/get-food-data`

```json
// Request
{
  "foodName": "chicken adobo"
}

// Response
{
  "message": "Food Data received successfully",
  "data": {
    "foodName": "chicken adobo",
    "servingSize": "150g",
    "ingredients": ["chicken", "soy sauce", "vinegar", "garlic"],
    "triggeredAllergens": [
      { "ingredient": "soy sauce", "allergen": "soy" }
    ],
    "nutritionData": [ /* grouped nutrition */ ],
    "source": "usda"
  }
}
```

### Account Management

**POST** `/account/change-profile-picture`

```
Content-Type: multipart/form-data

Field: profilePicture (file)

// Response
{
  "message": "Profile picture updated successfully",
  "profileLink": "https://res.cloudinary.com/..."
}
```

**PUT** `/account/update`

```json
// Request
{
  "weight": 68,
  "bmi": 23.5,
  "targetWeight": 65,
  "loggedWeights": [
    { "date": "2025-10-31", "value": 68 }
  ]
}

// Response
{
  "message": "Profile updated",
  "data": { /* populated user object */ }
}
```

**PUT** `/account/update-diet-history`

```json
// Request
{
  "dietHistoryPayload": {
    "date": "2025-10-31",
    "breakfast": [
      {
        "name": "Scrambled Eggs",
        "brand": null,
        "servingSize": "100g",
        "ingredients": ["eggs", "butter", "salt"],
        "nutritionData": [ /* nutrition groups */ ],
        "source": "nutritionix",
        "id": "abc123",
        "quantity": 1,
        "triggeredAllergens": []
      }
    ],
    "lunch": [],
    "dinner": [],
    "otherMealTime": []
  }
}

// Response
{
  "message": "Diet history updated",
  "dietHistory": [ /* all diet history entries */ ]
}
```

**POST** `/account/diet-history`

```json
// Request
{
  "date": "2025-10-31"
}

// Response
{
  "message": "Diet history found",
  "dietHistory": {
    "date": "2025-10-31",
    "breakfast": [ /* meals */ ],
    "lunch": [ /* meals */ ],
    "dinner": [ /* meals */ ],
    "otherMealTime": [ /* meals */ ]
  }
}
```

**DELETE** `/account/diet-history`

```json
// Request
{
  "date": "2025-10-31",
  "mealTime": "breakfast",
  "id": "mealEntryId"
}

// Response
{
  "message": "Diet history entry deleted",
  "user": { /* updated user with full data */ }
}
```

**GET** `/account/recommend-foods`

```json
// Response
{
  "message": "Daily recommendations retrieved",
  "recommendations": {
    "breakfast": ["Pancit Canton", "Tapsilog", "Longganisa"],
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

_Note: Returns food names from local database categorized by meal type. Each meal type gets foods that match 50-150% of that meal's target macros (based on percentage distribution). Foods with user allergens are excluded. Limited to 10 recommendations per meal type._

**GET** `/camera/food-classes`

```json
// Response
{
  "message": "Food classes retrieved successfully",
  "foodClasses": [
    "adobo",
    "sinigang",
    "lechon"
    // ... 127 more Filipino food dishes
  ]
}
```

### Response Status Codes

- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (account locked)
- `404` - Not Found
- `409` - Conflict (email already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## 🗄 Database Schema

### Collections

#### UserAccount

```typescript
{
  _id: ObjectId,
  email: string (unique),
  password: string (hashed),
  firstName: string,
  lastName: string,
  name: string,
  gmailId?: string (unique, sparse),
  profileLink?: string,
  profilePublicId?: string,
  gender?: string,
  birthDate?: Date,
  heightFeet?: number,
  heightInches?: number,
  weight?: number,
  bmi?: number,
  weightGoal?: "lose" | "maintain" | "gain",
  targetWeight?: number,
  allergens?: string[],
  medicalConditions?: string[],
  dietType?: string,
  activityLevel?: "sedentary" | "active",
  dailyRecommendation?: {
    calories: number,
    protein: number,
    carbs: number,
    fat: number
  },
  otp?: string,
  otpExpires?: Date,
  isVerified: boolean,
  loginAttempts: number (default: 0),
  lockUntil?: Date
}
```

#### MealEntry

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: UserAccount),
  scanResultId: ObjectId (ref: ScanResult),
  date: string ("YYYY-MM-DD"),
  mealType: "breakfast" | "lunch" | "dinner" | "otherMealTime",
  quantity: number,
  triggeredAllergens: [
    { ingredient: string, allergen: string }
  ],
  createdAt: Date
}

// Indexes
{ userId: 1, date: -1 }
{ userId: 1, date: 1, mealType: 1 }
{ scanResultId: 1 }
```

#### ScanResult

```typescript
{
  _id: ObjectId,
  name: string,
  foodName?: string,
  brand?: string,
  servingSize: string,
  ingredients: string[],
  nutritionData: [
    {
      title: string,
      items: [
        { name: string, value: number, unit: string }
      ]
    }
  ],
  source: "usda" | "nutritionix" | "open food facts" | "gemini",
  sourceId?: string,
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ sourceId: 1, source: 1 } (sparse, unique)
{ name: 1, brand: 1 }
```

#### LoggedWeight

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: UserAccount),
  value: number,
  date: string ("YYYY-MM-DD"),
  createdAt: Date
}

// Indexes
{ userId: 1, date: 1 } (unique)
```

#### Rate

```typescript
{
  _id: ObjectId,
  key: string (unique),
  count: number,
  createdAt: Date,
  expireAt?: Date
}

// Indexes
{ key: 1 } (unique)
{ expireAt: 1 } (TTL, expireAfterSeconds: 0)
```

See [DATABASE_ERD.md](./DATABASE_ERD.md) for detailed relationships and ER diagram.

---

## 🧮 Algorithms

NutriSight implements 18 sophisticated algorithms for food recognition, nutrition analysis, and data processing:

### 🔴 Core Algorithms (Critical for Thesis)

1. **CNN Image Classification** - Softmax with top-K selection for Filipino food recognition
   - _Priority: CRITICAL - Core thesis topic, CNN model implementation_
2. **Dual-Layer Allergen Detection** - AI (Gemini) + Local Keyword Mapping (1,100+ variations) for comprehensive allergen safety
   - _Priority: CRITICAL - Key safety feature, AI-powered + deterministic validation_
3. **Nutrition Normalization** - Priority-based consolidation with map deduplication
   - _Priority: CRITICAL - Essential for data accuracy and consistency_
4. **API Fallback Cascade** - Waterfall pattern for high availability
   - _Priority: CRITICAL - System reliability and data source integration_

### 🟡 Supporting Algorithms (Important for Thesis)

5. **Unit Conversion** - Density-aware multi-system standardization
   - _Priority: HIGH - Enables accurate nutritional calculations_
6. **Nutrition Grouping** - Prompt-driven categorical classification
   - _Priority: HIGH - AI-powered nutrition categorization_
7. **Database Indexing** - B-Tree compound indexing with leftmost prefix
   - _Priority: HIGH - Query optimization for scalability_
8. **Diet Aggregation** - Hash map grouping with JOIN simulation
   - _Priority: HIGH - Data transformation for normalized DB_
9. **Meal Entry Deduplication** - Find-or-create pattern with composite key matching
   - _Priority: HIGH - Storage optimization_

### 🟢 Technical Implementation (Include if Space Permits)

10. **Session Population** - Lazy loading with parallel data hydration
    - _Priority: MEDIUM - Performance optimization technique_
11. **Date String Normalization** - ISO 8601 normalization with zero-padding (server-agnostic)
    - _Priority: MEDIUM - Timezone handling for global deployment_

### ⚪ Utility Algorithms (Optional for Thesis)

12. **Nutritionix Nutrient Mapping** - Direct hash map translation for O(1) lookup
    - _Priority: LOW - API integration detail_
13. **Ingredient Text Extraction** - Depth-first search with language filtering
    - _Priority: LOW - Data parsing utility_
14. **Ingredient Cleaning** - Regex-based sanitization with set deduplication
    - _Priority: LOW - Text processing utility_
15. **Authentication Rate Limiting** - Stateful counter with time-based lockout
    - _Priority: LOW - Security implementation detail_
16. **Signup Rate Limiting** - Mongo-backed sliding window counters with TTL
    - _Priority: LOW - Security implementation detail_

### 📊 Thesis Recommendation

**Must Include (4 algorithms):**

- CNN Image Classification (your main contribution)
- Dual-Layer Allergen Detection (AI + local mapping safety feature)
- Nutrition Normalization (data accuracy)
- API Fallback Cascade (system reliability)

**Should Include (5 algorithms):**

- Unit Conversion (nutritional accuracy)
- Nutrition Grouping (AI categorization)
- Database Indexing (scalability)
- Diet Aggregation (data transformation)
- Meal Entry Deduplication (storage optimization)

**Optional (remaining 7):** Include based on page limits and focus areas

- Session Population, Date String Normalization (performance & timezone)
- Nutritionix Mapping, Ingredient Extraction/Cleaning (utilities)
- Rate Limiting algorithms (security details)

See [ALGORITHMS_DOCUMENTATION.md](./ALGORITHMS_DOCUMENTATION.md) for detailed algorithm specifications, time complexity analysis, and implementation details.

---

## 🚢 Deployment

### Heroku Deployment

1. **Create Heroku app**

```bash
heroku create nutrisight-backend
```

2. **Add MongoDB Atlas add-on or set MONGO_URI**

```bash
heroku config:set MONGO_URI="mongodb+srv://..."
```

3. **Set all environment variables**

```bash
heroku config:set SESSION_SECRET="..."
heroku config:set EMAIL_USER="..."
heroku config:set EMAIL_PASS="..."
# ... etc (see Environment Variables section)
```

4. **Deploy**

```bash
git push heroku master
```

5. **Check logs**

```bash
heroku logs --tail
```

### Environment-Specific Notes

#### Production Checklist

- ✅ Set `NODE_ENV=production`
- ✅ Use strong `SESSION_SECRET`
- ✅ Enable HTTPS (secure cookies)
- ✅ Set rate limit thresholds appropriately
- ✅ Monitor MongoDB Atlas performance
- ✅ Configure Cloudinary production limits
- ✅ Set up error monitoring (e.g., Sentry)

#### Heroku-Specific

- The `heroku-postbuild` script runs `npm run build` automatically
- Port is assigned dynamically via `process.env.PORT`
- Free tier dynos sleep after 30 minutes - use `SERVER_LINK` ping loop to keep alive

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier (if configured)
- Write descriptive commit messages
- Add JSDoc comments for complex functions
- Update documentation for new features

---

## 📝 License

This project is licensed under the ISC License.

---

## 👨‍💻 Author

**Sush1sui**

- GitHub: [@Sush1sui](https://github.com/Sush1sui)

---

## 🙏 Acknowledgments

- **USDA FoodData Central** - Primary nutrition database
- **Nutritionix** - Secondary nutrition API
- **Open Food Facts** - Crowd-sourced food data
- **Google Gemini AI** - Natural language processing
- **Cloudinary** - Image hosting and optimization
- **MongoDB** - Database platform
- **Heroku** - Hosting platform

---

## 📞 Support

For issues or questions:

- Open an issue on GitHub
- Check [ALGORITHMS_DOCUMENTATION.md](./ALGORITHMS_DOCUMENTATION.md) for technical details
- Review [DATABASE_ERD.md](./DATABASE_ERD.md) for database schema

---

**Built with ❤️ for better nutrition tracking**
