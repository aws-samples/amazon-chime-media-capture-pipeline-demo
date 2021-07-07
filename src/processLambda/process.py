import boto3
import ffmpeg
import os
import json
from botocore.client import Config
import subprocess
import shlex

SOURCE_BUCKET = os.environ['MEDIA_CAPTURE_BUCKET']
SOURCE_PREFIX = 'captures'

def lambda_handler(event, context):
    meetingBody =  json.loads(event['body'])
    MEETING_ID = meetingBody['meetingId']
    s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))
    bucket = boto3.resource('s3').Bucket(SOURCE_BUCKET)
    prefix = SOURCE_PREFIX + '/' + MEETING_ID 
    objs_keys = [o.key for o in list(bucket.objects.filter(Prefix=prefix))]
    print(objs_keys)
   
    print("Concatenating audio files...")
    audio_objs_keys = filter(lambda x : 'audio' in x, objs_keys)
    print(audio_objs_keys)
    with open('/tmp/audio_list.txt', 'w') as f:
        for k in audio_objs_keys:
            url = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': k})
            print(url)
            f.write(f'file \'{url}\'\n')
 
    ffmpeg.input('/tmp/audio_list.txt', format='concat', safe=0, protocol_whitelist='file,https,tls,tcp').output('/tmp/audio.mp4',c='copy').overwrite_output().run()
            
    s3_client.upload_file('/tmp/audio.mp4', SOURCE_BUCKET, "captures/" + MEETING_ID + "/processed" + '/processedAudio.mp4')
    processedUrl = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': 'captures/' + MEETING_ID + '/processed/processedAudio.mp4' })
    print(processedUrl)
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'            
        },
        "body": json.dumps({
            "processedUrl" : processedUrl
        })
    }

