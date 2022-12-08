import React, { useState, useEffect } from 'react';
import {
    useMeetingManager,
    useLocalVideo,
    useAudioVideo,
    ControlBar,
    ControlBarButton,
    Meeting,
    LeaveMeeting,
    AudioInputControl,
    DeviceLabels,
    VideoTileGrid,
    Remove,
    VideoInputControl,
    AudioOutputControl,
    MeetingStatus,
    useMeetingStatus,
} from 'amazon-chime-sdk-component-library-react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import './App.css';
import { AmplifyConfig as config } from './Config';
import { Amplify, API, Auth } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import Extras from './Extras'
import SpeakerTimer from './SpeakerTimer'


Amplify.configure(config);
Amplify.Logger.LOG_LEVEL = 'DEBUG';
console.log(config.API);
export const Meetings = () => {
    const meetingManager = useMeetingManager();
    const meetingStatus = useMeetingStatus();
    const [meetingId, setMeetingId] = useState('');
    const [attendeeId, setAttendeeId] = useState('');
    const [transcripts, setTranscripts] = useState([]);
    const [lines, setLine] = useState([]);
    const audioVideo = useAudioVideo();

    const { toggleVideo } = useLocalVideo();

    useEffect(() => {
        async function tog() {
            if (meetingStatus === MeetingStatus.Succeeded) {
                await toggleVideo();
            }
        }
        tog();
    }, [meetingStatus]);

    useEffect(() => {
        if (transcripts) {
            if (transcripts.results !== undefined) {
                if (!transcripts.results[0].isPartial) {
                    if (transcripts.results[0].alternatives[0].items[0].confidence > 0.5) {
                        setLine((lines) => [
                            ...lines,
                            `${transcripts.results[0].alternatives[0].items[0].attendee.externalUserId}: ${transcripts.results[0].alternatives[0].transcript}`,
                        ]);
                    }
                }
            }
        }
    }, [transcripts]);

    useEffect(() => {
        if (audioVideo) {
            audioVideo.transcriptionController?.subscribeToTranscriptEvent((transcriptEvent) => {
                setTranscripts(transcriptEvent);
            });
        }
    }, [audioVideo]);

    const JoinButtonProps = {
        icon: <Meeting />,
        onClick: (event) => handleJoin(event),
        label: 'Join',
    };

    const LeaveButtonProps = {
        icon: <LeaveMeeting />,
        onClick: (event) => handleLeave(event),
        label: 'Leave',
    };

    const EndButtonProps = {
        icon: <Remove />,
        onClick: (event) => handleEnd(event),
        label: 'End',
    };

    const handleLeave = async (event) => {
        await meetingManager.leave();
    };

    const handleEnd = async (event) => {
        console.log(`Auth ${JSON.stringify(await Auth.currentUserInfo())}`);
        event.preventDefault();
        try {
            await API.post('meetingApi', 'end', { body: { meetingId: meetingId } });
            setLine([]);
        } catch (err) {
            console.log(err);
        }
    };

    const handleJoin = async (event) => {
        event.preventDefault();
        const email = (await Auth.currentUserInfo()).attributes.email;
        console.log(email);
        try {
            const joinResponse = await API.post('meetingApi', 'meeting', { body: { email: email } });
            const meetingSessionConfiguration = new MeetingSessionConfiguration(
                joinResponse.Meeting,
                joinResponse.Attendee,
            );

            const options = {
                deviceLabels: DeviceLabels.AudioAndVideo,
            };

            await meetingManager.join(meetingSessionConfiguration, options);
            await meetingManager.start();
            meetingManager.invokeDeviceProvider(DeviceLabels.AudioAndVideo);
            setMeetingId(joinResponse.Meeting.MeetingId);
            setAttendeeId(joinResponse.Attendee.AttendeeId);
        } catch (err) {
            console.log(err);
        }
    };

    return (
        <SpaceBetween direction="horizontal" size="xs">
            <SpaceBetween direction="vertical" size="l">
                <Container header={<Header variant="h2">Amazon Chime SDK Meeting</Header>}>
                    <div style={{ height: '600px', width: '720px' }}>
                        <VideoTileGrid />
                    </div>
                </Container>
                <ControlBar showLabels={true} responsive={true} layout="undocked-horizontal">
                    <ControlBarButton {...JoinButtonProps} />
                    <ControlBarButton {...LeaveButtonProps} />
                    <ControlBarButton {...EndButtonProps} />
                    <AudioInputControl />
                    <AudioOutputControl />
                    <VideoInputControl />
                </ControlBar>
            </SpaceBetween>

            <Container header={<Header variant="h2">Transcription</Header>}>
                <SpaceBetween size="xs">
                    <div style={{ height: '600px', width: '240px' }}>
                        {lines.slice(Math.max(lines.length - 10, 0)).map((line, index) => (
                            <div key={index}>
                                {line}
                                <br />
                            </div>
                        ))}
                    </div>
              
                </SpaceBetween>
            </Container>
            <SpeakerTimer />
                  <Extras />
        </SpaceBetween>
    );
};