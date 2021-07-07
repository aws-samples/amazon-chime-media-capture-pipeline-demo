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
if ! [ -x "$(command -v jq)" ]; then
  echo 'Error: jq is not installed. https://stedolan.github.io/jq/download/' >&2
  exit 1
fi
if ! [ -x "$(command -v pip3)" ]; then
  echo 'Error: pip3 is not installed. https://pip.pypa.io/en/stable/installing/' >&2
  exit 1
fi
if ! [ -x "$(command -v aws)" ]; then
  echo 'Error: aws is not installed. https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html' >&2
  exit 1
fi
if ! [ -x "$(command -v cdk)" ]; then
  echo 'Error: cdk is not installed. https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install' >&2
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
if [ ! -f "yarn.lock" ]; then
    echo ""
    echo "Installing Packages"
    echo ""
    yarn
fi
echo ""
echo "Building Packages"
echo ""
if [ ! -d "python-layer/python/lib/python3.6/site-packages" ]; then
    pushd python-layer/python/lib/python3.6
    pip3 install -r requirements.txt --target site-packages
    popd
fi
echo ""
echo "Checking ffmpeg Layer"
echo ""
FFMPEGLAYER_STATUS=$( aws cloudformation describe-stacks --stack-name ffmpegLayerStack --region us-east-1 | jq -r ".Stacks[0].StackStatus" )
if [ "$FFMPEGLAYER_STATUS" != "CREATE_COMPLETE" ]; then
  echo "Deploying ffmpeg Layer"
  TEMPLATE_URL=$(aws serverlessrepo create-cloud-formation-template --application-id arn:aws:serverlessrepo:us-east-1:145266761615:applications/ffmpeg-lambda-layer --region us-east-1 | jq -r '.TemplateUrl' | awk -F '?' '{print $1}')
  aws cloudformation create-stack --stack-name ffmpegLayerStack --template-url $TEMPLATE_URL --region us-east-1 --capabilities CAPABILITY_AUTO_EXPAND
fi
FFMPEGLAYER_ARN=''
loopCount=0
while [[ "$FFMPEGLAYER_ARN" == '' || "$FFMPEGLAYER_ARN" == null ]]
do
  if [ "$loopCount" -gt "5" ]; then
    echo "Error creating ffmpegLayer"
    exit 1
  fi
  let loopCount++
  sleep 10
  FFMPEGLAYER_ARN=$( aws cloudformation describe-stacks --stack-name ffmpegLayerStack --region us-east-1 | jq -r ".Stacks[0].Outputs[0].OutputValue" )
done
echo "ARN: $FFMPEGLAYER_ARN"
echo ""
echo "Building CDK"
echo ""
yarn run build
echo ""
echo "Deploying CDK"
echo ""
cdk deploy -O client/src/cdk-outputs.json -c ffmpegLayerARN=$FFMPEGLAYER_ARN
