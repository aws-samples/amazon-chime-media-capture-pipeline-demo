import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Container, Header, SpaceBetween, Select } from '@cloudscape-design/components';
import '@aws-amplify/ui-react/styles.css';
import '@cloudscape-design/global-styles/index.css';
import {
  useMeetingStatus,
  MeetingStatus,
} from 'amazon-chime-sdk-component-library-react';


const Extras = () => {
  const meetingStatus = useMeetingStatus();

  return (
    <>{ meetingStatus == MeetingStatus.Succeeded ? ( 
      <Container header={<Header variant='h2'>Meeting Extras</Header>}>
        <div style={{ height: '210px', width: '300px' }} className={"text"}>
          <strong>Word of the Day: Solace</strong><br /><br />
          What It Means: Solace means “someone or something that gives a feeling of comfort to a person who is experiencing grief, sadness, or anxiety.”<br /><br />
        // Her presence was a great solace to me during my time of need.<br /><br />
        // We took solace in the knowledge that our ordeal would be over soon.
        </div >
      </Container>
    ) : (<></>)
 }</>
 )
}
export default Extras;