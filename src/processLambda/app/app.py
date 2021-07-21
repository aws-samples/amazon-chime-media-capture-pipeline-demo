import boto3
# import ffmpeg
import os
import json
from botocore.client import Config
import subprocess
import shlex
import re
import time

SOURCE_BUCKET = os.environ['MEDIA_CAPTURE_BUCKET']
# SOURCE_BUCKET = 'mediacapturedemo-mediacapturebucketc9e815f7-moh2cfdpsemd'
SOURCE_PREFIX = 'captures'

def handler(event, context):
    print(event)
    time.sleep(15)
    meetingBody =  json.loads(event['body'])
    MEETING_ID = meetingBody['meetingId']
    # bucket = boto3.resource('s3').Bucket(SOURCE_BUCKET)
    prefix = SOURCE_PREFIX + '/' + MEETING_ID + '/audio'
    # objects = bucket.objects.filter(Prefix=prefix)
    client = boto3.client('s3')

    response = client.list_objects_v2(
        Bucket=SOURCE_BUCKET,
        Delimiter='string',
        MaxKeys=1000,
        Prefix=prefix
    )
    objects = response.get('Contents', [])
    file_list=[]
    print(objects)
    for object in objects:
        path, filename = os.path.split(object['Key'])
        client.download_file(SOURCE_BUCKET, object['Key'], '/tmp/' + filename)
        file_list.append(filename)

    print("Concatenating audio files...")
    audio_objs_keys = filter(lambda x : 'mp4' in x, file_list)
    print(file_list)
    print(audio_objs_keys)
    with open('/tmp/audio_list.txt', 'w') as f:
        for k in audio_objs_keys:
            # url = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': k})
            basename = os.path.splitext(k)[0]
            print(basename)
            ffmpeg_cmd = "ffmpeg -i /tmp/" + k + " -bsf:v h264_mp4toannexb -f mpegts -framerate 15 -c copy /tmp/" + basename + ".ts -y"
            command1 = shlex.split(ffmpeg_cmd)
            print (command1)
            p1 = subprocess.run(command1, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print(p1)
            f.write(f'file \'/tmp/{basename}.ts\'\n')

    ffmpeg_cmd = "ffmpeg -f concat -safe 0 -i /tmp/audio_list.txt  -c copy /tmp/audio.mp4 -y"
    command1 = shlex.split(ffmpeg_cmd)
    p1 = subprocess.run(command1, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(str(p1))
    client.upload_file('/tmp/audio.mp4', SOURCE_BUCKET, "captures/" + MEETING_ID + "/processed" + '/processedAudio.mp4')
    processedAudioUrl = client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': "captures/" + MEETING_ID + "/processed" + '/processedAudio.mp4' })
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'            
        },
        "body": json.dumps({
            "processedUrl" : processedAudioUrl
        })
    }