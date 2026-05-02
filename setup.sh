#!/bin/bash
# ============================================================
# SRMIST Evaluation - One-time Setup Script
# Run: bash setup.sh
# ============================================================

BASE_URL="http://20.207.122.201/evaluation-service"
CREDS_FILE=".credentials.json"

echo "=========================================="
echo "  SRMIST Evaluation Setup"
echo "=========================================="

# ---- STEP 1: REGISTER ----
echo ""
echo "[1/3] Registering..."

REG_RESPONSE=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gt7412@srmist.edu.in",
    "name": "GT 7412",
    "mobileNo": "8928211370",
    "githubUsername": "gari4355",
    "rollNo": "RA2311027010049",
    "accessCode": "QkbpxH"
  }')

echo "Registration Response: $REG_RESPONSE"

CLIENT_ID=$(echo $REG_RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clientID',''))" 2>/dev/null)
CLIENT_SECRET=$(echo $REG_RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clientSecret',''))" 2>/dev/null)

if [ -z "$CLIENT_ID" ]; then
  echo ""
  echo "ERROR: Registration failed or already registered."
  echo "If already registered, paste your clientID and clientSecret:"
  read -p "clientID: " CLIENT_ID
  read -p "clientSecret: " CLIENT_SECRET
fi

echo "clientID: $CLIENT_ID"
echo "clientSecret: $CLIENT_SECRET"
echo ""
echo ">>> SAVE THESE SOMEWHERE SAFE <<<"

# ---- STEP 2: GET AUTH TOKEN ----
echo ""
echo "[2/3] Getting auth token..."

AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"gt7412@srmist.edu.in\",
    \"name\": \"GT 7412\",
    \"rollNo\": \"RA2311027010049\",
    \"accessCode\": \"QkbpxH\",
    \"clientID\": \"$CLIENT_ID\",
    \"clientSecret\": \"$CLIENT_SECRET\"
  }")

echo "Auth Response: $AUTH_RESPONSE"

TOKEN=$(echo $AUTH_RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get token."
  exit 1
fi

echo "Token obtained successfully."

# ---- STEP 3: SAVE CREDENTIALS ----
echo ""
echo "[3/3] Saving credentials..."

cat > $CREDS_FILE << EOF
{
  "email": "gt7412@srmist.edu.in",
  "name": "GT 7412",
  "rollNo": "RA2311027010049",
  "accessCode": "QkbpxH",
  "clientID": "$CLIENT_ID",
  "clientSecret": "$CLIENT_SECRET",
  "access_token": "$TOKEN"
}
EOF

echo "Credentials saved to $CREDS_FILE"
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Build logging middleware: cd logging-middleware && npm run build"
echo "  3. Run vehicle scheduler: cd vehicle_scheduling && npm start"
echo ""
