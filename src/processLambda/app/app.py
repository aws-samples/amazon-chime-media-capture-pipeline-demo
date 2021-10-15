import boto3
import os
import subprocess
import shlex
from boto3.dynamodb.conditions import Key

SOURCE_BUCKET = os.environ['MEDIA_CAPTURE_BUCKET']
SOURCE_PREFIX = 'captures'
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
MEETING_TABLE = os.environ['MEETINGS_TABLE_NAME']

def get_attendees(MEETING_ID):
    table = dynamodb.Table(MEETING_TABLE)
    attendees = table.query(
        IndexName='meetingIdIndex',
        KeyConditionExpression=Key('meetingId').eq(MEETING_ID))
    return attendees['Items'][0]['AttendeeInfo']

def process_files(objs_keys, MEETING_ID, file_type, *attendee):
    if attendee:
        attendeeStr = "-" + attendee[0]
    else:
        attendeeStr = ""
        
    with open('/tmp/' + file_type +attendeeStr+'_list.txt', 'w') as f:
        for k in objs_keys:
            basename = os.path.splitext(k)[0]
            ffmpeg_cmd = "ffmpeg -i /tmp/" + k + " -bsf:v h264_mp4toannexb -f mpegts -framerate 15 -c copy /tmp/" + basename + attendeeStr + "-" + file_type + ".ts -y"
            command1 = shlex.split(ffmpeg_cmd)
            p1 = subprocess.run(command1, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            f.write(f'file \'/tmp/{basename}{attendeeStr}-{file_type}.ts\'\n')

    ffmpeg_cmd = "ffmpeg -f concat -safe 0 -i /tmp/" + file_type + attendeeStr + "_list.txt  -c copy /tmp/"+file_type+attendeeStr+".mp4 -y"
    command1 = shlex.split(ffmpeg_cmd)
    p1 = subprocess.run(command1, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    s3.upload_file('/tmp/'+file_type+attendeeStr+'.mp4', SOURCE_BUCKET, "captures/" + MEETING_ID + "/processed" + '/processed-'+file_type+attendeeStr+'.mp4')
    processedUrl = s3.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': "captures/" + MEETING_ID + "/processed" + '/processed'+attendeeStr+"-"+file_type+'.mp4' })
    
    return processedUrl
    
    
def handler(event, context):
    #This demo is limited in scope to give a starting point for how to process 
    #produced audio files and should include error checking and more robust logic 
    #for production use. Large meetings and/or long duration may lead to incomplete 
    #recordings in this demo.    
    print(event)
    MEETING_ID = event.get('detail').get('meetingId')
    print(MEETING_ID)

    audioPrefix = SOURCE_PREFIX + '/' + MEETING_ID + '/audio'
    videoPrefix = SOURCE_PREFIX + '/' + MEETING_ID + '/video'
    
    audioList = s3.list_objects_v2(
        Bucket=SOURCE_BUCKET,
        Delimiter='string',
        MaxKeys=1000,
        Prefix=audioPrefix
    )
    audioObjects = audioList.get('Contents', [])
    print(audioObjects)
    
    videoList = s3.list_objects_v2(
        Bucket=SOURCE_BUCKET,
        Delimiter='string',
        MaxKeys=1000,
        Prefix=videoPrefix
    )
    videoObjects = videoList.get('Contents', [])
    print(videoObjects)
    
    if videoObjects:
        file_list=[]
        file_type = 'video'
        for object in videoObjects:
            path, filename = os.path.split(object['Key'])
            s3.download_file(SOURCE_BUCKET, object['Key'], '/tmp/' + filename)
            file_list.append(filename)
    
        objs_keys = list(filter(lambda x : 'mp4' in x, file_list))
        print(objs_keys)
        attendees = get_attendees(MEETING_ID)
        for attendee in attendees:
            print("Concatenating " + file_type + " files for " + attendee  + "...")
            attendeeKeys = list(filter(lambda x: attendee in x, objs_keys))
            print(attendeeKeys)
            process_files(attendeeKeys, MEETING_ID, file_type, attendee)
    else:
        print("No videos")
        
    file_list=[]
    file_type = 'audio'
    for object in audioObjects:
        path, filename = os.path.split(object['Key'])
        s3.download_file(SOURCE_BUCKET, object['Key'], '/tmp/' + filename)
        file_list.append(filename)
    
    objs_keys = filter(lambda x : 'mp4' in x, file_list)        
    process_files(objs_keys, MEETING_ID, file_type)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'            
        }
    }
