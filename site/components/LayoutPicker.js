import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { Container, Header, SpaceBetween } from "@cloudscape-design/components";
import {
  useLocalVideo,
  VideoTileGrid,
  VideoGrid,
  VideoTile,
  useMeetingStatus,
  MeetingStatus,
  useAudioVideo,
} from "amazon-chime-sdk-component-library-react";
import "@aws-amplify/ui-react/styles.css";
import "@cloudscape-design/global-styles/index.css";


const LayoutPicker = () => {
   const meetingStatus = useMeetingStatus();
  return (
     <>{ meetingStatus == MeetingStatus.Succeeded ? ( 
    <Container header={<Header variant="h2">Speaker Layout Controls</Header>}>
      <div style={{ height: "200px", width: "300px" }} className={"transcriptionContainer"}>
        <div className="transcriptionContainer">
          <table>
            <tr>
              <th>Name</th>
              <th>Focus Panel</th>
            </tr>
            <tr>
              <td>Bob Smith</td>
              <td>Right</td>
            </tr>
            <tr>
              <td>Jill Foust</td>
              <td>Left</td>
            </tr>
          </table>
        </div>
      </div>
      </Container>
    ) : (<></>)
       }</>
  );
};
export default LayoutPicker;
