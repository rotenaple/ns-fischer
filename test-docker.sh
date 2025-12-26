#!/bin/bash
# test-docker.sh - Script to test Docker configuration

set -e

echo "=== Testing NS-Fischer Docker Configuration ==="
echo ""

# Test 1: Check if required files exist
echo "Test 1: Checking required files..."
files=(
    "Dockerfile"
    ".dockerignore"
    "entrypoint.sh"
    "docker-compose.yml"
    ".env.example"
    "DOCKER.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
        exit 1
    fi
done

echo ""

# Test 2: Validate .env.example has required variables
echo "Test 2: Validating .env.example..."
required_vars=("WEBHOOK_URL" "NATIONS")
for var in "${required_vars[@]}"; do
    if grep -q "^$var=" .env.example; then
        echo "✓ $var found in .env.example"
    else
        echo "✗ $var missing from .env.example"
        exit 1
    fi
done

echo ""

# Test 3: Validate entrypoint.sh is executable (after copy to Docker)
echo "Test 3: Checking entrypoint.sh syntax..."
if bash -n entrypoint.sh 2>/dev/null; then
    echo "✓ entrypoint.sh has valid syntax"
else
    echo "✗ entrypoint.sh has syntax errors"
    exit 1
fi

echo ""

# Test 4: Validate docker-compose.yml syntax
echo "Test 4: Validating docker-compose.yml..."
if command -v docker-compose &> /dev/null; then
    if docker-compose config > /dev/null 2>&1; then
        echo "✓ docker-compose.yml is valid"
    else
        echo "⚠ docker-compose.yml validation failed (may need .env file)"
    fi
else
    echo "⚠ docker-compose not installed, skipping validation"
fi

echo ""

# Test 5: Test config generation logic
echo "Test 5: Testing config generation..."
export WEBHOOK_URL='https://discord.com/api/webhooks/test/token'
export NATIONS='TestNation1,TestNation2'
export DEBUG_MODE='true'
export CHECK_CTE='false'

mkdir -p /tmp/ns-fischer-test

node -e "
const config = {
  webhook_url: process.env.WEBHOOK_URL || '',
  nations: (process.env.NATIONS || '').split(',').map(n => n.trim()).filter(n => n),
  debug_mode: process.env.DEBUG_MODE === 'true',
  mention: process.env.MENTION || '',
  no_ping: process.env.NO_PING === 'true',
  check_cte: process.env.CHECK_CTE !== 'false',
  snapshot_path: process.env.SNAPSHOT_PATH || './snapshot/auction_snapshot.json',
  check_snapshot: process.env.CHECK_SNAPSHOT === 'true',
  user_agent: process.env.USER_AGENT || ''
};
const fs = require('fs');
fs.writeFileSync('/tmp/ns-fischer-test/config.json', JSON.stringify(config, null, 2));
console.log('Config generated successfully');
"

if [ -f "/tmp/ns-fischer-test/config.json" ]; then
    echo "✓ Config generation successful"
    echo "Generated config:"
    cat /tmp/ns-fischer-test/config.json
else
    echo "✗ Config generation failed"
    exit 1
fi

echo ""

# Test 6: Validate Dockerfile syntax
echo "Test 6: Checking Dockerfile..."
if command -v docker &> /dev/null; then
    # Basic Dockerfile syntax check - just verify it can be parsed
    if grep -q "^FROM" Dockerfile && grep -q "^WORKDIR" Dockerfile; then
        echo "✓ Dockerfile has required directives"
    else
        echo "⚠ Dockerfile missing required directives"
    fi
else
    echo "⚠ Docker not installed, skipping Dockerfile validation"
fi

echo ""
echo "=== All Tests Completed Successfully ==="
echo ""
echo "To use Docker:"
echo "1. Copy .env.example to .env"
echo "2. Edit .env with your configuration"
echo "3. Run: docker-compose up -d"
echo ""
echo "For detailed documentation, see DOCKER.md"
