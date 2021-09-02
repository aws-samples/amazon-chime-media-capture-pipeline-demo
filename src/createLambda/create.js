const {"v4": uuidv4} = require('uuid');
var AWS = require('aws-sdk');
const chime = new AWS.Chime({ region: 'us-east-1' });
var docClient = new AWS.DynamoDB.DocumentClient();
chime.endpoint = new AWS.Endpoint('https://service.chime.aws.amazon.com/console');
const meetingsTable = process.env.MEETINGS_TABLE_NAME;
const region = 'us-east-1'

function isEmppty (object) {
  return Object.keys(object).length === 0;
}

async function getEvent (title) {
  console.log(title)
  var params = {
      TableName: meetingsTable,
      Key:{
          "Title": title
      }
  };
  try {
      const response = await docClient.get(params).promise()
      console.log("REPONSE FROM DDB IS ", response)
      return response
  } catch (err){
      return err
  }
}

async function putInfo(joinInfo) {
    console.log("In putInfo")
    var params = {
        TableName: meetingsTable,
        Key: {
          "Title": joinInfo.Title,
        },
        UpdateExpression: "SET #mi = :mi, #mId = :mId, #ai = list_append(if_not_exists(#ai, :empty), :ai)",
        ExpressionAttributeNames: { '#mi': 'MeetingInfo', '#mId': 'meetingId', '#ai': 'AttendeeInfo'},
        ExpressionAttributeValues : {
          ":mi": joinInfo.Meeting,
          ":mId": joinInfo.Meeting.MeetingId,
          ":ai": [ joinInfo.Attendee.AttendeeId ],
          ":empty": []
        }
    }
    console.log(params)
    try {
        await docClient.update(params).promise()
    } catch (err) {
        console.log(err)
        return err
    }
}

exports.handler = async (event) => {
  console.log(event)
  const body =  JSON.parse(event.body)
  console.log(body) 

  const meetingInfo = await getEvent(body.title)
  
  console.log(meetingInfo)
  
  
  if(isEmppty(meetingInfo)) {
    const meetingRequest = {
      ClientRequestToken: uuidv4(),
      MediaRegion: region,
    };
    console.info('Creating new meeting before joining: ' + JSON.stringify(meetingRequest));
    const meetingInfo = await chime.createMeeting(meetingRequest).promise();
    console.log(meetingInfo)
    const attendeeRequest = {
      MeetingId: meetingInfo.Meeting.MeetingId,
      ExternalUserId: uuidv4(),
    }
    console.info('Creating new attendee: ' + JSON.stringify(attendeeRequest))
    const attendeeInfo = (await chime.createAttendee(attendeeRequest).promise());
    console.log(attendeeInfo)
    const joinInfo = {
        Title: body.title,
        Meeting: meetingInfo.Meeting,
        Attendee: attendeeInfo.Attendee
      };
    console.info('joinInfo: ' + JSON.stringify(joinInfo))
    
    await putInfo(joinInfo)
    
    const response = {
        statusCode: 200,
        body: JSON.stringify(joinInfo),
        headers: {
            'Access-Control-Allow-Origin':'*',
            'Content-Type':'application/json'
        }
    }
    return response
  } else {
    const attendeeRequest = {
      MeetingId: meetingInfo.Item.MeetingInfo.MeetingId,
      ExternalUserId: uuidv4(),
    }
    console.info('Creating new attendee: ' + JSON.stringify(attendeeRequest))
    const attendeeInfo = (await chime.createAttendee(attendeeRequest).promise());
    console.log(attendeeInfo)
    const joinInfo = {
      Title: body.title,
      Meeting: meetingInfo.Item.MeetingInfo,
      Attendee: attendeeInfo.Attendee
    };
    console.log(joinInfo)
    await putInfo(joinInfo)    
    const response = {
      statusCode: 200,
      body: JSON.stringify(joinInfo),
      headers: {
          'Access-Control-Allow-Origin':'*',
          'Content-Type':'application/json'
      }
    }
    return response
  }
}
