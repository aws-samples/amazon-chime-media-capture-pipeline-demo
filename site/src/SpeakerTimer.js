import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Container, Header, SpaceBetween } from '@cloudscape-design/components';
import {
  useLocalVideo,
  VideoTileGrid,
  VideoGrid,
  VideoTile,
  useMeetingStatus,
  MeetingStatus,
  useAudioVideo,
} from 'amazon-chime-sdk-component-library-react';
import '@aws-amplify/ui-react/styles.css';
import '@cloudscape-design/global-styles/index.css';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';

// use data channel messages for the countdown timer
const useSubscribeToDataChannel = (audioVideo, processMessageCallback) => {
  useEffect(() => {
    if (!audioVideo) {
      console.error('No audioVideo');
      return;
    }

    audioVideo.realtimeSubscribeToReceiveDataMessage(
      'timerEvent',
      (data) => {
        const receivedData = (data && data.json()) || {};
        const { message } = receivedData;
        processMessageCallback(message);
      },
    );

    return () => {
      console.log('unsubscribing from receive data message');
      audioVideo.realtimeUnsubscribeFromReceiveDataMessage('Message');
    };
  }, [audioVideo]);
}

const useSendMessage = (audioVideo) => {
  const [message, setMessage] = useState();
  useEffect(() => {
    if (!audioVideo) {
      console.error('No audioVideo');
      return;
    }
    if (message) {
      audioVideo.realtimeSendDataMessage(
        'timerEvent',
        { message: message },
        120000,
      );
    }
  }, [message]);

  return {
    sendMessage: setMessage
  }
}

// react countdown timer component controls

export const VideoMeeting = ({ setLine, setTranscribeStatus, setTranslateStatus }) => {
  const meetingStatus = useMeetingStatus();
  const { toggleVideo } = useLocalVideo();
  const [isPlaying, setIsPlaying] = useState(false);
  const [inputDuration, setInputDuration] = useState(30);
  const [duration, setDuration] = useState(30);
  const [restartKey, setRestartKey] = useState(0);
  const audioVideo = useAudioVideo();
  const [incomingMessage, setIncomingMessage] = useState();

  useEffect(() => {
    async function tog() {
      if (meetingStatus === MeetingStatus.Succeeded) {
        await toggleVideo();
      }
      if (meetingStatus === MeetingStatus.Ended) {
        setLine([]);
        setTranscribeStatus(false);
        setTranslateStatus(false);
      }
    }
    tog();
  }, [meetingStatus]);

  const { sendMessage } = useSendMessage(audioVideo);

  useSubscribeToDataChannel(audioVideo, (incomingMessage) => {
    if (incomingMessage) {
      switch (incomingMessage.action) {
        case 'startTimer':
          handleStartCountdown(false);
          break;
        case 'resetTimer':
          handleResetCountdown(false);
          break;
        case 'setCountdownDuration':
          handleSetCountdownDurationMessage(incomingMessage.duration);
          break;
        default:
          break;
      }
    }
  });

  const handleStartCountdown = (shouldSendMessage) => {
    setIsPlaying(true);
    shouldSendMessage && sendMessage({
      action: 'startTimer'
    })
  }

  const handleResetCountdown = (shouldSendMessage) => {
    setIsPlaying(false);
    setRestartKey(restartKey + 1);
    shouldSendMessage && sendMessage({
      action: 'resetTimer'
    })
  }

  const handleSetCountdownDurationMessage = (duration) => {
    setDuration(duration);
  }

  const handleChangeDuration = (event) => {
    const value = event.target.value;
    setInputDuration(value);
  }

  const handleSetCountdownDuration = () => {
    setDuration(inputDuration);
    sendMessage({
      action: 'setCountdownDuration',
      duration: inputDuration,
    })
  }

  const renderTime = () => {
    return (
    <div className="timer">
      <div className="text">Remaining</div>
      <div className="value">{remainingTime}</div>
      <div className="text">seconds</div>
    </div>
  );
};

  return (
     <>{ meetingStatus == MeetingStatus.Succeeded ? ( 
    <Container header={<Header variant="h2">Speaker Countdown</Header>}>
      <SpaceBetween size="xs">
        <div
          style={{ height: "210px", width: "300px" }}
          className={"timer"}
        >
          {meetingStatus == MeetingStatus.Succeeded ? (
            <>
              <CountdownCircleTimer
                isPlaying={isPlaying}
                key={restartKey}
                duration={duration}
                size={100}
                colors={["#008000", "#F7B801", "#A30000", "#A30000"]}
                colorsTime={[7, 5, 2, 0]}
              >
                {({ remainingTime }) => remainingTime}
              </CountdownCircleTimer><br />
              <div className="text">
              <label htmlFor="seconds">Seconds: </label>
              <input
                type="number"
                size="5"
                id="seconds"
                value={inputDuration}
                onChange={handleChangeDuration}
              />
              <br></br>
              <button onClick={handleSetCountdownDuration}>
                {" "}
                Set duration{" "}
              </button>
              <button onClick={() => handleStartCountdown(true)}>
                {" "}
                Start timer{" "}
              </button>
              <button onClick={handleResetCountdown}> Reset timer </button>
              <br /><br />
                2min = 120 | 5min = 300 | 7min = 420
                </div>
            </>
          ) : (
            <></>
          )}
        </div>
      </SpaceBetween>
      </Container>
        ) : (<></>)
       }</>
  );
};

export default VideoMeeting;