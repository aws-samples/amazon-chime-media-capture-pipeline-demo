const config = await fetch('./config.json').then((response) => response.json());

export const ConcatBucket = config.concatBucket;
export const Region = config.userPoolRegion;

export const AmplifyConfig = {
    Auth: {
        region: config.userPoolRegion,
        identityPoolId: config.identityPoolId,
        userPoolId: config.userPoolId,
        userPoolWebClientId: config.userPoolClientId,
        mandatorySignIn: true,
        cookieStorage: {
            domain: `${window.location.hostname}`,
            path: '/',
            expires: 365,
            secure: true,
        },
    },
    Analytics: {
        disabled: true,
    },
    API: {
        endpoints: [
            {
                name: 'meetingApi',
                endpoint: config.apiUrl,
            },
        ],
    },
    Storage: {
        AWSS3: {
            bucket: config.concatBucket,
            region: config.userPoolRegion,
        },
    },
};
