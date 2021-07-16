import React, { useState } from 'react';
import './App.css';
import {
  useMeetingManager,
  useLocalVideo,
  VideoTileGrid
}
from 'amazon-chime-sdk-component-library-react'
import cdkExports from './cdk-outputs.json'

const axios = require('axios');
const API_URL = cdkExports.MediaCaptureDemo.apiURL
const region = 'us-east-1';

const App = () => {
  const meetingManager = new useMeetingManager();
  const { isVideoEnabled, toggleVideo } = useLocalVideo();
  const [title, setTitle] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [meetingDetails, setMeetingDetails] = useState('')
  const [mediaPipeLine, setMediaPipeLine] = useState('')
  // const [processedURL, setProcessedURL] = useState('')
  const handleChange = (event) => setTitle(event.target.value)

  const handleJoinMeeting = async (event) => {
    event.preventDefault()
    console.log("Joining Meeting")
      const joinRequest = {
        url: API_URL + 'create',
        method: 'post',
        headers: {
          'Content-Type': 'applications/json',        
        },
        data: {
          'title': title,
          'region': region
        }
      }
      console.log(joinRequest)
      try {
        const meetingInfo = await axios(joinRequest)
        console.log(meetingInfo)
        const joinInfo = {
          meetingInfo: meetingInfo.data.Meeting,
          attendeeInfo: meetingInfo.data.Attendee
        }
        setMeetingDetails(joinInfo)
        console.log(joinInfo)
        
        await meetingManager.join(joinInfo)
        await meetingManager.start()
        console.log('Meeting started')
      } catch (err) {
        console.log(err)
      }      
  }

  const handleRecording = async (event) => {
    event.preventDefault()
 
    console.log("Handling Record.  Current state: " + isRecording)
    const recordRequest = {
      url: API_URL + 'record',
      method: 'post',
      headers: {
        'Content-Type': 'applications/json',        
      },
      data: {
        meetingId: '',
        setRecording: isRecording,
        mediaPipeLine: ''
      }
    }

    if (isRecording) {
      console.log("Stopping Record")
      recordRequest.data.mediaPipeLine = mediaPipeLine
      
      const processRequest = {
        url: API_URL + 'process',
        method: 'post',
        headers: {
          'Content-Type': 'applications/json',        
        },
        data: {
          meetingId:  meetingDetails.meetingInfo.MeetingId
        }
      }
      try {
        await axios(recordRequest)
        const processInfo = await axios(processRequest)
        // setProcessedURL(processInfo.data.processedURL)
        console.log("Audio Only File: " + processInfo.data.audioProcessedUrl)
        console.log("Audio and Video File: " + processInfo.data.videoProcessedUrl)
        } catch (err) {
        console.log(err)
      }
    } else {
      console.log("Starting Record")
      recordRequest.data.meetingId = meetingDetails.meetingInfo.MeetingId
      try {
        const recordingInfo = await axios(recordRequest)
        setMediaPipeLine(recordingInfo.data.MediaCapturePipeline.MediaPipelineId)
        } catch (err) {
        console.log(err)
      }
    }
    setIsRecording(!isRecording)  
  }

  return (
      <div>
        <form onSubmit={handleJoinMeeting}>
          <label>
            Meeting Title: <input type="text" value={title} onChange={handleChange} />
          </label>
          <input type="submit" value="Submit" />
        </form>
        <div id="video">
          <div className = 'gridVideo'>
            <VideoTileGrid
            layout = 'standard'
            noRemoteVideoView = 'No remote video'
            />
          </div>
        </div>
        <button onClick={toggleVideo}>
          {isVideoEnabled ? 'Stop Video' : 'Start Video'}
        </button>
        <button onClick={handleRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
    )
  }

export default App;
