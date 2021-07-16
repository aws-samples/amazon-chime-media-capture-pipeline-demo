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
pushd python-layer
mkdir bin/
curl -s https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar -xJC bin --strip=1 'ffmpeg-*-amd64-static/ffmpeg'
docker run --rm -v $(pwd):/foo -w /foo lambci/lambda:build-python3.8 pip3 install -r requirements.txt -t python
zip -r9 layer.zip bin python -x "*.pyc"
popd
echo ""
echo "Building CDK"
echo ""
yarn run build
echo ""
echo "Deploying CDK"
echo ""
cdk deploy -O client/src/cdk-outputs.json
