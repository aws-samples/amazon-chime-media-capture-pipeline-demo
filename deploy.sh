#!/bin/bash 
if ! [ -x "$(command -v node)" ]; then
  echo 'Error: node is not installed. https://nodejs.org/en/download/' >&2
  exit 1
fi
NODEVER="$(node --version)"
REQNODE="v12.0.0"
if ! [ "$(printf '%s\n' "$REQNODE" "$NODEVER" | sort -V | head -n1)" = "$REQNODE" ]; then
    echo 'node must be version 12+ https://nodejs.org/en/download/'
    exit 1
fi
if ! [ -x "$(command -v npm)" ]; then
  echo 'Error: npm is not installed. https://www.npmjs.com/get-npm' >&2
  exit 1
fi
if ! [ -x "$(command -v yarn)" ]; then
  echo 'Error: yarn is not installed. https://yarnpkg.com/getting-started/install' >&2
  exit 1
fi
if ! [ -x "$(command -v aws)" ]; then
  echo 'Error: aws is not installed. https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html' >&2
  exit 1
fi
if ! [ -x "$(command -v jq)" ]; then
  echo 'Error: jq is not installed. https://stedolan.github.io/jq/download/' >&2
  exit 1
fi
if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker is not installed. https://docs.docker.com/get-docker/' >&2
  exit 1
fi
if [ -f "cdk.context.json" ]; then
    echo ""
    echo "INFO: Removing cdk.context.json"
    rm cdk.context.json
else
    echo ""
    echo "INFO: cdk.context.json not present, nothing to remove"
fi
echo ""
echo "Installing Packages"
echo ""
yarn
echo ""
echo "Building CDK"
echo ""
yarn run build
echo ""
echo "Bootstrapping CDK"
echo ""
ACCOUNT_ID=$( aws sts get-caller-identity | jq -r '.Account' )
npx cdk bootstrap aws://$ACCOUNT_ID/us-east-1
echo ""
echo "Deploying CDK"
echo ""
npx cdk deploy -O client/src/cdk-outputs.json
