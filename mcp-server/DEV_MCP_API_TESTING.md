# API Testing with Automatic Test Data Generation

## Overview

The MCP server automatically tests APIs during `git push` with **LLM-generated test data**. This ensures your APIs work correctly before code reaches your team.

---

## Complete Workflow

### **Your Scenario: 2 Commits with 15 Files**

```
Commit-1: 5 files
├─ server/routes/userRoutes.ts (2 APIs)
├─ server/routes/productRoutes.ts (3 APIs)
├─ server/services/userService.ts
├─ client/components/UserCard.tsx
└─ client/components/ProductList.tsx

Commit-2: 10 files
├─ server/routes/orderRoutes.ts (4 APIs) [NEW]
├─ server/routes/paymentRoutes.ts (2 APIs) [NEW]
├─ server/services/userService.ts [COMMON - modified]
├─ server/services/orderService.ts [NEW]
├─ client/components/UserCard.tsx [COMMON - modified]
├─ client/components/OrderCard.tsx [NEW]
├─ client/components/PaymentForm.tsx [NEW]
├─ client/pages/OrderPage.tsx [NEW]
├─ client/pages/PaymentPage.tsx [NEW]
└─ server/tests/order.test.ts [NEW]

Total: 15 file changes, 13 unique files
Route files: 4 files (2 + 2 new)
Total new APIs: 11 APIs (2 + 3 + 4 + 2)
```

---

## Step-by-Step: What Happens

### **COMMIT-1:**

```bash
git add .  # 5 files staged
git commit -m "Add user and product features"
```

**Pre-Commit Hook:**
```
🔍 Scanning 5 staged files...
   ├─ server/routes/userRoutes.ts
   │   └─ Found: POST /api/users, GET /api/users/:id
   ├─ server/routes/productRoutes.ts
   │   └─ Found: POST /api/products, GET /api/products, GET /api/products/:id
   └─ 3 other files (no routes)

📊 Duplicate Detection:
   ├─ POST /api/users → Check api_library table
   ├─ GET /api/users/:id → Check api_library table
   ├─ POST /api/products → Check api_library table
   ├─ GET /api/products → Check api_library table
   └─ GET /api/products/:id → Check api_library table

Result: ✅ No duplicates found
✅ Commit allowed
```

Time: ~2 seconds

---

### **COMMIT-2:**

```bash
git add .  # 10 files staged
git commit -m "Add order and payment features"
```

**Pre-Commit Hook:**
```
🔍 Scanning 10 staged files...
   ├─ server/routes/orderRoutes.ts
   │   └─ Found: POST /api/orders, GET /api/orders, GET /api/orders/:id, DELETE /api/orders/:id
   ├─ server/routes/paymentRoutes.ts
   │   └─ Found: POST /api/payments, POST /api/payments/refund
   └─ 8 other files (no routes)

📊 Duplicate Detection:
   ├─ POST /api/orders → Check api_library table
   ├─ GET /api/orders → Check api_library table
   ├─ GET /api/orders/:id → Check api_library table
   ├─ DELETE /api/orders/:id → Check api_library table
   ├─ POST /api/payments → Check api_library table
   └─ POST /api/payments/refund → Check api_library table

Result: ✅ No duplicates found
✅ Commit allowed
```

Time: ~3 seconds

---

### **PUSH (Both Commits):**

```bash
git push origin main
```

**Pre-Push Hook (Optimized - Only Changed Files):**

```
Step 1: Identify changed files
   └─ Command: git diff --name-only origin/main..HEAD
   └─ Result: 13 unique files (2 files appeared in both commits)

Step 2: Filter route files
   └─ server/routes/userRoutes.ts
   └─ server/routes/productRoutes.ts
   └─ server/routes/orderRoutes.ts
   └─ server/routes/paymentRoutes.ts
   └─ Total: 4 route files (not 100+ files!)

Step 3: Parse APIs from route files
   └─ Total APIs discovered: 11 APIs

Step 4: API Registration & Duplicate Safety Check
   ├─ For each API:
   │   ├─ Query: SELECT * FROM api_library WHERE api_endpoint = ? AND http_method = ?
   │   ├─ If exists: SKIP (pre-commit should have caught this)
   │   └─ If not exists: INSERT INTO api_library (api_endpoint, http_method, route_file_path, ...)
   │
   └─ Result: 11 APIs registered

Step 5: Generate Test Data & Run Tests
   ├─ [API 1] POST /api/users
   │   ├─ Analyze route code → Extract schema
   │   ├─ Schema found:
   │   │   ├─ name: string (required)
   │   │   ├─ email: string (required)
   │   │   ├─ password: string (required)
   │   │   └─ age: number (optional)
   │   ├─ Call LLM: Generate test data
   │   ├─ LLM Response:
   │   │   {
   │   │     "name": "John Doe",
   │   │     "email": "john.doe@test.com",
   │   │     "password": "Test@1234",
   │   │     "age": 28
   │   │   }
   │   ├─ Execute CURL:
   │   │   curl -X POST http://localhost:3000/api/users \
   │   │     -H "Content-Type: application/json" \
   │   │     -d '{"name":"John Doe","email":"john.doe@test.com",...}'
   │   ├─ Response: 201 Created, {"id": "user-123", "name": "John Doe", ...}
   │   ├─ Validation:
   │   │   ✅ Status code: 201 (expected)
   │   │   ✅ Body contains: id
   │   │   ✅ Response time: 124ms
   │   └─ Result: ✅ PASSED
   │
   ├─ [API 2] GET /api/users/:id
   │   ├─ No request body needed
   │   ├─ Dependencies: Need user_id from previous test
   │   ├─ Execute CURL:
   │   │   curl -X GET http://localhost:3000/api/users/user-123
   │   ├─ Response: 200 OK, {"id": "user-123", "name": "John Doe", ...}
   │   └─ Result: ✅ PASSED
   │
   ├─ [API 3] POST /api/products
   │   ├─ Schema found:
   │   │   ├─ name: string (required)
   │   │   ├─ price: number (required)
   │   │   ├─ description: string (optional)
   │   │   └─ category: string (required)
   │   ├─ LLM generates:
   │   │   {
   │   │     "name": "Wireless Mouse",
   │   │     "price": 29.99,
   │   │     "description": "Ergonomic wireless mouse",
   │   │     "category": "Electronics"
   │   │   }
   │   ├─ Execute CURL with LLM data
   │   └─ Result: ✅ PASSED
   │
   ├─ [API 4] POST /api/orders
   │   ├─ Schema found:
   │   │   ├─ userId: string (required)
   │   │   ├─ productId: string (required)
   │   │   ├─ quantity: number (required)
   │   │   └─ shippingAddress: object (required)
   │   ├─ Dependencies detected: user, product
   │   ├─ Auth required: Yes (detected from code: req.user)
   │   ├─ Setup dependencies:
   │   │   ├─ Create test user → user-123
   │   │   ├─ Login → token-xyz
   │   │   ├─ Create test product → product-456
   │   ├─ LLM generates:
   │   │   {
   │   │     "userId": "user-123",
   │   │     "productId": "product-456",
   │   │     "quantity": 2,
   │   │     "shippingAddress": {
   │   │       "street": "123 Main St",
   │   │       "city": "San Francisco",
   │   │       "zipCode": "94105"
   │   │     }
   │   │   }
   │   ├─ Execute CURL with auth token:
   │   │   curl -X POST http://localhost:3000/api/orders \
   │   │     -H "Authorization: Bearer token-xyz" \
   │   │     -H "Content-Type: application/json" \
   │   │     -d '{...LLM generated data...}'
   │   └─ Result: ✅ PASSED
   │
   └─ [Continue for all 11 APIs...]

Step 6: Component Scanning (Only Changed Files)
   ├─ Filter component files from 13 changed files:
   │   ├─ client/components/UserCard.tsx
   │   ├─ client/components/ProductList.tsx
   │   ├─ client/components/OrderCard.tsx
   │   └─ client/components/PaymentForm.tsx
   │   └─ Total: 4 component files (not 200+ files!)
   │
   ├─ For each component:
   │   ├─ Extract component code
   │   ├─ LLM similarity check against existing components
   │   ├─ If similarity > 85%: Generate WARNING
   │   └─ Save to sprints.component_duplication_reports
   │
   └─ Result: 2 similar components found (non-blocking warnings)

Step 7: Report to Platform
   ├─ POST /api/mcp/test-results/api
   └─ Payload:
       {
         "testRunId": "run-abc123",
         "summary": {
           "totalAPIs": 11,
           "newAPIs": 11,
           "passedAPIs": 10,
           "failedAPIs": 1,
           "duplicateAPIs": 0
         },
         "testResults": [...],
         "componentWarnings": [...]
       }

Step 8: Decide Push Outcome
   ├─ If all tests passed: ✅ Allow push
   ├─ If tests failed AND PROJEXLIGHT_FAIL_ON_TEST_FAILURE=true: ❌ Block push
   └─ If tests failed AND PROJEXLIGHT_FAIL_ON_TEST_FAILURE=false: ⚠️  Warn, allow push
```

---

## File Scanning Summary

| Stage | Files Scanned | What's Scanned | Time |
|-------|---------------|----------------|------|
| **Pre-Commit-1** | 5 staged | APIs, Components | 2s |
| **Pre-Commit-2** | 10 staged | APIs, Components | 3s |
| **Pre-Push (OLD)** | 100+ (entire project) | Everything ❌ | 30-60s |
| **Pre-Push (NEW)** | 13 unique (changed only) | Changed files only ✅ | 5-10s |

---

## Test Data Generation: Deep Dive

### **How LLM Generates Test Data**

**Example: POST /api/orders**

**Step 1: Analyze Route Code**
```typescript
// orderRoutes.ts
router.post('/api/orders', authenticate, async (req, res) => {
  const { userId, productId, quantity, shippingAddress } = req.body;

  // Validation
  if (!userId || !productId || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Create order
  const order = await Order.create({
    userId,
    productId,
    quantity,
    shippingAddress,
    status: 'pending'
  });

  res.status(201).json(order);
});
```

**Step 2: Extract Schema**
```json
{
  "fields": [
    { "name": "userId", "type": "string", "required": true },
    { "name": "productId", "type": "string", "required": true },
    { "name": "quantity", "type": "number", "required": true },
    { "name": "shippingAddress", "type": "object", "required": true }
  ]
}
```

**Step 3: Detect Auth & Dependencies**
```json
{
  "authRequired": true,
  "dependencies": ["user", "product"]
}
```

**Step 4: LLM Prompt**
```
Generate realistic test data for this API endpoint:

Endpoint: POST /api/orders

Request Body Schema:
- userId: string (required)
- productId: string (required)
- quantity: number (required)
- shippingAddress: object (required)

Requirements:
- Authentication required: Yes
- Dependencies: user, product

Generate a complete JSON object with realistic test data.
```

**Step 5: LLM Response**
```json
{
  "userId": "user-{{dependency.user_id}}",
  "productId": "product-{{dependency.product_id}}",
  "quantity": 2,
  "shippingAddress": {
    "street": "742 Evergreen Terrace",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "USA"
  }
}
```

**Step 6: Setup Dependencies**
```bash
# Create test user
POST /api/users → user-123

# Login to get token
POST /api/auth/login → token-xyz

# Create test product
POST /api/products → product-456

# Replace placeholders
userId: "user-123"
productId: "product-456"
```

**Step 7: Execute Test**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer token-xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "productId": "product-456",
    "quantity": 2,
    "shippingAddress": {
      "street": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "IL",
      "zipCode": "62701",
      "country": "USA"
    }
  }'
```

**Step 8: Validate Response**
```
Expected: 201 Created
Actual: 201 Created ✅

Expected body contains: id, userId, productId
Actual: {"id": "order-789", "userId": "user-123", ...} ✅

Result: ✅ PASSED
```

---

## Authentication Handling

### **Endpoints Requiring Auth:**

```javascript
// Detect from middleware
router.post('/api/orders', authenticate, async (req, res) => {
                          ^^^^^^^^^^^^
                          Auth middleware detected!
```

### **Auto-Login Flow:**

```
1. Detect auth requirement
   └─ Code contains: authenticate, authMiddleware, req.user

2. Check if token exists in test_context
   └─ If exists: Use existing token
   └─ If not: Login automatically

3. Auto-login:
   ├─ POST /api/auth/login
   ├─ Body: {"email": "test@example.com", "password": "test123"}
   ├─ Response: {"token": "xyz..."}
   └─ Store in test_context.authToken

4. Use token in subsequent requests:
   └─ Header: Authorization: Bearer xyz...
```

---

## Dependency Management

### **Example: POST /api/payments**

Dependencies: user → order

```
1. Create user
   POST /api/users → user-123

2. Login
   POST /api/auth/login → token-xyz

3. Create product
   POST /api/products → product-456

4. Create order
   POST /api/orders → order-789

5. Now test payment
   POST /api/payments
   Body: {
     "orderId": "order-789",
     "amount": 59.98,
     "paymentMethod": "credit_card"
   }
```

---

## Cleanup After Tests

```
After all tests complete:

1. Delete created test users
   DELETE /api/users/user-123

2. Delete created products
   DELETE /api/products/product-456

3. Delete created orders
   DELETE /api/orders/order-789

4. Clear test_context
   └─ Remove tokens, IDs, etc.
```

---

## Summary: Your Exact Scenario

**Total Files:** 15 file changes across 2 commits (13 unique files)

**Pre-Commit Scanning:**
- Commit-1: 5 files → 5 APIs discovered → ~2 seconds
- Commit-2: 10 files → 6 APIs discovered → ~3 seconds
- **Total:** 11 APIs prevented from duplicates

**Pre-Push Testing:**
- Changed files only: 13 unique files (not entire project!)
- Route files: 4 files
- APIs tested: 11 APIs
- Test data: LLM-generated for all 11 APIs
- Time: ~5-10 seconds (vs 30-60s for entire project)

**Component Scanning:**
- Component files: 4 files (from 13 changed files)
- LLM similarity: 4 components analyzed
- Time: ~3-5 seconds

**Total Time:**
- Pre-commit-1: 2s
- Pre-commit-2: 3s
- Pre-push: 10s
- **Grand Total: ~15 seconds** (vs 90+ seconds old way!)

---

## Benefits

✅ **No Manual Test Data** - LLM generates realistic data automatically
✅ **Smart Dependencies** - Automatically creates users, products, etc.
✅ **Authentication Handled** - Auto-login when needed
✅ **Fast & Efficient** - Only tests changed files
✅ **No Duplicates** - Pre-commit + pre-push safety checks
✅ **Real Testing** - Actual CURL tests with real data
✅ **Clean State** - Auto-cleanup after tests

---

**Questions?** See `test_data_generator.py` and `api_tester.py` for implementation details.
