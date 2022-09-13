import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import { parseUrl } from '@aws-sdk/url-parser';
import { Sha256 } from '@aws-crypto/sha256-browser';
import { formatUrl } from '@aws-sdk/util-format-url';
import { ConcatBucket, Region } from './Config';
import './App.css';
import { AmplifyConfig as config } from './Config';
import { Amplify, API, Auth } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';

Amplify.configure(config);
Amplify.Logger.LOG_LEVEL = 'DEBUG';
console.log(config.API);
export const Recordings = ({ currentCredentials }) => {
    const [recordings, setRecordings] = useState([]);
    const [mediaPipelineIds, setMediaPipelineIds] = useState([]);

    useEffect(() => {
        console.log(recordings);
        async function generateS3PresignedUrl(key) {
            console.log(`currentCredentials: ${JSON.stringify(currentCredentials)}`);
            const s3ObjectUrl = parseUrl(`https://${ConcatBucket}.s3.${Region}.amazonaws.com/${key}`);
            const presigner = new S3RequestPresigner({
                credentials: Auth.currentUserCredentials(),
                region: 'us-east-1',
                sha256: Sha256,
            });

            const presignedResponse = await presigner.presign(new HttpRequest(s3ObjectUrl));
            const presignedUrl = formatUrl(presignedResponse);
            console.log(`presignedUrl: ${presignedUrl}`);
            return presignedUrl;
        }

        async function getMediaPipelineIds() {
            for (let recording of recordings) {
                let mediaPipelineId = {};
                mediaPipelineId.video = await generateS3PresignedUrl(recording['composited-video']);
                mediaPipelineId.timestamp = parseFloat(recording.timestamp) * 1000;
                mediaPipelineId.id = recording.mediaPipelineId;
                mediaPipelineId.transcript = await generateS3PresignedUrl(recording['transcription-messages']);
                console.log(`mediaPipelineId ${JSON.stringify(mediaPipelineId)}`);
                setMediaPipelineIds((mediaPipelineIds) => [...mediaPipelineIds, mediaPipelineId]);
            }
        }
        getMediaPipelineIds();
        console.log(mediaPipelineIds);
    }, [recordings]);

    useEffect(() => {
        const getRecordings = async () => {
            try {
                const recordingsResponse = await API.post('meetingApi', 'recordings', {});
                console.log(`Recording Response: ${JSON.stringify(recordingsResponse)}`);
                setRecordings(recordingsResponse);
            } catch (err) {
                console.log(err);
            }
        };

        getRecordings();
    }, []);

    return (
        <div>
            <SpaceBetween size="l">
                {mediaPipelineIds
                    .slice(Math.max(mediaPipelineIds.length - 10, 0))
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((mediaPipelineId, index) => (
                        <div key={index}>
                            <Container
                                header={
                                    <Header
                                        variant="h2"
                                        description={`Meeting Time: ${new Date(
                                            mediaPipelineId.timestamp,
                                        ).toLocaleDateString()} ${new Date(
                                            mediaPipelineId.timestamp,
                                        ).toLocaleTimeString()}`}
                                        actions={
                                            <Button href={mediaPipelineId.transcript} target="_blank">
                                                Transcription
                                            </Button>
                                        }
                                    >
                                        MediaPipeline ID: {mediaPipelineId.id}
                                        <SpaceBetween direction="horizontal" size="xs"></SpaceBetween>
                                    </Header>
                                }
                            >
                                <ReactPlayer controls={true} url={mediaPipelineId.video} />
                                <br />
                            </Container>
                        </div>
                    ))}
            </SpaceBetween>
        </div>
    );
};
