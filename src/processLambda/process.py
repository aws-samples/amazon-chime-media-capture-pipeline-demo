import boto3
import ffmpeg
import os
import json
from botocore.client import Config
import subprocess
import shlex
import re

SOURCE_BUCKET = os.environ['MEDIA_CAPTURE_BUCKET']
SOURCE_PREFIX = 'captures'

def lambda_handler(event, context):
    #print(event)
    meetingBody =  json.loads(event['body'])
    MEETING_ID = meetingBody['meetingId']
    s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))
    bucket = boto3.resource('s3').Bucket(SOURCE_BUCKET)
    prefix = SOURCE_PREFIX + '/' + MEETING_ID 
    objs_keys = [o.key for o in list(bucket.objects.filter(Prefix=prefix))]
    #print(objs_keys)
    
    print("Concatenating audio only files...")
    audio_objs_keys = filter(lambda x : 'audio' in x, objs_keys)
    with open('/tmp/audio_list.txt', 'w') as f:
        for k in audio_objs_keys:
            url = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': k})
            #print(url)
            f.write(f'file \'{url}\'\n')
    ffmpeg.input('/tmp/audio_list.txt', format='concat', safe=0, protocol_whitelist='file,https,tls,tcp').output('/tmp/audio.m4a',c='copy', vn=None).overwrite_output().run()
            
    s3_client.upload_file('/tmp/audio.m4a', SOURCE_BUCKET, "captures/" + MEETING_ID + "/processed" + '/processedAudio.m4a')
    audioProcessedUrl = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': "captures/" + MEETING_ID + "/processed" + '/processedAudio.m4a' })

    print("Concatenating audio with active video files...")
    audio_objs_keys = filter(lambda x : 'audio' in x, objs_keys)
    with open('/tmp/audio_list.txt', 'w') as f:
        for k in audio_objs_keys:
            url = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': k})
            match = re.search(r'\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}', k)
            filename = '/tmp/' + match.group(0) + '.ts'
            #print(url)
            #print(match)
            #print(filename)
            ffmpeg_cmd = "/opt/bin/ffmpeg -i \"" + url + "\" -bsf:v h264_mp4toannexb -f mpegts -framerate 15 -c copy " + filename + " -y"
            command1 = shlex.split(ffmpeg_cmd)
            p1 = subprocess.run(command1)

            f.write(f'file \'{filename}\'\n')
            
    ffmpeg_cmd = "/opt/bin/ffmpeg -f concat -safe 0  -i /tmp/audio_list.txt -c copy /tmp/audio.mp4"
    command1 = shlex.split(ffmpeg_cmd)
    p1 = subprocess.run(command1)

    s3_client.upload_file('/tmp/audio.mp4', SOURCE_BUCKET, "captures/" + MEETING_ID + "/processed" + '/processedAudio.mp4')
    videoProcessedUrl = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key':  "captures/" + MEETING_ID + "/processed" + '/processedAudio.mp4' })
    print(videoProcessedUrl)
    print("Concatenating video files...")
    video_objs_keys = filter(lambda x : 'video' in x, objs_keys)
    with open('/tmp/video_list.txt', 'w') as f:
        for k in video_objs_keys:
            url = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': k})
            #print(url)
            f.write(f'file \'{url}\'\n')
    
    if os.stat('/tmp/video_list.txt').st_size > 0 :
        ffmpeg.input('/tmp/video_list.txt', format='concat', safe=0, protocol_whitelist='file,https,tls,tcp').output('/tmp/video.mp4',c='copy').overwrite_output().run()
        s3_client.upload_file('/tmp/video.mp4', SOURCE_BUCKET, "captures/" + MEETING_ID + "/processed" + '/processedVideo.mp4')
        processedUrl = s3_client.generate_presigned_url('get_object', Params={'Bucket': SOURCE_BUCKET, 'Key': MEETING_ID + '/processedVideo.mp4' })
    else :
        print("Nothing to process video")
        
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'            
        },
        "body": json.dumps({
            "audioProcessedUrl" : audioProcessedUrl,
            "videoProcessedUrl": videoProcessedUrl
        })
    }